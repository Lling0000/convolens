import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { IndexStore } from "../src/core/index-store.mjs";

test("upserts conversations and preserves audit log", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "convolens-index-"));
  const store = new IndexStore(path.join(dir, "index.json"));
  await store.upsertConversations([{ provider: "codex", id: "a", title: "Old" }]);
  await store.upsertConversations([{ provider: "codex", id: "a", title: "New" }]);
  await store.addAudit({ action: "rename", provider: "codex", conversationId: "a" });
  const index = await store.load();
  assert.equal(index.conversations.length, 1);
  assert.equal(index.conversations[0].title, "New");
  assert.equal(index.audit.length, 1);
});
