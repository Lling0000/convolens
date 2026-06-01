import { CodexAdapter } from "./codex.mjs";
import { ClaudeCodeAdapter } from "./claude-code.mjs";
import { CursorAdapter } from "./cursor.mjs";
import { DiscoveryAdapter } from "./discovery.mjs";
import { GenericAdapter } from "./generic.mjs";

export function createAdapters(options = {}) {
  return [
    new CodexAdapter(options),
    new ClaudeCodeAdapter(options),
    new CursorAdapter(options),
    new DiscoveryAdapter({
      ...options,
      id: "antigravity",
      label: "Google Antigravity",
      candidatePaths: [
        "~/.antigravity",
        "~/Library/Application Support/Antigravity",
        "~/Library/Application Support/Google/Antigravity"
      ]
    }),
    new DiscoveryAdapter({
      ...options,
      id: "trae",
      label: "Trae",
      candidatePaths: ["~/.trae", "~/Library/Application Support/Trae", "~/Library/Application Support/Trae CN"]
    }),
    new DiscoveryAdapter({
      ...options,
      id: "qoder",
      label: "Qoder",
      candidatePaths: ["~/.qoder", "~/Library/Application Support/Qoder"]
    }),
    new DiscoveryAdapter({
      ...options,
      id: "codebuddy-ide",
      label: "Tencent CodeBuddy",
      candidatePaths: ["~/.codebuddy", "~/Library/Application Support/CodeBuddy"]
    }),
    new DiscoveryAdapter({
      ...options,
      id: "cloudbase-ai",
      label: "Tencent CloudBase",
      candidatePaths: ["~/.cloudbase", ".cloudbase", "cloudbase.json"]
    }),
    new GenericAdapter(options)
  ];
}

export function adapterById(id, options = {}) {
  return createAdapters(options).find((adapter) => adapter.id === id);
}
