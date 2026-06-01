const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\b[A-Za-z0-9_]*TOKEN[A-Za-z0-9_]*\s*=\s*[^ \n\r]+/gi,
  /\b[A-Za-z0-9_]*KEY[A-Za-z0-9_]*\s*=\s*[^ \n\r]+/gi,
  /\b(password|passwd|pwd)\s*[:=]\s*[^ \n\r]+/gi,
  /\b(cookie|authorization)\s*[:=]\s*[^ \n\r]+/gi
];

export function redactSecrets(text) {
  if (!text) return "";
  let output = String(text);
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, "[REDACTED]");
  }
  return output;
}

export function truncate(text, max = 1800) {
  const clean = redactSecrets(text || "");
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}...`;
}
