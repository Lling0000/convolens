import path from "node:path";
import { Adapter } from "./base.mjs";
import { CAPABILITIES, RISK, makeConversation, makeTurn } from "../core/schema.mjs";
import { exists, readJsonl, walkFiles } from "../core/fs-utils.mjs";
import { homeDir } from "../core/pathing.mjs";
import { redactSecrets, truncate } from "../core/redact.mjs";

export class ClaudeCodeAdapter extends Adapter {
  get id() {
    return "claude-code";
  }

  projectsRoot() {
    return this.options.claudeProjectsRoot || path.join(homeDir(), ".claude", "projects");
  }

  async doctor() {
    const root = this.projectsRoot();
    const available = await exists(root);
    return {
      provider: this.id,
      available,
      capabilities: available ? [CAPABILITIES.READ, CAPABILITIES.SEARCH, CAPABILITIES.SIDECAR_ONLY] : [],
      risk: RISK.LOW,
      paths: available ? [root] : [],
      notes: ["Read-only JSONL transcript adapter. Rename writes are sidecar-only until an official API is verified."]
    };
  }

  async scan() {
    const root = this.projectsRoot();
    if (!(await exists(root))) return [];
    const files = await walkFiles(root, { suffixes: [".jsonl"], maxDepth: 6 });
    const conversations = [];
    for (const file of files) {
      const rows = await readJsonl(file);
      const turns = rowsToTurns(rows);
      const stat = await import("node:fs/promises").then((fs) => fs.stat(file));
      conversations.push(makeConversation({
        id: path.basename(file, ".jsonl"),
        provider: this.id,
        workspace: inferWorkspace(root, file),
        title: redactSecrets(firstUserLine(turns) || path.basename(file, ".jsonl")),
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
        sourcePath: file,
        writeCapability: CAPABILITIES.SIDECAR_ONLY,
        turns
      }));
    }
    return conversations;
  }
}

function rowsToTurns(rows) {
  const turns = [];
  for (const row of rows) {
    const message = row.message || row;
    const role = message.role || row.role;
    const content = message.content || row.content || row.text;
    const text = Array.isArray(content)
      ? content.map((item) => item.text || item.content || "").join("\n")
      : String(content || "");
    if (role && text.trim()) {
      turns.push(makeTurn({ role, text: truncate(text, 900), timestamp: row.timestamp || row.created_at }));
    }
  }
  return turns.slice(0, 16);
}

function inferWorkspace(root, file) {
  const relative = path.relative(root, file);
  const folder = relative.split(path.sep)[0];
  return folder ? folder.replace(/-/g, "/") : null;
}

function firstUserLine(turns) {
  return turns.find((turn) => turn.role === "user")?.text?.split(/\r?\n/)[0]?.slice(0, 80) || null;
}
