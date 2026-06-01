import fs from "node:fs/promises";
import path from "node:path";

export async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

export async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  const rows = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch (error) {
      rows.push({ __parseError: error.message, __line: index + 1, raw: line });
    }
  }
  return rows;
}

export async function walkFiles(root, options = {}) {
  const output = [];
  const maxDepth = options.maxDepth ?? 12;
  const suffixes = options.suffixes || null;

  async function visit(current, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(full, depth + 1);
      } else if (!suffixes || suffixes.some((suffix) => entry.name.endsWith(suffix))) {
        output.push(full);
      }
    }
  }

  await visit(root, 0);
  return output;
}
