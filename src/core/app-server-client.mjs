import { spawn } from "node:child_process";

export class AppServerClient {
  constructor(options = {}) {
    this.command = options.command || "codex";
    this.args = options.args || ["app-server", "--listen", "stdio://"];
    this.timeoutMs = options.timeoutMs || 10000;
    this.proc = null;
    this.nextId = 1;
    this.buffer = "";
    this.pending = new Map();
  }

  start() {
    if (this.proc) return;
    this.proc = spawn(this.command, this.args, {
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.proc.stdout.on("data", (chunk) => this.handleStdout(chunk));
    this.proc.stderr.on("data", () => {});
    this.proc.on("exit", () => {
      for (const { reject } of this.pending.values()) {
        reject(new Error("app-server exited before responding"));
      }
      this.pending.clear();
    });
  }

  async initialize() {
    await this.request("initialize", {
      clientInfo: { name: "convolens", title: "ConvoLens", version: "0.1.0" },
      capabilities: {
        experimentalApi: true,
        requestAttestation: false,
        optOutNotificationMethods: []
      }
    });
  }

  async request(method, params) {
    this.start();
    const id = this.nextId++;
    const payload = { id, method, params };
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`app-server request timed out: ${method}`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
    this.proc.stdin.write(`${JSON.stringify(payload)}\n`);
    return promise;
  }

  handleStdout(chunk) {
    this.buffer += chunk.toString("utf8");
    let newline;
    while ((newline = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(message, "id")) continue;
      const pending = this.pending.get(message.id);
      if (!pending) continue;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result ?? message);
    }
  }

  async close() {
    if (!this.proc) return;
    this.proc.kill();
    this.proc = null;
  }
}
