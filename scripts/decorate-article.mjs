import { pathToFileURL } from 'node:url';
import { writeDecorationManifest } from './decoration-utils.mjs';
function arg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
export async function main() {
  const slug = arg('slug');
  if (!slug) { console.error('Usage: npm run decorate -- --slug slug'); process.exit(1); }
  try { const manifest = await writeDecorationManifest(slug); console.log(`# Decoration manifest written\n- slug: ${slug}\n- sha256: ${manifest.sha256}`); }
  catch (e) { console.error(`# Decoration validation failed\n\n${e.message}`); process.exit(1); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
