import path from "node:path";
import { Adapter } from "./base.mjs";
import { CAPABILITIES, RISK, makeConversation, makeTurn } from "../core/schema.mjs";
import { exists, readJson, readJsonl, walkFiles } from "../core/fs-utils.mjs";
import { expandHome } from "../core/pathing.mjs";
import { truncate } from "../core/redact.mjs";

export class GenericAdapter extends Adapter {
  get id() {
    return "generic";
  }

  configPath() {
    return this.options.genericConfig || expandHome("~/.convolens/adapters.json");
  }

  async doctor() {
    const config = this.configPath();
    const available = await exists(config);
    return {
      provider: this.id,
      available,
      capabilities: available ? [CAPABILITIES.READ, CAPABILITIES.SIDECAR_ONLY] : [],
      risk: RISK.MEDIUM,
      paths: available ? [config] : [],
      notes: ["Generic adapter reads ~/.convolens/adapters.json. YAML support is on the roadmap; JSON is implemented in v0.1."]
    };
  }

  async scan() {
    const configPath = this.configPath();
    if (!(await exists(configPath))) return [];
    const config = await readJson(configPath, { adapters: [] });
    const conversations = [];
    for (const adapter of config.adapters || []) {
      const root = expandHome(adapter.root);
      if (!root || !(await exists(root))) continue;
      const suffixes = adapter.suffixes || [".jsonl", ".json", ".md"];
      const files = await walkFiles(root, { suffixes, maxDepth: adapter.maxDepth || 6 });
      for (const file of files.slice(0, adapter.limit || 500)) {
        conversations.push(await genericFileConversation(adapter, file));
      }
    }
    return conversations;
  }
}

async function genericFileConversation(adapter, file) {
  let text = "";
  if (file.endsWith(".jsonl")) {
    const rows = await readJsonl(file);
    text = rows.map((row) => JSON.stringify(row)).join("\n");
  } else {
    text = await import("node:fs/promises").then((fs) => fs.readFile(file, "utf8").catch(() => ""));
  }
  const stat = await import("node:fs/promises").then((fs) => fs.stat(file));
  return makeConversation({
    id: `${adapter.id || "generic"}:${file}`,
    provider: adapter.id || "generic",
    workspace: adapter.root || null,
    title: path.basename(file),
    createdAt: stat.birthtime.toISOString(),
    updatedAt: stat.mtime.toISOString(),
    sourcePath: file,
    writeCapability: CAPABILITIES.SIDECAR_ONLY,
    turns: [makeTurn({ role: "unknown", text: truncate(text, 900) })]
  });
}
