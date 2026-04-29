#!/usr/bin/env node

import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildGoogleBody,
  callModel,
  handleToolCall
} from "./server.mjs";

const TEST_SECRET = "AIza-test-secret-value";
const MASTER_KEY = "test-master-password";
const testDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".data", "test-secrets");
const testSecretsPath = resolve(testDir, "secrets.json");
const testConfigPath = resolve(testDir, "config.json");

function resetSecretStore() {
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(testDir, { recursive: true });
  process.env.CODEX_GEMINI_LLMCALLER_SECRETS_PATH = testSecretsPath;
  process.env.CODEX_GEMINI_LLMCALLER_CONFIG_PATH = testConfigPath;
}

async function testSecretEncryption() {
  resetSecretStore();

  const setResult = await handleToolCall({
    name: "secret_set",
    arguments: {
      name: "gemini-default",
      apiKey: TEST_SECRET,
      masterKey: MASTER_KEY,
      provider: "google",
      model: "gemini-3-flash-preview"
    }
  });

  assert.equal(setResult.structuredContent.stored, true);
  assert.equal(setResult.structuredContent.secret.name, "gemini-default");
  assert(!JSON.stringify(setResult).includes(TEST_SECRET), "secret_set must not return plaintext key");
  assert(existsSync(testSecretsPath), "secret store should be created");
  assert(!readFileSync(testSecretsPath, "utf8").includes(TEST_SECRET), "secret store must not contain plaintext key");

  const getResult = await handleToolCall({
    name: "secret_get",
    arguments: {
      name: "gemini-default",
      masterKey: MASTER_KEY
    }
  });

  assert.equal(getResult.structuredContent.canDecrypt, true);
  assert(!JSON.stringify(getResult).includes(TEST_SECRET), "secret_get must not return plaintext key");
  await assert.rejects(
    () => handleToolCall({
      name: "secret_get",
      arguments: {
        name: "gemini-default",
        masterKey: "wrong-master-password"
      }
    }),
    /could not be decrypted/
  );

  const listResult = await handleToolCall({
    name: "secret_list",
    arguments: {}
  });
  assert.equal(listResult.structuredContent.secrets.length, 1);
  assert.equal(listResult.structuredContent.secrets[0].name, "gemini-default");

  const deleteResult = await handleToolCall({
    name: "secret_delete",
    arguments: {
      name: "gemini-default"
    }
  });
  assert.equal(deleteResult.structuredContent.deleted, true);
  await assert.rejects(
    () => handleToolCall({
      name: "secret_get",
      arguments: {
        name: "gemini-default",
        masterKey: MASTER_KEY
      }
    }),
    /was not found/
  );
}

async function testSecretSetFromEnv() {
  resetSecretStore();
  process.env.TEST_CODEX_GEMINI_LLMCALLER_API_KEY = TEST_SECRET;
  process.env.TEST_CODEX_GEMINI_LLMCALLER_MASTER_KEY = MASTER_KEY;

  try {
    const setResult = await handleToolCall({
      name: "secret_set",
      arguments: {
        name: "env-secret",
        apiKeyEnv: "TEST_CODEX_GEMINI_LLMCALLER_API_KEY",
        masterKeyEnv: "TEST_CODEX_GEMINI_LLMCALLER_MASTER_KEY",
        provider: "google"
      }
    });

    assert.equal(setResult.structuredContent.stored, true);
    assert(!JSON.stringify(setResult).includes(TEST_SECRET), "secret_set with apiKeyEnv must not return plaintext key");
    assert(!readFileSync(testSecretsPath, "utf8").includes(TEST_SECRET), "secret store must not contain plaintext key from env");
  } finally {
    delete process.env.TEST_CODEX_GEMINI_LLMCALLER_API_KEY;
    delete process.env.TEST_CODEX_GEMINI_LLMCALLER_MASTER_KEY;
  }
}

