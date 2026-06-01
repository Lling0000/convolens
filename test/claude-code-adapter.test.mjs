import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ClaudeCodeAdapter } from "../src/adapters/claude-code.mjs";

test("reads Claude Code JSONL transcripts", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "convolens-claude-"));
  const project = path.join(root, "Users-example-Repo");
  await fs.mkdir(project, { recursive: true });
  await fs.writeFile(path.join(project, "session.jsonl"), [
    JSON.stringify({ timestamp: "2026-01-01T00:00:00Z", message: { role: "user", content: "请读取项目并总结架构" } }),
    JSON.stringify({ timestamp: "2026-01-01T00:01:00Z", message: { role: "assistant", content: "已总结架构。" } })
  ].join("\n"));
  const adapter = new ClaudeCodeAdapter({ claudeProjectsRoot: root });
  const conversations = await adapter.scan();
  assert.equal(conversations.length, 1);
  assert.equal(conversations[0].provider, "claude-code");
  assert.match(conversations[0].turns[0].text, /读取项目/);
});
