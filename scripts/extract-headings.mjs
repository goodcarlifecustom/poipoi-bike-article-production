import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function values(name) {
  return process.argv.flatMap((v, i, a) => v === `--${name}` ? [a[i + 1]] : []).filter(Boolean);
}
function arg(name) { return values(name)[0]; }
function textFrom(html) { return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

const slug = arg('slug');
const keyword = arg('keyword') || '';
const urls = values('url');
if (!slug) {
  console.error('Usage: npm run extract -- --slug slug --keyword "KW" --url https://...');
  process.exit(1);
}

const dir = path.join('articles', slug);
await mkdir(dir, { recursive: true });
let body = `# SERP・見出し調査\n\n- KW: ${keyword}\n\n`;
const csvRows = [['source_url', 'heading_level', 'heading_text']];
if (!urls.length) {
  body += '## 注意\n\n検索結果取得はCodexのブラウジングで実施してください。`reference_urls` がある場合は `--url` で指定できます。\n';
} else {
  body += '## 採用URLと見出し\n\n';
  for (const url of urls.slice(0, 3)) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 article-workflow' } });
      const html = await res.text();
      const headings = [...html.matchAll(/<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi)]
        .map((m) => {
          const level = `H${m[1]}`;
          const text = textFrom(m[2]);
          csvRows.push([url, level, text]);
          return `- ${level}: ${text}`;
        })
        .filter((line) => line.length > 7);
      body += `### ${url}\n\n採用理由: reference_urlsで指定されたため。\n\n${headings.join('\n') || '- H2/H3を抽出できませんでした'}\n\n`;
    } catch (e) {
      body += `### ${url}\n\n抽出失敗: ${e.message}\n\n`;
    }
  }
}
body += '\n## 除外URL\n\n- なし\n\n## 検索意図の要約\n\n- 記事作成時に上位見出しから整理してください。\n';
await writeFile(path.join(dir, 'serp.md'), body, 'utf8');
const csv = csvRows
  .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
  .join('\n') + '\n';
await writeFile(path.join(dir, 'headings.csv'), csv, 'utf8');
console.log(`Wrote ${path.join(dir, 'serp.md')}`);
