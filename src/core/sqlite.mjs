import { commandExists, runCommand } from "./command.mjs";

export async function sqliteJson(dbPath, query) {
  if (!(await commandExists("sqlite3"))) {
    throw new Error("sqlite3 command is required for this adapter");
  }
  const { stdout } = await runCommand("sqlite3", ["-json", dbPath, query], {
    timeout: 20000,
    maxBuffer: 1024 * 1024 * 24
  });
  if (!stdout.trim()) return [];
  return JSON.parse(stdout);
}

export async function sqliteTables(dbPath) {
  return sqliteJson(dbPath, "select name from sqlite_master where type='table' order by name;");
}
