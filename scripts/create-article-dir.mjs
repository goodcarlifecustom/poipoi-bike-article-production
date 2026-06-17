import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const slug = arg('slug');
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('Usage: npm run create -- --slug article-slug');
  process.exit(1);
}

const dir = path.join('articles', slug);
await mkdir(dir, { recursive: true });
for (const file of ['input.yml', 'serp.md', 'headings.csv', 'heading-plan.md', 'draft.md', 'article.html', 'article-linked.html', 'article-decorated.html', 'external-links.md', 'check-report.md']) {
  const target = path.join(dir, file);
  if (!existsSync(target)) await writeFile(target, '', 'utf8');
}
console.log(`Created ${dir}`);
