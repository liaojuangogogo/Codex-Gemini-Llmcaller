#!/usr/bin/env node

import { handleRequest } from "./server.mjs";

function request(id, method, params = {}) {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params
  };
}

async function runSmoke() {
  const initialize = await handleRequest(request(1, "initialize", {
    protocolVersion: "2024-11-05"
  }));
  const toolsResult = await handleRequest(request(2, "tools/list"));
  const configResult = await handleRequest(request(3, "tools/call", {
    name: "config_get",
    arguments: {}
  }));
  await handleRequest(request(4, "tools/call", {
    name: "profile_list",
    arguments: {}
  }));

  const toolNames = toolsResult.tools.map((tool) => tool.name);
  const requiredTools = [
    "call_model",
    "config_get",
    "config_set_default_profile",
    "profile_set",
    "profile_delete",
    "profile_list",
    "secret_set",
    "secret_get",
    "secret_list"
  ];
  const missing = requiredTools.filter((name) => !toolNames.includes(name));

  if (missing.length) {
    throw new Error(`Missing MCP tools: ${missing.join(", ")}`);
  }
  if (configResult.structuredContent.defaultProfile !== "gemini-default") {
    throw new Error(`Unexpected default profile: ${configResult.structuredContent.defaultProfile}`);
  }
  if (initialize.serverInfo?.name !== "Codex-Gemini-Llmcaller") {
    throw new Error(`Unexpected server name: ${initialize.serverInfo?.name}`);
  }

  console.log("MCP smoke passed.");
  console.log(JSON.stringify({
    serverInfo: initialize.serverInfo,
    toolCount: toolNames.length,
    defaultProfile: configResult.structuredContent.defaultProfile
  }, null, 2));
}

runSmoke().catch((error) => {
  console.error(`MCP smoke failed: ${error.message}`);
  process.exitCode = 1;
});
