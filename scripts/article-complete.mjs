import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
function arg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
async function runNode(script, slug) {
  const r = await execFileAsync('node', [path.join(scriptDir, script), '--slug', slug], { maxBuffer: 5 * 1024 * 1024, env: process.env });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r;
}
export async function main() {
  const slug = arg('slug');
  if (!slug) { console.error('Usage: npm run article:complete -- --slug slug'); process.exit(1); }
  try {
    await runNode('check-article.mjs', slug);
    await runNode('check-decoration.mjs', slug);
    await runNode('post-wp-draft.mjs', slug);
  } catch (e) {
    if (e.stdout) process.stdout.write(e.stdout);
    if (e.stderr) process.stderr.write(e.stderr);
    console.error(e.message);
    process.exit(e.code || 1);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
