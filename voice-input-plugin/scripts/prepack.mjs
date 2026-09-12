import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "..");

await mkdir(join(packageRoot, "lib"), { recursive: true });
await mkdir(join(packageRoot, "python"), { recursive: true });
await copyFile(join(packageRoot, "host.js"), join(packageRoot, "lib", "index.js"));
await copyFile(join(packageRoot, "client.js"), join(packageRoot, "lib", "client.js"));
await copyFile(join(repositoryRoot, ".voice-asr", "transcribe.py"), join(packageRoot, "python", "transcribe.py"));
await copyFile(join(packageRoot, "requirements.txt"), join(packageRoot, "python", "requirements.txt"));

const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
if (manifest.version !== "1.2.0") throw new Error("prepack: expected version 1.2.0");
if (manifest.dsh?.bundle?.patch !== "./cordis.patch.yml") throw new Error("prepack: missing dsh.bundle.patch");
const patch = await readFile(join(packageRoot, "cordis.patch.yml"), "utf8");
if (!patch.includes("id: voice-input") || !patch.includes("dsh-plugin-voice-input")) throw new Error("prepack: invalid bundle patch");
for (const filename of ["lib/index.js", "lib/client.js", "python/transcribe.py"]) {
  const text = await readFile(join(packageRoot, filename), "utf8");
  if (/C:\\Users\\|D:\\Codex\\|sk-[A-Za-z0-9_-]{12,}/i.test(text)) throw new Error(`prepack: private data found in ${filename}`);
}
