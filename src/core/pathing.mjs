import os from "node:os";
import path from "node:path";

export function homeDir() {
  return process.env.HOME || os.homedir();
}

export function convolensHome() {
  return process.env.CONVOLENS_HOME || path.join(homeDir(), ".convolens");
}

export function expandHome(value) {
  if (!value) return value;
  if (value === "~") return homeDir();
  if (value.startsWith("~/")) return path.join(homeDir(), value.slice(2));
  return value;
}

export function toPosixPath(value) {
  return value.split(path.sep).join("/");
}