async function testGeminiRequestShape() {
  let captured = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    captured = {
      url,
      options,
      body: JSON.parse(options.body)
    };
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "Gemini response"
                }
              ]
            }
          }
        ],
        usageMetadata: {
          promptTokenCount: 3,
          candidatesTokenCount: 2,
          totalTokenCount: 5
        }
      })
    };
  };

  try {
    const result = await callModel({
      provider: "google",
      model: "gemini-3-flash-preview",
      apiKey: TEST_SECRET,
      messages: [
        {
          role: "system",
          content: "Be concise."
        },
        {
          role: "user",
          content: "Hello"
        },
        {
          role: "assistant",
          content: "Hi"
        }
      ],
      generationConfig: {
        topP: 0.8
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_NONE"
        }
      ],
      tools: [
        {
          googleSearch: {}
        }
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: "AUTO"
        }
      },
      cachedContent: "cachedContents/test-cache",
      temperature: 0.2,
      maxTokens: 64,
      thinkingLevel: "low"
    });

    assert.equal(result.text, "Gemini response");
    assert.deepEqual(result.modelInfo, {
      provider: "google",
      model: "gemini-3-flash-preview",
      profileName: "gemini-default"
    });
    assert.equal(result.tokenUsage.input, 3);
    assert.equal(result.tokenUsage.output, 2);
    assert.equal(result.tokenUsage.total, 5);
    assert.equal(result.tokenUsage.accounting, "billable_sum");
    assert.equal(captured.options.headers["x-goog-api-key"], TEST_SECRET);
    assert(!captured.url.includes("?key="), "Gemini API key must not be sent in query string");
    assert(captured.url.endsWith("/models/gemini-3-flash-preview:generateContent"));
    assert.deepEqual(captured.body.systemInstruction, {
      parts: [
        {
          text: "Be concise."
        }
      ]
    });
    assert.deepEqual(captured.body.contents, [
      {
        role: "user",
        parts: [
          {
            text: "Hello"
          }
        ]
      },
      {
        role: "model",
        parts: [
          {
            text: "Hi"
          }
        ]
      }
    ]);
    assert.equal(captured.body.generationConfig.temperature, 0.2);
    assert.equal(captured.body.generationConfig.maxOutputTokens, 64);
    assert.equal(captured.body.generationConfig.thinkingConfig.thinkingLevel, "low");
    assert.deepEqual(captured.body.safetySettings[0], {
      category: "HARM_CATEGORY_HARASSMENT",
      threshold: "BLOCK_NONE"
    });
    assert.deepEqual(captured.body.tools, [
      {
        googleSearch: {}
      }
    ]);
    assert.equal(captured.body.cachedContent, "cachedContents/test-cache");
    assert(!JSON.stringify(result).includes(TEST_SECRET), "call_model result must not contain plaintext key");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testProfileDefaults() {
  resetSecretStore();
  process.env.TEST_CODEX_GEMINI_LLMCALLER_API_KEY = TEST_SECRET;
  let capturedUrls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    capturedUrls.push(url);
    assert.equal(options.headers["x-goog-api-key"], TEST_SECRET);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: "profile response" }]
            },
            finishReason: "STOP"
          }
        ],
        usageMetadata: {
          promptTokenCount: 1,
          candidatesTokenCount: 2,
          totalTokenCount: 3
        }
      })
    };
  };

  try {
    const configResult = await handleToolCall({
      name: "config_get",
      arguments: {}
    });
    assert.equal(configResult.structuredContent.defaultProfile, "gemini-default");
    assert.equal(existsSync(testConfigPath), false, "config_get should not write the default config file");

    await handleToolCall({
      name: "profile_set",
      arguments: {
        name: "test-default",
        provider: "google",
        model: "gemini-profile",
        apiKeyEnv: "TEST_CODEX_GEMINI_LLMCALLER_API_KEY",
        thinkingLevel: "low",
        timeoutMs: 30000,
        setDefault: true
      }
    });

    const defaultResult = await callModel({
      prompt: "hello from default profile"
    });
    assert.equal(defaultResult.text, "profile response");
    assert.equal(defaultResult.tokenUsage.input, 1);
    assert.equal(defaultResult.tokenUsage.output, 2);
    assert.equal(defaultResult.tokenUsage.total, 3);
    assert(capturedUrls[0].endsWith("/models/gemini-profile:generateContent"));

    const overrideResult = await callModel({
      prompt: "hello from override",
      model: "gemini-override"
    });
    assert.equal(overrideResult.text, "profile response");
    assert(capturedUrls[1].endsWith("/models/gemini-override:generateContent"));
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.TEST_CODEX_GEMINI_LLMCALLER_API_KEY;
  }
}

