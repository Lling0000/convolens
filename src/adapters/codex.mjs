import path from "node:path";
import { Adapter } from "./base.mjs";
import { CAPABILITIES, RISK, makeConversation, makeTurn } from "../core/schema.mjs";
import { exists, readJsonl, walkFiles } from "../core/fs-utils.mjs";
import { homeDir } from "../core/pathing.mjs";
import { sqliteJson } from "../core/sqlite.mjs";
import { redactSecrets, truncate } from "../core/redact.mjs";
import { AppServerClient } from "../core/app-server-client.mjs";

export class CodexAdapter extends Adapter {
  get id() {
    return "codex";
  }

  stateDbPath() {
    return this.options.codexStateDb || path.join(homeDir(), ".codex", "state_5.sqlite");
  }

  sessionsRoot() {
    return this.options.codexSessionsRoot || path.join(homeDir(), ".codex", "sessions");
  }

  async doctor() {
    const stateDb = this.stateDbPath();
    const sessionsRoot = this.sessionsRoot();
    const paths = [];
    if (await exists(stateDb)) paths.push(stateDb);
    if (await exists(sessionsRoot)) paths.push(sessionsRoot);
    const capabilities = paths.length ? [CAPABILITIES.READ, CAPABILITIES.SEARCH, CAPABILITIES.RENAME_OFFICIAL] : [];
    return {
      provider: this.id,
      available: paths.length > 0,
      capabilities,
      risk: RISK.LOW,
      paths,
      notes: [
        "Preferred write path is Codex app-server thread/name/set.",
        "SQLite is read for discovery only and is not the default write path."
      ]
    };
  }

  async scan() {
    const stateDb = this.stateDbPath();
    if (!(await exists(stateDb))) return [];
    const rows = await sqliteJson(stateDb, `
      select id, title, cwd, git_origin_url, rollout_path, first_user_message,
             preview, created_at, updated_at, archived
      from threads
      where archived = 0
      order by updated_at desc
    `);
    return Promise.all(rows.map((row) => this.rowToConversation(row)));
  }

  async rowToConversation(row) {
    const turns = [];
    const first = row.first_user_message || row.preview;
    if (first) turns.push(makeTurn({ role: "user", text: truncate(first), timestamp: row.created_at }));
    if (row.rollout_path && await exists(row.rollout_path)) {
      turns.push(...await extractCodexTurns(row.rollout_path));
    }
    return makeConversation({
      id: row.id,
      provider: this.id,
      workspace: row.cwd,
      repo: repoName(row.git_origin_url),
      title: redactSecrets(row.title || ""),
      createdAt: fromUnix(row.created_at),
      updatedAt: fromUnix(row.updated_at),
      sourcePath: row.rollout_path,
      writeCapability: CAPABILITIES.RENAME_OFFICIAL,
      turns,
      metadata: { sqliteState: this.stateDbPath() }
    });
  }

  async scanSessionFiles(limit = 2000) {
    const root = this.sessionsRoot();
    if (!(await exists(root))) return [];
    const files = (await walkFiles(root, { suffixes: [".jsonl"], maxDepth: 8 })).slice(0, limit);
    return files;
  }

  async rename(conversationId, title) {
    const client = new AppServerClient();
    try {
      await client.initialize();
      await client.request("thread/name/set", { threadId: conversationId, name: title });
      return { ok: true, provider: this.id, conversationId, title };
    } finally {
      await client.close();
    }
  }
}

async function extractCodexTurns(filePath) {
  const rows = await readJsonl(filePath);
  const turns = [];
  for (const row of rows) {
    const payload = row.payload || {};
    if (row.type === "response_item" && payload.type === "message") {
      const role = payload.role || "assistant";
      const text = (payload.content || [])
        .map((item) => item.text || item.output_text || "")
        .join("\n")
        .trim();
      if (text) turns.push(makeTurn({ role, text: truncate(text, 900), timestamp: row.timestamp }));
    }
    if (row.type === "event_msg" && payload.type === "thread_goal_updated") {
      turns.push(makeTurn({ role: "goal", text: truncate(payload.goal?.objective || "", 900), timestamp: row.timestamp }));
    }
  }
  return turns.slice(0, 12);
}

function fromUnix(value) {
  if (!value) return null;
  return new Date(Number(value) * 1000).toISOString();
}

function repoName(url) {
  if (!url) return null;
  const match = String(url).match(/([^/:]+\/[^/]+?)(?:\.git)?$/);
  return match ? match[1] : null;
}
