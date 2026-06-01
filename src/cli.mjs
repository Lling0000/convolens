import { createServer } from "node:http";
import { createAdapters, adapterById } from "./adapters/registry.mjs";
import { IndexStore } from "./core/index-store.mjs";
import { generateTitleCandidate } from "./core/title-policy.mjs";
import { CAPABILITIES } from "./core/schema.mjs";
import { truncate } from "./core/redact.mjs";

export async function main(argv) {
  const [command, ...rest] = argv;
  switch (command || "help") {
    case "doctor":
      return doctor(rest);
    case "scan":
      return scan(rest);
    case "list":
      return list(rest);
    case "title":
      return title(rest);
    case "rename":
      return rename(rest);
    case "pin":
      return pin(rest);
    case "serve":
      return serve(rest);
    case "auto":
      return auto(rest);
    case "help":
    case "--help":
    case "-h":
      return help();
    default:
      throw new Error(`Unknown command: ${command}\nRun convolens help.`);
  }
}

async function doctor(argv) {
  const json = argv.includes("--json");
  const results = [];
  for (const adapter of createAdapters()) {
    results.push(await adapter.doctor());
  }
  if (json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  for (const item of results) {
    const flag = item.available ? "ok" : "--";
    console.log(`${flag} ${item.provider.padEnd(14)} ${item.capabilities.join(",") || "not found"}`);
    for (const note of item.notes || []) console.log(`   ${note}`);
    for (const p of item.paths || []) console.log(`   path: ${p}`);
  }
}

async function scan(argv) {
  const provider = valueAfter(argv, "--provider");
  const json = argv.includes("--json");
  const store = new IndexStore();
  const conversations = await scanProviders(provider);
  const index = await store.upsertConversations(conversations);
  if (json) console.log(JSON.stringify({ scanned: conversations.length, index }, null, 2));
  else console.log(`Scanned ${conversations.length} conversations into ${store.filePath}`);
}

async function list(argv) {
  const store = new IndexStore();
  const index = await store.load();
  const provider = valueAfter(argv, "--provider");
  const q = valueAfter(argv, "--q")?.toLowerCase();
  const status = valueAfter(argv, "--status");
  const json = argv.includes("--json");
  let rows = index.conversations || [];
  if (provider) rows = rows.filter((row) => row.provider === provider);
  if (status) rows = rows.filter((row) => row.status === status);
  if (q) {
    rows = rows.filter((row) => [
      row.title,
      row.canonicalTitle,
      row.summary,
      row.workspace,
      row.repo,
      JSON.stringify(row.metadata || {})
    ].join(" ").toLowerCase().includes(q));
  }
  if (json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  for (const row of rows.slice(0, Number(valueAfter(argv, "--limit") || 50))) {
    const title = truncate(row.canonicalTitle || row.title || "(untitled)", 140);
    console.log(`${row.provider}:${row.id}  ${title}`);
    if (row.workspace) console.log(`   workspace: ${row.workspace}`);
  }
}

async function title(argv) {
  const sub = argv[0];
  if (sub !== "preview") throw new Error("Only `convolens title preview` is implemented.");
  const store = new IndexStore();
  if (argv.includes("--all")) {
    await store.upsertConversations(await scanProviders(valueAfter(argv, "--provider")).catch(() => []));
  }
  const index = await store.load();
  const candidates = (index.conversations || []).map(generateTitleCandidate);
  if (argv.includes("--json")) {
    console.log(JSON.stringify(candidates, null, 2));
    return;
  }
  for (const candidate of candidates) {
    const marker = candidate.safeToApply ? "apply" : "sidecar";
    console.log(`${marker.padEnd(7)} ${candidate.provider}:${candidate.conversationId}`);
    console.log(`   old: ${candidate.currentTitle || "(none)"}`);
    console.log(`   new: ${candidate.title}`);
    console.log(`   why: ${candidate.reason}`);
  }
}

async function rename(argv) {
  if (argv.length < 2) {
    throw new Error('Usage: convolens rename latest "New title" OR convolens rename provider:id "New title"');
  }
  const ref = argv[0];
  const sidecar = argv.includes("--sidecar");
  const title = argv.slice(1).filter((item) => item !== "--sidecar").join(" ").trim();
  const store = new IndexStore();
  const index = await store.load();
  const conversation = resolveConversation(index.conversations || [], ref);
  if (!conversation) throw new Error(`Conversation not found: ${ref}. Run convolens scan first.`);

  const oldTitle = conversation.canonicalTitle || conversation.title;
  if (!sidecar && conversation.writeCapability === CAPABILITIES.RENAME_OFFICIAL) {
    const adapter = adapterById(conversation.provider);
    if (!adapter) throw new Error(`Adapter not found: ${conversation.provider}`);
    try {
      await adapter.rename(conversation.id, title);
      conversation.title = title;
    } catch (error) {
      console.error(`Official rename failed; storing sidecar title instead: ${error.message}`);
      conversation.canonicalTitle = title;
    }
  } else {
    conversation.canonicalTitle = title;
  }
  await store.upsertConversations([conversation]);
  await store.addAudit({
    action: "rename",
    provider: conversation.provider,
    conversationId: conversation.id,
    oldTitle,
    newTitle: title,
    mode: conversation.title === title ? "official" : "sidecar"
  });
  console.log(`${conversation.provider}:${conversation.id} -> ${title}`);
}

async function pin(argv) {
  const ref = argv[0];
  if (!ref) throw new Error("Usage: convolens pin provider:id");
  const store = new IndexStore();
  await store.pin(ref);
  console.log(`Pinned ${ref}`);
}

async function auto(argv) {
  const store = new IndexStore();
  await store.upsertConversations(await scanProviders(valueAfter(argv, "--provider")).catch(() => []));
  const index = await store.load();
  const candidates = (index.conversations || []).map(generateTitleCandidate).filter((item) => item.safeToApply);
  if (argv.includes("--apply")) {
    for (const candidate of candidates) {
      await rename([`${candidate.provider}:${candidate.conversationId}`, candidate.title, "--sidecar"]);
    }
  } else {
    console.log(JSON.stringify({ candidates, applyHint: "Run with --apply to store sidecar titles." }, null, 2));
  }
}

async function scanProviders(provider) {
  const adapters = provider ? [adapterById(provider)].filter(Boolean) : createAdapters();
  if (!adapters.length) throw new Error(`No adapter found for provider: ${provider}`);
  const conversations = [];
  for (const adapter of adapters) {
    const found = await adapter.scan();
    conversations.push(...found);
  }
  return conversations;
}

async function serve(argv) {
  const port = Number(valueAfter(argv, "--port") || 8765);
  const store = new IndexStore();
  const server = createServer(async (req, res) => {
    if (req.url === "/api/index") {
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify(await store.load(), null, 2));
      return;
    }
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(renderHtml(await store.load()));
  });
  server.listen(port, () => {
    console.log(`ConvoLens UI: http://localhost:${port}`);
  });
}

function resolveConversation(conversations, ref) {
  const sorted = [...conversations].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  if (ref === "latest") return sorted[0] || null;
  const [provider, ...idParts] = ref.split(":");
  const id = idParts.join(":");
  if (!id) return sorted.find((item) => item.id === ref) || null;
  return sorted.find((item) => item.provider === provider && item.id === id) || null;
}

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  if (index < 0) return null;
  return argv[index + 1] || null;
}

function help() {
  console.log(`ConvoLens

Usage:
  convolens doctor [--json]
  convolens scan [--provider codex] [--json]
  convolens list [--provider cursor] [--q "github auth"] [--json]
  convolens title preview --all [--json]
  convolens rename latest "New title"
  convolens rename codex:<thread_id> "New title"
  convolens pin provider:id
  convolens auto [--apply]
  convolens serve [--port 8765]
`);
}

function renderHtml(index) {
  const rows = (index.conversations || []).map((row) => {
    const title = escapeHtml(row.canonicalTitle || row.title || "(untitled)");
    return `<tr><td>${escapeHtml(row.provider)}</td><td>${title}</td><td>${escapeHtml(row.workspace || "")}</td><td>${escapeHtml(row.updatedAt || "")}</td></tr>`;
  }).join("");
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>ConvoLens</title>
<style>
body{font-family:Inter,system-ui,sans-serif;margin:24px;color:#161616;background:#f7f8fa}
table{border-collapse:collapse;width:100%;background:white}
th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}
th{background:#eef1f4}
</style></head><body>
<h1>ConvoLens</h1>
<p>Local-first AI coding conversation index.</p>
<table><thead><tr><th>Provider</th><th>Title</th><th>Workspace</th><th>Updated</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}
