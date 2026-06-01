import { execFile } from "node:child_process";

export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      timeout: options.timeout || 15000,
      maxBuffer: options.maxBuffer || 1024 * 1024 * 8
    }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export async function commandExists(command) {
  try {
    await runCommand("which", [command], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}
