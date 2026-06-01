import path from "node:path";
import { Adapter } from "./base.mjs";
import { CAPABILITIES, RISK, makeConversation, makeTurn } from "../core/schema.mjs";
import { exists, walkFiles } from "../core/fs-utils.mjs";
import { homeDir } from "../core/pathing.mjs";
import { sqliteJson, sqliteTables } from "../core/sqlite.mjs";
import { redactSecrets, truncate } from "../core/redact.mjs";

export class CursorAdapter extends Adapter {
  get id() {
    return "cursor";
  }

  candidateRoots() {
    return this.options.cursorRoots || [
      path.join(homeDir(), "Library", "Application Support", "Cursor"),
      path.join(homeDir(), ".cursor")
    ];
  }

  async doctor() {
    const paths = [];
    for (const root of this.candidateRoots()) {
      if (await exists(root)) paths.push(root);
    }
    return {
      provider: this.id,
      available: paths.length > 0,
      capabilities: paths.length ? [CAPABILITIES.READ, CAPABILITIES.SEARCH, CAPABILITIES.SIDECAR_ONLY] : [],
      risk: RISK.MEDIUM,
      paths,
      notes: [
        "Cursor history storage varies by version. ConvoLens reads likely SQLite stores only after schema detection.",
        "Write-back is disabled in v0.1; use Cursor UI title editing or sidecar titles."
      ]
    };
  }

  async scan() {
    const dbs = [];
    for (const root of this.candidateRoots()) {
      if (await exists(root)) {
        dbs.push(...await walkFiles(root, { suffixes: [".sqlite", ".db", ".vscdb"], maxDepth: 8 }));
      }
    }
    const conversations = [];
    for (const db of dbs.slice(0, 20)) {
      const found = await scanCursorDb(db).catch(() => []);
      conversations.push(...found);
    }
    return conversations;
  }
}

async function scanCursorDb(dbPath) {
  const tables = await sqliteTables(dbPath);
  const names = tables.map((row) => row.name);
  const candidate = names.find((name) => /chat|conversation|composer/i.test(name));
  if (!candidate) return [];
  const columns = await sqliteJson(dbPath, `pragma table_info(${JSON.stringify(candidate)});`);
  const columnNames = columns.map((row) => row.name);
  const idColumn = pick(columnNames, ["id", "conversationId", "chatId", "uuid"]) || "rowid";
  const titleColumn = pick(columnNames, ["title", "name", "summary"]);
  const textColumn = pick(columnNames, ["text", "content", "messages", "data", "json"]);
  const updatedColumn = pick(columnNames, ["updatedAt", "updated_at", "lastUpdated", "timestamp", "createdAt", "created_at"]);
  if (!textColumn && !titleColumn) return [];
  const rows = await sqliteJson(dbPath, `
    select ${safeIdent(idColumn)} as id,
           ${titleColumn ? safeIdent(titleColumn) : "null"} as title,
           ${textColumn ? safeIdent(textColumn) : "null"} as body,
           ${updatedColumn ? safeIdent(updatedColumn) : "null"} as updated
    from ${safeIdent(candidate)}
    limit 200
  `);
  return rows.map((row, index) => makeConversation({
    id: String(row.id || `${dbPath}:${index}`),
    provider: "cursor",
    title: redactSecrets(row.title || "Cursor conversation"),
    updatedAt: normalizeTime(row.updated),
    sourcePath: dbPath,
    writeCapability: CAPABILITIES.SIDECAR_ONLY,
    turns: row.body ? [makeTurn({ role: "unknown", text: truncate(extractBody(row.body), 900) })] : [],
    metadata: { table: candidate }
  }));
}

function pick(columns, candidates) {
  const lower = new Map(columns.map((column) => [column.toLowerCase(), column]));
  for (const candidate of candidates) {
    if (lower.has(candidate.toLowerCase())) return lower.get(candidate.toLowerCase());
  }
  return null;
}

function safeIdent(value) {
  if (value === "rowid") return "rowid";
  return `"${String(value).replaceAll('"', '""')}"`;
}

function extractBody(value) {
  if (typeof value !== "string") return String(value || "");
  try {
    const parsed = JSON.parse(value);
    return JSON.stringify(parsed).slice(0, 2000);
  } catch {
    return value;
  }
}

function normalizeTime(value) {
  if (!value) return null;
  if (typeof value === "number" && value > 1000000000000) return new Date(value).toISOString();
  if (typeof value === "number") return new Date(value * 1000).toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
