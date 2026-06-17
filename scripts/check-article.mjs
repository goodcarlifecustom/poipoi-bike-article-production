import { readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function arg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
function yamlValue(text, key) { const match = text.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, 'm')); return match?.[1]?.trim(); }
function scanRepo(pattern) { try { return execSync(`rg -n "${pattern}" . -g '!node_modules' -g '!.git'`, { encoding: 'utf8' }).trim(); } catch { return ''; } }
function visibleTextLength(html) { return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--([\s\S]*?)-->/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, '').length; }
function slugFromKeyword(keyword = '') {
  const dictionary = [['バイク','bike'],['買取','kaitori'],['千葉','chiba'],['東京','tokyo'],['大阪','osaka'],['神奈川','kanagawa'],['埼玉','saitama'],['不動車','fudosha'],['原付','gentsuki'],['事故車','jikosha'],['廃車','haisha'],['査定','satei']];
  let text = String(keyword).toLowerCase();
  for (const [from, to] of dictionary) text = text.split(from).join(` ${to} `);
  const slug = text.normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
  return /^[a-z0-9-]+$/.test(slug) && /[a-z]/.test(slug) ? slug : '';
}

const requestedKeyword = arg('main_keyword') || arg('keyword') || '';
const slug = arg('slug') || slugFromKeyword(requestedKeyword);
if (!slug) { console.error('Usage: npm run check -- --slug slug (or --main_keyword to derive an auto slug)'); process.exit(1); }
const dir = path.join('articles', slug); await mkdir(dir, { recursive: true });
const required = ['input.yml','serp.md','headings.csv','heading-analysis.md','heading-plan.md','draft.md','article.html','article-linked.html','article-decorated.html','external-links.md'];
const results = []; let ok = true;
async function fail(message, action) { ok = false; results.push(`- NG: ${message}\n  - 次アクション: ${action}`); }
function pass(message) { results.push(`- OK: ${message}`); }

for (const file of required) {
  const target = path.join(dir, file);
  if (!existsSync(target)) await fail(`${file} がありません`, `${file} を作成してください`);
  else if ((await stat(target)).size === 0 && file !== 'input.yml') await fail(`${file} が空です`, '該当工程を再実行してください');
  else pass(`${file} を確認しました`);
}
if (existsSync(path.join(dir, 'outline.md'))) await fail('outline.md が存在します', '標準ファイルとして使わず削除してください');
else pass('outline.md は存在しません');

const planPath = path.join(dir, 'heading-plan.md');
if (existsSync(planPath)) {
  const plan = await readFile(planPath, 'utf8');
  const trimmed = plan.trim();
  if (!trimmed) await fail('heading-plan.md が空です', '見出し構成を作成してください');
  const invalidLines = trimmed.split(/\r?\n/).filter((line) => line.trim() && !/^<h[23]>[^<>]+<\/h[23]>$/i.test(line.trim()));
  if (invalidLines.length) await fail('heading-plan.md が許可形式ではありません', '各行を <h2>見出し</h2> または <h3>見出し</h3> のみにしてください');
  const h2Count = (plan.match(/<h2>/gi) || []).length;
  const h3Count = (plan.match(/<h3>/gi) || []).length;
  if (/<h1\b/i.test(plan)) await fail('heading-plan.md にH1があります', 'H1を削除してください'); else pass('heading-plan.md にH1はありません');
  if (h2Count < 3) await fail('heading-plan.md のH2が3つ未満です', 'H2を3つ以上にしてください'); else pass(`heading-plan.md のH2は${h2Count}個です`);
  if (h3Count === 0) results.push('- WARN: heading-plan.md にH3がありません。必要に応じて追加してください'); else pass(`heading-plan.md のH3は${h3Count}個です`);
}

