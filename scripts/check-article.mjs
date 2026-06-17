import { readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function yamlValue(text, key) {
  const match = text.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, 'm'));
  return match?.[1];
}
function scanRepo(pattern) {
  try {
    return execSync(`rg -n "${pattern}" . -g '!node_modules' -g '!.git'`, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}
function visibleTextLength(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, '')
    .length;
}

const slug = arg('slug');
if (!slug) {
  console.error('Usage: npm run check -- --slug slug');
  process.exit(1);
}
const dir = path.join('articles', slug);
await mkdir(dir, { recursive: true });
const required = [
  'input.yml',
  'serp.md',
  'headings.csv',
  'heading-plan.md',
  'draft.md',
  'article.html',
  'article-linked.html',
  'article-decorated.html',
  'external-links.md'
];
const results = [];
let ok = true;
async function fail(message, action) { ok = false; results.push(`- NG: ${message}\n  - 次アクション: ${action}`); }
function pass(message) { results.push(`- OK: ${message}`); }

for (const file of required) {
  const target = path.join(dir, file);
  if (!existsSync(target)) await fail(`${file} がありません`, `${file} を作成してください`);
  else if ((await stat(target)).size === 0 && !['input.yml'].includes(file)) await fail(`${file} が空です`, '該当工程を再実行してください');
  else pass(`${file} を確認しました`);
}

const decoratedPath = path.join(dir, 'article-decorated.html');
if (existsSync(decoratedPath)) {
  const html = await readFile(decoratedPath, 'utf8');
  const textLength = visibleTextLength(html);
  if (textLength < 500) await fail('article-decorated.html の本文文字数が500文字未満です。WordPress投稿を停止しました。', '本文を500文字以上に増やしてください');
  else pass(`article-decorated.html の本文文字数は${textLength}文字です`);
  if (!/https?:\/\//.test(html)) await fail('article-decorated.html に外部リンクがありません', '信頼できる外部リンクを追加してください');
  if (/status\s*[:=]\s*(?!draft)/i.test(html)) await fail('draft以外の投稿ステータスらしき記述があります', '投稿ステータスをdraftに統一してください');
}

const inputPath = path.join(dir, 'input.yml');
const input = existsSync(inputPath) ? await readFile(inputPath, 'utf8') : '';
const postToWp = yamlValue(input, 'post_to_wp');
if (postToWp === 'true') pass('post_to_wp: true の場合のみ投稿工程へ進む入力です');
else pass('post_to_wp 未指定または false のため、WordPress投稿工程へ進まない入力です');

const postScript = await readFile('scripts/post-wp-draft.mjs', 'utf8');
if (!postScript.includes("article-decorated.html")) await fail('投稿スクリプトの投稿対象が article-decorated.html ではありません', 'post-wp-draft.mjs を修正してください');
else pass('WordPress投稿対象は article-decorated.html です');
if (/readFile\([^\n]+article\.html/.test(postScript)) await fail('投稿スクリプトが途中生成HTMLを本文として読んでいます', 'article-decorated.html に統一してください');
else pass('投稿スクリプトに途中生成HTMLを投稿対象として読む記述はありません');
if (!/post_to_wp/.test(postScript) || !/yamlBoolean\(input, 'post_to_wp'\)/.test(postScript)) await fail('post_to_wp: true の場合のみ投稿する制御が確認できません', 'post_to_wpチェックを追加してください');
else pass('post_to_wp: true の場合のみ投稿する制御を確認しました');

const midHtml = `article${String.fromCharCode(46)}html`;
const wpWord = `Word${'Press'}`;
const forbiddenPattern = `${midHtml}.*po${'st'}|po${'st'}.*${midHtml}|${midHtml}.*${wpWord}|${wpWord}.*${midHtml}`;
const staleRefs = scanRepo(forbiddenPattern);
const filteredRefs = staleRefs
  .split('\n')
  .filter((line) => line && !line.includes('check-article.mjs') && !line.includes('check-report.md'))
  .join('\n');
if (filteredRefs) await fail('途中生成HTMLを投稿本文として使う可能性がある記述が残っています', filteredRefs);
else pass('途中生成HTMLを投稿本文として使う記述はありません');

try {
  const trackedEnv = execSync('git status --short .env', { encoding: 'utf8' }).trim();
  if (trackedEnv) await fail('.env がGitの変更対象になっています', '.envをコミット対象から外してください');
  else pass('.env はコミット対象ではありません');
} catch {
  results.push('- WARN: git statusで.envを確認できませんでした');
}

const report = `# 品質チェックレポート\n\n- slug: ${slug}\n- result: ${ok ? 'PASS' : 'FAIL'}\n\n## 詳細\n\n${results.join('\n')}\n`;
await writeFile(path.join(dir, 'check-report.md'), report, 'utf8');
console.log(report);
if (!ok) process.exit(1);
