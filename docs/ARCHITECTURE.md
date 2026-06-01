# Architecture

ConvoLens has three layers:

1. Core index and title policy.
2. Provider adapters.
3. CLI and local UI.

Adapters are intentionally capability-based. A provider can support read-only
indexing without supporting write-back rename. This prevents ConvoLens from
pretending that every AI coding tool has the same storage model.

## Data model

- `Provider`: a concrete tool family such as `codex`, `claude-code`, or `cursor`.
- `Conversation`: normalized metadata plus selected turns.
- `Turn`: minimal role/text/tool metadata.
- `TitleCandidate`: deterministic or model-assisted title proposal.
- `AdapterCapability`: `read`, `search`, `renameOfficial`, `renameLocal`,
  `sidecarOnly`, `watch`.

## Write safety

Default writes go to the ConvoLens sidecar index. Provider write-back requires
one of these:

- Official protocol or CLI, such as Codex app-server `thread/name/set`.
- Verified local schema with backup and rollback.
- User-supplied generic adapter config that explicitly opts into mutation.

SQLite is never treated as stable product API unless an adapter proves the
schema for the current installed version.
