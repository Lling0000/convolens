# ConvoLens

ConvoLens is a local-first AI coding conversation indexer and title governor.
It scans conversation histories across AI coding tools, builds a unified index,
generates searchable titles, and writes titles back only when an adapter has a
safe official or verified write path.

The project starts with AI coding tools rather than general chat products:
Codex, Claude Code, Cursor, Google Antigravity, Trae, Qoder, Tencent CodeBuddy,
and Tencent CloudBase-style AI conversations.

## Why this exists

AI coding tools create valuable long-running work traces, but the left-side
history often becomes hard to search: giant first prompts, generic titles,
missing status, no cross-tool index, and inconsistent filtering. ConvoLens turns
those traces into a searchable local index with stable titles such as:

```text
ProofRoute: implement LLM router
GitHub CLI: browser auth blocked
Claude Code: parse JSONL history
Cursor: read local Chat SQLite
```

## Principles

- Local-first: no full conversation upload by default.
- Adapter matrix: read what can be read, write only through official or verified paths.
- Sidecar-safe: when a tool cannot be safely renamed, ConvoLens stores its own canonical title.
- Deterministic fallback: title generation works without an LLM.
- Privacy-aware: common tokens, keys, cookies, and passwords are redacted before indexing.

## Install locally

```bash
npm install
npm link
convolens doctor
```

This repository intentionally has no runtime npm dependencies in v0.1.

## CLI

```bash
convolens doctor
convolens scan
convolens list --provider codex --q "github auth"
convolens title preview --all
convolens rename latest "Codex: design title governance"
convolens rename codex:<thread_id> "Codex: title governance system"
convolens pin codex:<thread_id>
convolens auto
convolens serve --port 8765
```

`rename-codex` is a convenience alias:

```bash
rename-codex "Codex: automatic title governance"
rename-codex <thread_id> "Codex: app-server rename"
```

## Adapter matrix

| Provider | v0.1 behavior | Write-back |
| --- | --- | --- |
| Codex | Reads local state and sessions; prefers app-server `thread/name/set` for rename | Official path attempted, sidecar fallback |
| Claude Code | Reads `~/.claude/projects/**/*.jsonl` transcripts | Sidecar only |
| Cursor | Discovers local app folders and probes SQLite schemas | Sidecar only in v0.1 |
| Antigravity | Discovery adapter for known local paths | Sidecar only |
| Trae | Discovery adapter for known local paths | Sidecar only |
| Qoder | Discovery adapter for known local paths | Sidecar only |
| CodeBuddy | Discovery adapter for known local paths | Sidecar only |
| CloudBase | Discovery adapter for local app/project config | Sidecar only |
| Generic | Reads configured JSONL/JSON/Markdown files from `~/.convolens/adapters.json` | Sidecar only |

## Generic adapter

Create `~/.convolens/adapters.json`:

```json
{
  "adapters": [
    {
      "id": "my-agent",
      "root": "~/Library/Application Support/MyAgent",
      "suffixes": [".jsonl", ".json", ".md"],
      "maxDepth": 6,
      "limit": 500
    }
  ]
}
```

## Title policy

A title must be searchable. It should contain an object and an action, with a
status when useful:

```text
<project/tool/domain>: <action><status>
```

Bad titles are not automatically trusted:

- `/goal ...`
- titles longer than 80 characters
- multiline titles
- titles copied from the first prompt
- `new-chat`, `untitled`, `continue`
- generic titles such as "optimize project" or "solve problem"

## Automation model

`convolens auto` scans and generates candidates. It only auto-applies sidecar
titles for obviously bad titles unless a future adapter explicitly proves a safe
write path. Normal titles remain preview-only until a user confirms them.

## Roadmap

- v0.1: core index, Codex/Claude/Cursor discovery and read adapters, title preview, sidecar rename.
- v0.2: local web UI with confirmation, pin/keep rules, batch history cleanup.
- v0.3: Antigravity, Trae, Qoder, CodeBuddy deeper discovery adapters.
- v0.4: adapter YAML and community adapter templates.
- v0.5: MCP server for cross-tool conversation search from Codex, Claude Code, and Cursor.
- v1.0: stable read/search/title governance/export/backup/rollback/plugin ecosystem.

## References

- Cursor History: https://docs.cursor.com/agent/chat/history
- Claude Code directory: https://code.claude.com/docs/en/claude-directory
- Antigravity conversations: https://antigravity.google/docs/cli-conversations
- Qoder chat overview: https://docs.qoder.com/user-guide/chat/overview
- Tencent CodeBuddy history: https://copilot.tencent.com/docs/ide/History
- Tencent CloudBase multi-conversations: https://docs.cloudbase.net/en/ai/agent/multi-conversations
- Trae docs: https://traeide.com/docs
