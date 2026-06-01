import path from "node:path";
import { convolensHome } from "./pathing.mjs";
import { ensureDir, readJson, writeJson } from "./fs-utils.mjs";

export class IndexStore {
  constructor(filePath = path.join(convolensHome(), "index.json")) {
    this.filePath = filePath;
  }

  async load() {
    return readJson(this.filePath, { version: 1, conversations: [], pins: [], audit: [] });
  }

  async save(index) {
    await ensureDir(path.dirname(this.filePath));
    await writeJson(this.filePath, {
      version: 1,
      conversations: index.conversations || [],
      pins: index.pins || [],
      audit: index.audit || []
    });
  }

  async upsertConversations(conversations) {
    const index = await this.load();
    const byKey = new Map(index.conversations.map((item) => [`${item.provider}:${item.id}`, item]));
    for (const conversation of conversations) {
      byKey.set(`${conversation.provider}:${conversation.id}`, {
        ...byKey.get(`${conversation.provider}:${conversation.id}`),
        ...conversation
      });
    }
    index.conversations = Array.from(byKey.values()).sort((a, b) => {
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
    await this.save(index);
    return index;
  }

  async addAudit(entry) {
    const index = await this.load();
    index.audit = index.audit || [];
    index.audit.push({ ...entry, timestamp: new Date().toISOString() });
    await this.save(index);
  }

  async pin(ref) {
    const index = await this.load();
    index.pins = Array.from(new Set([...(index.pins || []), ref]));
    await this.save(index);
  }
}
