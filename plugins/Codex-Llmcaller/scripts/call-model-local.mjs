#!/usr/bin/env node

import { stdin, stdout } from "node:process";
import { handleToolCall } from "./server.mjs";

async function readStdin() {
  const chunks = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8").trim();
}

async function main() {
  const input = await readStdin();
  if (!input) {
    throw new Error("Expected call_model JSON arguments on stdin.");
  }

  const args = JSON.parse(input);
  const result = await handleToolCall({
    name: "call_model",
    arguments: args
  });

  stdout.write(result.content?.[0]?.text ?? "");
}

main().catch((error) => {
  console.error(error?.message ?? String(error));
  process.exitCode = 1;
});