async function testGeminiAutoContinue() {
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    const first = calls === 1;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: first ? "part one " : "part two" }]
            },
            finishReason: first ? "MAX_TOKENS" : "STOP"
          }
        ],
        usageMetadata: {
          promptTokenCount: first ? 5 : 20,
          candidatesTokenCount: first ? 10 : 3,
          totalTokenCount: first ? 15 : 23
        }
      })
    };
  };

  try {
    const result = await callModel({
      provider: "google",
      model: "gemini-3-flash-preview",
      apiKey: TEST_SECRET,
      prompt: "write a long answer",
      maxTokens: 10,
      autoContinue: true,
      maxContinuationRounds: 2
    });

    assert.equal(calls, 2);
    assert.equal(result.text, "part one part two");
    assert.equal(result.continuationRounds, 1);
    assert.deepEqual(result.finishReasons, ["MAX_TOKENS", "STOP"]);
    assert.equal(result.possiblyTruncated, false);
    assert.equal(result.tokenUsage.input, 25);
    assert.equal(result.tokenUsage.output, 13);
    assert.equal(result.tokenUsage.total, 38);
    assert.equal(result.tokenUsage.accounting, "billable_sum");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testVisibleMetaFooter() {
  resetSecretStore();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{ text: "footer response" }]
          },
          finishReason: "STOP"
        }
      ],
      usageMetadata: {
        promptTokenCount: 4,
        candidatesTokenCount: 5,
        totalTokenCount: 9
      }
    })
  });

  try {
    const defaultFooter = await handleToolCall({
      name: "call_model",
      arguments: {
        provider: "google",
        model: "gemini-3-flash-preview",
        apiKey: TEST_SECRET,
        prompt: "hello"
      }
    });
    assert(defaultFooter.content[0].text.includes("模型: google / gemini-3-flash-preview"));
    assert(defaultFooter.content[0].text.includes("Tokens: input=4, output=5, total=9"));
    assert.equal(defaultFooter.structuredContent.tokenUsage.total, 9);

    const hiddenFooter = await handleToolCall({
      name: "call_model",
      arguments: {
        provider: "google",
        model: "gemini-3-flash-preview",
        apiKey: TEST_SECRET,
        prompt: "hello",
        outputMetaFooter: false
      }
    });
    assert.equal(hiddenFooter.content[0].text, "footer response");
    assert.equal(hiddenFooter.structuredContent.tokenUsage.total, 9);
    assert.equal(hiddenFooter.structuredContent.outputMetaFooter, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testOutputMetaFooterConfigPrecedence() {
  resetSecretStore();
  process.env.TEST_CODEX_GEMINI_LLMCALLER_API_KEY = TEST_SECRET;
  writeFileSync(testConfigPath, JSON.stringify({
    version: 1,
    defaultProfile: "quiet",
    outputMetaFooter: false,
    profiles: {
      quiet: {
        provider: "google",
        model: "gemini-quiet",
        apiKeyEnv: "TEST_CODEX_GEMINI_LLMCALLER_API_KEY"
      },
      loud: {
        provider: "google",
        model: "gemini-loud",
        apiKeyEnv: "TEST_CODEX_GEMINI_LLMCALLER_API_KEY",
        outputMetaFooter: true
      }
    }
  }, null, 2));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{ text: "configured response" }]
          },
          finishReason: "STOP"
        }
      ],
      usageMetadata: {
        promptTokenCount: 1,
        candidatesTokenCount: 1,
        totalTokenCount: 2
      }
    })
  });

  try {
    const topLevelHidden = await handleToolCall({
      name: "call_model",
      arguments: {
        prompt: "hello"
      }
    });
    assert.equal(topLevelHidden.content[0].text, "configured response");

    const profileShown = await handleToolCall({
      name: "call_model",
      arguments: {
        profileName: "loud",
        prompt: "hello"
      }
    });
    assert(profileShown.content[0].text.includes("模型: google / gemini-loud"));

    const explicitHidden = await handleToolCall({
      name: "call_model",
      arguments: {
        profileName: "loud",
        prompt: "hello",
        outputMetaFooter: false
      }
    });
    assert.equal(explicitHidden.content[0].text, "configured response");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.TEST_CODEX_GEMINI_LLMCALLER_API_KEY;
  }
}

