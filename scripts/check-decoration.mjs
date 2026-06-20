import { pathToFileURL } from 'node:url';
import { checkDecorationManifest } from './decoration-utils.mjs';
function arg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
export async function main() {
  const slug = arg('slug');
  if (!slug) { console.error('Usage: npm run check:decoration -- --slug slug'); process.exit(1); }
  try { const result = await checkDecorationManifest(slug); console.log(`# Decoration check PASS\n- slug: ${slug}\n- sha256: ${result.sha256}`); }
  catch (e) { console.error(`# Decoration check FAIL\n\n${e.message}`); process.exit(1); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
