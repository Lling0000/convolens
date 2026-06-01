export const CAPABILITIES = Object.freeze({
  READ: "read",
  SEARCH: "search",
  RENAME_OFFICIAL: "renameOfficial",
  RENAME_LOCAL: "renameLocal",
  SIDECAR_ONLY: "sidecarOnly",
  WATCH: "watch"
});

export const RISK = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high"
});

export const PROVIDERS = Object.freeze([
  "codex",
  "claude-code",
  "cursor",
  "antigravity",
  "trae",
  "qoder",
  "codebuddy-ide",
  "cloudbase-ai",
  "generic"
]);

export function makeConversation(input) {
  return {
    id: input.id,
    provider: input.provider,
    workspace: input.workspace || null,
    repo: input.repo || null,
    title: input.title || null,
    canonicalTitle: input.canonicalTitle || null,
    summary: input.summary || null,
    status: input.status || "unknown",
    createdAt: input.createdAt || null,
    updatedAt: input.updatedAt || null,
    sourcePath: input.sourcePath || null,
    writeCapability: input.writeCapability || CAPABILITIES.SIDECAR_ONLY,
    turns: input.turns || [],
    metadata: input.metadata || {}
  };
}

export function makeTurn(input) {
  return {
    role: input.role || "unknown",
    text: input.text || "",
    toolCalls: input.toolCalls || [],
    filesTouched: input.filesTouched || [],
    commands: input.commands || [],
    timestamp: input.timestamp || null
  };
}

export function makeTitleCandidate(input) {
  return {
    conversationId: input.conversationId,
    provider: input.provider,
    title: input.title,
    reason: input.reason,
    confidence: input.confidence,
    sourceSignals: input.sourceSignals || [],
    safeToApply: Boolean(input.safeToApply),
    currentTitle: input.currentTitle || null
  };
}
