import test from "node:test";
import assert from "node:assert/strict";
import { redactSecrets } from "../src/core/redact.mjs";
import { generateTitleCandidate } from "../src/core/title-policy.mjs";
import { makeConversation } from "../src/core/schema.mjs";

test("redacts common secret patterns", () => {
  const text = "OPENAI_API_KEY=redacted-placeholder-token password=redacted-placeholder-password";
  const redacted = redactSecrets(text);
  assert.doesNotMatch(redacted, /redacted-placeholder-password/);
  assert.doesNotMatch(redacted, /redacted-placeholder-token/);
});

test("redacts current title in previews", () => {
  const candidate = generateTitleCandidate(makeConversation({
    id: "secret",
    provider: "codex",
    title: "OPENAI_API_KEY=redacted-placeholder-token"
  }));
  assert.doesNotMatch(candidate.currentTitle, /redacted-placeholder-token/);
});