async function testProviderTokenUsageMappings() {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({
        choices: [
          {
            message: {
              content: "openai response"
            }
          }
        ],
        usage: {
          prompt_tokens: 7,
          completion_tokens: 8,
          total_tokens: 15
        }
      })
    });
    const openAiResult = await callModel({
      provider: "openai-compatible",
      model: "test-openai",
      apiKey: TEST_SECRET,
      prompt: "hello"
    });
    assert.equal(openAiResult.tokenUsage.input, 7);
    assert.equal(openAiResult.tokenUsage.output, 8);
    assert.equal(openAiResult.tokenUsage.total, 15);

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({
        content: [
          {
            type: "text",
            text: "anthropic response"
          }
        ],
        usage: {
          input_tokens: 9,
          output_tokens: 10
        }
      })
    });
    const anthropicResult = await callModel({
      provider: "anthropic",
      model: "test-anthropic",
      apiKey: TEST_SECRET,
      prompt: "hello"
    });
    assert.equal(anthropicResult.tokenUsage.input, 9);
    assert.equal(anthropicResult.tokenUsage.output, 10);
    assert.equal(anthropicResult.tokenUsage.total, 19);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testInvalidConfigFallback() {
  resetSecretStore();
  writeFileSync(testConfigPath, "{ invalid json", "utf8");

  const configResult = await handleToolCall({
    name: "config_get",
    arguments: {}
  });
  assert.equal(configResult.structuredContent.defaultProfile, "gemini-default");
  assert(configResult.structuredContent.configWarning.message.includes("config.json"));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{ text: "fallback config response" }]
          },
          finishReason: "STOP"
        }
      ],
      usageMetadata: {
        promptTokenCount: 1,
        candidatesTokenCount: 2,
        totalTokenCount: 3
      }
    })
  });

  try {
    const result = await callModel({
      provider: "google",
      model: "gemini-3-flash-preview",
      apiKey: TEST_SECRET,
      prompt: "hello"
    });
    assert.equal(result.text, "fallback config response");
    assert(result.configWarning.message.includes("config.json"));
  } finally {
    globalThis.fetch = originalFetch;
  }

  await assert.rejects(
    () => handleToolCall({
      name: "profile_set",
      arguments: {
        name: "must-not-overwrite",
        provider: "google",
        model: "gemini-3-flash-preview"
      }
    }),
    /不会覆盖损坏的配置文件/
  );
}

