import test from "node:test";
import assert from "node:assert/strict";
import { generateTitleCandidate, isBadTitle, titlePassesPolicy } from "../src/core/title-policy.mjs";
import { makeConversation, makeTurn } from "../src/core/schema.mjs";

test("detects bad titles copied from goals and long prompts", () => {
  assert.equal(isBadTitle("/goal build everything"), true);
  assert.equal(isBadTitle("new-chat"), true);
  assert.equal(isBadTitle("a".repeat(81)), true);
  assert.equal(isBadTitle("GitHub CLI：配置认证"), false);
});

test("generates searchable project plus action title", () => {
  const candidate = generateTitleCandidate(makeConversation({
    id: "1",
    provider: "codex",
    workspace: "/Users/example/Documents/ProofRoute",
    title: "/goal long initial prompt",
    turns: [
      makeTurn({ role: "user", text: "帮我实现 ProofRoute 的 LLM 路由器，然后验证 GitHub 发布。" })
    ]
  }));
  assert.match(candidate.title, /^ProofRoute：/);
  assert.equal(candidate.safeToApply, true);
});

test("policy rejects vague titles", () => {
  assert.equal(titlePassesPolicy("优化项目"), false);
  assert.equal(titlePassesPolicy("Cursor：读取历史"), true);
});
