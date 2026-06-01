import { main as cliMain } from "./cli.mjs";

export async function main(argv) {
  if (!argv.length) {
    throw new Error('Usage: rename-codex "New title" OR rename-codex <thread_id> "New title"');
  }
  if (argv.length === 1) {
    return cliMain(["rename", "latest", argv[0]]);
  }
  const [first, ...rest] = argv;
  const ref = first.includes(":") ? first : `codex:${first}`;
  return cliMain(["rename", ref, rest.join(" ")]);
}
