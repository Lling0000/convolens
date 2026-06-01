import path from "node:path";
import { makeTitleCandidate } from "./schema.mjs";
import { redactSecrets } from "./redact.mjs";

const ACTION_WORDS = [
  "安装",
  "配置",
  "实现",
  "审计",
  "部署",
  "上传",
  "总结",
  "排查",
  "迁移",
  "设计",
  "读取",
  "解析",
  "生成",
  "修复",
  "发布",
  "验证",
  "整理",
  "规划",
  "创建"
];

const BAD_GENERIC_TITLES = new Set([
  "优化项目",
  "解决问题",
  "整理内容",
  "讨论方案",
  "继续",
  "新聊天",
  "new-chat",
  "untitled"
]);

const STATUS_HINTS = [
  ["阻塞", /阻塞|失败|连不上|permission denied|not found|auth|认证|权限/i],
  ["已完成", /完成|已实现|成功|通过|done|passed/i],
  ["方案设计", /方案|计划|设计|架构|roadmap|plan/i],
  ["只读分析", /不要改|只读|分析|审计|review/i],
  ["待认证", /登录|认证|授权|token|key|credential/i]
];

export function isBadTitle(title, firstUserMessage = "") {
  if (!title) return true;
  const normalized = title.trim();
  if (BAD_GENERIC_TITLES.has(normalized.toLowerCase())) return true;
  if (normalized.startsWith("/goal")) return true;
  if (normalized.length > 80) return true;
  if (normalized.includes("\n")) return true;
  if (firstUserMessage && normalized === firstUserMessage.trim()) return true;
  return !ACTION_WORDS.some((word) => normalized.includes(word)) && normalized.length < 8;
}

export function generateTitleCandidate(conversation) {
  const text = [
    conversation.title || "",
    conversation.summary || "",
    ...conversation.turns.slice(0, 8).map((turn) => turn.text || "")
  ].join("\n");

  const object = pickObject(conversation, text);
  const action = pickAction(text);
  const status = pickStatus(text);
  const base = compactTitle(`${object}：${action}${status ? status : ""}`);
  const firstUser = conversation.turns.find((turn) => turn.role === "user")?.text || "";
  const bad = isBadTitle(conversation.title, firstUser);
  const confidence = object !== "AI 对话" && action !== "整理" ? 0.82 : 0.58;

  return makeTitleCandidate({
    conversationId: conversation.id,
    provider: conversation.provider,
    currentTitle: redactSecrets(conversation.title || ""),
    title: base,
    reason: bad
      ? "Current title is hard to search, too long, generic, or copied from the first prompt."
      : "Generated as a searchable sidecar title; current title is not automatically overwritten.",
    confidence,
    sourceSignals: [object, action, status].filter(Boolean),
    safeToApply: bad && confidence >= 0.72
  });
}

function pickObject(conversation, text) {
  const candidates = [];
  const named = [
    "ProofRoute",
    "GitHub CLI",
    "Codex",
    "Claude Code",
    "Cursor",
    "Antigravity",
    "Trae",
    "Qoder",
    "CodeBuddy",
    "CloudBase",
    "Langfuse",
    "Promptfoo",
    "DeepEval",
    "Ragas"
  ];
  for (const name of named) {
    if (text.toLowerCase().includes(name.toLowerCase())) candidates.push(name);
  }
  if (conversation.repo) candidates.push(conversation.repo);
  if (conversation.workspace) {
    const workspaceName = path.basename(conversation.workspace);
    if (!isGenericWorkspace(workspaceName)) candidates.push(workspaceName);
  }
  const projectPath = text.match(/\/Users\/[^\s，。]+\/([^\/\s，。]+)/);
  if (projectPath) candidates.push(projectPath[1]);
  return cleanObject(candidates.find(Boolean) || providerLabel(conversation.provider));
}

function isGenericWorkspace(value) {
  return /^(new[-_ ]?chat|test|tmp|temp|untitled|\d+|python3|node)$/i.test(String(value || ""));
}

function providerLabel(provider) {
  const labels = {
    codex: "Codex",
    "claude-code": "Claude Code",
    cursor: "Cursor",
    antigravity: "Antigravity",
    trae: "Trae",
    qoder: "Qoder",
    "codebuddy-ide": "CodeBuddy",
    "cloudbase-ai": "CloudBase"
  };
  return labels[provider] || "AI 对话";
}

function pickAction(text) {
  for (const word of ACTION_WORDS) {
    if (text.includes(word)) return word;
  }
  if (/install|download/i.test(text)) return "安装";
  if (/deploy|publish/i.test(text)) return "部署";
  if (/review|audit/i.test(text)) return "审计";
  if (/read|parse/i.test(text)) return "解析";
  return "整理";
}

function pickStatus(text) {
  for (const [label, pattern] of STATUS_HINTS) {
    if (pattern.test(text)) return label;
  }
  return "";
}

function cleanObject(value) {
  return String(value || "AI 对话").replace(/^goal-/, "").replace(/[_-]+/g, " ").trim().slice(0, 24);
}

function compactTitle(value) {
  return value.replace(/\s+/g, " ").replace(/：整理$/, "：整理对话").slice(0, 34);
}

export function titlePassesPolicy(title) {
  if (!title || title.length > 40 || title.includes("\n")) return false;
  if (BAD_GENERIC_TITLES.has(title.trim().toLowerCase())) return false;
  return title.includes("：") && ACTION_WORDS.some((word) => title.includes(word));
}