const decoratedPath = path.join(dir, 'article-decorated.html');
let textLength = 0;
if (existsSync(decoratedPath)) {
  const html = await readFile(decoratedPath, 'utf8'); textLength = visibleTextLength(html);
  if (/<h1\b/i.test(html)) await fail('article-decorated.html にH1が含まれています。WordPress投稿タイトルと重複するため、本文はH2から開始してください。', 'article-decorated.html からH1を削除し、本文の最初の見出しをH2にしてください');
  else pass('article-decorated.html にH1はありません');
  if (textLength < 500) await fail('article-decorated.html の本文文字数が500文字未満です。WordPress投稿を停止しました。', '本文を500文字以上に増やしてください'); else pass(`article-decorated.html の本文文字数は${textLength}文字です`);
  if (!/https?:\/\//.test(html)) await fail('article-decorated.html に外部リンクがありません', '信頼できる外部リンクを追加してください');
  if (/status\s*[:=]\s*(?!draft)/i.test(html)) await fail('draft以外の投稿ステータスらしき記述があります', '投稿ステータスをdraftに統一してください');
}
const inputPath = path.join(dir, 'input.yml'); const input = existsSync(inputPath) ? await readFile(inputPath, 'utf8') : '';
const targetWordCount = Number.parseInt(yamlValue(input, 'target_word_count') || '0', 10);
if (targetWordCount && textLength && textLength < Math.floor(targetWordCount * 0.5)) await fail('記事本文がtarget_word_countに対して極端に短すぎます', '目標文字数の±15%を目安に本文を補強してください');
else if (targetWordCount) pass(`target_word_count (${targetWordCount}) に対する極端な不足はありません`);
const mainKeyword = yamlValue(input, 'main_keyword') || yamlValue(input, 'keyword');
if (mainKeyword) pass(`main_keyword/keyword 入力を確認しました: ${mainKeyword}`); else await fail('main_keyword または keyword がありません', 'input.yml に main_keyword を設定してください');
const title = yamlValue(input, 'title'); if (title) pass('title 入力を確認しました'); else await fail('title がありません', 'input.yml に title を設定してください');
const postToWp = yamlValue(input, 'post_to_wp') || 'false';
if (postToWp === 'true') pass('post_to_wp: true の場合のみ投稿工程へ進む入力です'); else pass('post_to_wp 未指定または false のため、WordPress投稿工程へ進まない入力です');

const postScript = await readFile('scripts/post-wp-draft.mjs', 'utf8');
if (!postScript.includes('article-decorated.html')) await fail('投稿スクリプトの投稿対象が article-decorated.html ではありません', 'post-wp-draft.mjs を修正してください'); else pass('WordPress投稿対象は article-decorated.html です');
if (!/post_to_wp/.test(postScript) || !/yamlBoolean\(input, 'post_to_wp'\)/.test(postScript)) await fail('post_to_wp: true の場合のみ投稿する制御が確認できません', 'post_to_wpチェックを追加してください'); else pass('post_to_wp: true の場合のみ投稿する制御を確認しました');
try { const trackedEnv = execSync('git status --short .env', { encoding: 'utf8' }).trim(); if (trackedEnv) await fail('.env がGitの変更対象になっています', '.envをコミット対象から外してください'); else pass('.env はコミット対象ではありません'); } catch { results.push('- WARN: git statusで.envを確認できませんでした'); }
const secretPattern = 'WP_APP_PASSWORD=.+|WP_APPLICATION_PASSWORD=.+|Authori' + 'zation:|Ba' + 'sic [A-Za-z0-9+/=]{20,}|_wp' + 'nonce|preview_' + 'nonce';
const leaks = scanRepo(secretPattern).split('\n').filter((line) => line && !line.includes('check-article.mjs') && !line.includes('README.md') && !line.includes('rules/99-quality-check.md')).join('\n');
if (leaks) await fail('認証情報またはnonceらしき文字列がファイルに残っています', leaks); else pass('認証情報・nonceの残存は検出されませんでした');
const report = `# 品質チェックレポート\n\n- slug: ${slug}\n- result: ${ok ? 'PASS' : 'FAIL'}\n\n## 詳細\n\n${results.join('\n')}\n`;
await writeFile(path.join(dir, 'check-report.md'), report, 'utf8'); console.log(report); if (!ok) process.exit(1);