async function testProfileFallback() {
  resetSecretStore();
  process.env.TEST_CODEX_GEMINI_LLMCALLER_API_KEY = TEST_SECRET;
  const capturedUrls = [];
  let calls = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    calls += 1;
    capturedUrls.push(url);

    if (calls === 1) {
      return {
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: async () => JSON.stringify({
          error: {
            message: `temporary failure ${TEST_SECRET}`
          }
        })
      };
    }

    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: "fallback response" }]
            },
            finishReason: "STOP"
          }
        ]
      })
    };
  };

  try {
    await handleToolCall({
      name: "profile_set",
      arguments: {
        name: "backup",
        provider: "google",
        model: "gemini-backup",
        apiKeyEnv: "TEST_CODEX_GEMINI_LLMCALLER_API_KEY"
      }
    });
    await handleToolCall({
      name: "profile_set",
      arguments: {
        name: "primary",
        provider: "google",
        model: "gemini-primary",
        apiKeyEnv: "TEST_CODEX_GEMINI_LLMCALLER_API_KEY",
        fallbackProfiles: ["backup"],
        setDefault: true
      }
    });

    const result = await callModel({
      prompt: "hello with fallback"
    });

    assert.equal(calls, 2);
    assert(capturedUrls[0].endsWith("/models/gemini-primary:generateContent"));
    assert(capturedUrls[1].endsWith("/models/gemini-backup:generateContent"));
    assert.equal(result.text, "fallback response");
    assert.equal(result.profileName, "backup");
    assert.equal(result.fallbackUsed, true);
    assert.equal(result.fallbackFailures.length, 1);
    assert.equal(result.fallbackFailures[0].profileName, "primary");
    assert(!JSON.stringify(result).includes(TEST_SECRET), "fallback metadata must not contain plaintext key");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.TEST_CODEX_GEMINI_LLMCALLER_API_KEY;
  }
}

function testRawGeminiBody() {
  const body = buildGoogleBody({
    rawContents: [
      {
        role: "user",
        parts: [
          {
            text: "Explain AI briefly."
          }
        ]
      }
    ],
    systemInstruction: "Use plain language.",
    generationConfig: {
      temperature: 0.1
    }
  }, []);

  assert.equal(body.contents[0].parts[0].text, "Explain AI briefly.");
  assert.equal(body.systemInstruction.parts[0].text, "Use plain language.");
  assert.equal(body.generationConfig.temperature, 0.1);
}

async function testFailureScenarios() {
  await assert.rejects(
    () => callModel({
      provider: "openai-compatible",
      model: "test-model",
      prompt: "hello"
    }),
    /No API key found/
  );
  await assert.rejects(
    () => callModel({
      provider: "google",
      model: "gemini-3-flash-preview",
      apiKey: TEST_SECRET
    }),
    /Either prompt or messages is required/
  );
  await assert.rejects(
    () => callModel({
      provider: "unknown",
      model: "test-model",
      apiKey: TEST_SECRET,
      prompt: "hello"
    }),
    /Unsupported provider/
  );
  await assert.rejects(
    () => handleToolCall({
      name: "profile_set",
      arguments: {
        name: "bad-headers",
        provider: "google",
        model: "gemini-3-flash-preview",
        headers: {
          Authorization: "Bearer plaintext-secret"
        }
      }
    }),
    /Profiles must not store secret-bearing headers/
  );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    statusText: "Bad Request",
    text: async () => JSON.stringify({
      error: {
        message: `bad key ${TEST_SECRET}`
      }
    })
  });

  try {
    await assert.rejects(
      () => callModel({
        provider: "google",
        model: "gemini-3-flash-preview",
        apiKey: TEST_SECRET,
        prompt: "hello"
      }),
      (error) => error.message.includes("HTTP 400") && !error.message.includes(TEST_SECRET)
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

try {
  await testSecretEncryption();
  await testSecretSetFromEnv();
  await testGeminiRequestShape();
  await testProfileDefaults();
  await testGeminiAutoContinue();
  await testVisibleMetaFooter();
  await testOutputMetaFooterConfigPrecedence();
  await testProviderTokenUsageMappings();
  await testInvalidConfigFallback();
  await testProfileFallback();
  testRawGeminiBody();
  await testFailureScenarios();
  console.log("server tests ok");
} finally {
  rmSync(testDir, { recursive: true, force: true });
  delete process.env.CODEX_GEMINI_LLMCALLER_SECRETS_PATH;
  delete process.env.CODEX_GEMINI_LLMCALLER_CONFIG_PATH;
}
