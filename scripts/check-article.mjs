import { readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { argvValue, isUnresolved, parseList, parseScalar } from './workflow-utils.mjs';

function visibleTextLength(html) { return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--([\s\S]*?)-->/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, '').length; }
function scanRepo(pattern) { try { return execSync(`rg -n "${pattern}" . -g '!node_modules' -g '!.git'`, { encoding: 'utf8' }).trim(); } catch { return ''; } }
function anchors(html) { return [...html.matchAll(/id=["']([^"']+)["']/gi)].map((m) => m[1]); }
const slug = argvValue(process.argv, 'slug');
if (!slug) { console.error('Usage: npm run check -- --slug slug'); process.exit(1); }
const dir = path.join('articles', slug); await mkdir(dir, { recursive: true });
const required = ['input.yml','metadata.json','research.md','serp.md','headings.csv','heading-analysis.md','heading-plan.md','draft.md','article.html','article-linked.html','article-decorated.html','external-links.md'];
const results = []; let ok = true;
async function fail(message, action = '修正してください') { ok = false; results.push(`- NG: ${message}\n  - 次アクション: ${action}`); }
function pass(message) { results.push(`- OK: ${message}`); }
for (const file of required) { const target = path.join(dir, file); if (!existsSync(target)) await fail(`${file} がありません`); else if ((await stat(target)).size === 0 && !['input.yml','metadata.json'].includes(file)) await fail(`${file} が空です`); else pass(`${file} を確認しました`); }
const input = existsSync(path.join(dir, 'input.yml')) ? await readFile(path.join(dir, 'input.yml'), 'utf8') : '';
let metadata = {}; try { metadata = JSON.parse(await readFile(path.join(dir, 'metadata.json'), 'utf8')); pass('metadata.json は有効なJSONです'); } catch { await fail('metadata.json が有効なJSONではありません'); }
const research = existsSync(path.join(dir, 'research.md')) ? await readFile(path.join(dir, 'research.md'), 'utf8') : '';
if (research.trim().length < 50) await fail('research.md が空または短すぎます'); else pass('research.md は空ではありません');
const mainKeyword = parseScalar(input, 'main_keyword') || parseScalar(input, 'keyword');
const related = parseList(input, 'related_keywords');
if (!mainKeyword) await fail('main_keyword がありません'); else pass('main_keyword を確認しました');
if (!Array.isArray(related) || related.length === 0) await fail('related_keywords が配列として存在しません'); else pass('related_keywords 配列を確認しました');
for (const key of ['title','slug','meta_description','search_intent','persona','article_type','target_word_count']) { if (isUnresolved(metadata[key])) await fail(`metadata.json の ${key} が未確定です`); else pass(`${key} は生成済みです`); }
if (metadata.status !== 'draft') await fail('metadata.json の status が draft ではありません'); else pass('status: draft を確認しました');
if (typeof metadata.post_to_wp !== 'boolean') await fail('metadata.json の post_to_wp がbooleanではありません'); else pass('post_to_wp はbooleanです');
if (metadata.slug && metadata.slug !== slug) await fail('slug がパスとmetadata.jsonで一致しません'); else pass('slug は一致しています');
if (metadata.target_keyword && mainKeyword && metadata.target_keyword !== mainKeyword) await fail('メインキーワードがファイル間で一致しません'); else pass('メインキーワードは一致しています');
for (const f of ['article.html','article-linked.html','article-decorated.html']) {
  if (!existsSync(path.join(dir, f))) continue; const html = await readFile(path.join(dir, f), 'utf8');
  if (!html.trim()) continue; if (/<h1\b/i.test(html)) await fail(`${f} にH1があります`); else pass(`${f} にH1はありません`);
  if (/<a\b[^>]*>\s*<\/a>/i.test(html)) await fail(`${f} に空のaタグがあります`);
  const ids = anchors(html); for (const href of [...html.matchAll(/href=["']#([^"']+)["']/gi)].map((m)=>m[1])) if (!ids.includes(href)) await fail(`${f} に存在しない内部アンカー #${href} があります`);
}
const decorated = existsSync(path.join(dir, 'article-decorated.html')) ? await readFile(path.join(dir, 'article-decorated.html'), 'utf8') : '';
const len = visibleTextLength(decorated); const target = Number(metadata.target_word_count || 0);
if (target && (len < target * 0.5 || len > target * 1.6)) await fail('本文文字数が目標文字数から大きく外れています', `目標 ${target} に対し本文 ${len}`); else if (target) pass('本文文字数は目標から大きく外れていません');
if (/https?:\/\/[^"'<>\s]+/.test(decorated.replace(/<a\b[^>]*href=["'][^"']+["'][^>]*>/gi, '<a>'))) await fail('外部URLのベタ書きがあります'); else pass('外部URLのベタ書きは検出されません');
try { const trackedEnv = execSync('git status --short .env', { encoding: 'utf8' }).trim(); if (trackedEnv) await fail('.env がGitの変更対象です'); else pass('.env はコミット対象ではありません'); } catch { results.push('- WARN: git statusで.envを確認できませんでした'); }
const secretPattern = 'WP_APP_PASSWORD=.+|WP_APPLICATION_PASSWORD=.+|Authori' + 'zation:|Ba' + 'sic [A-Za-z0-9+/=]{20,}|_wp' + 'nonce|preview_' + 'nonce';
const leaks = scanRepo(secretPattern).split('\n').filter((line) => line && !line.includes('check-article.mjs') && !line.includes('README.md') && !line.includes('rules/99-quality-check.md') && !line.includes('scripts/post-wp-draft.mjs')).join('\n');
if (leaks) await fail('認証情報またはnonceらしき文字列が残っています', leaks); else pass('認証情報・nonceの残存は検出されませんでした');
if (metadata.post_to_wp === false) pass('post_to_wp:false のためWordPress環境変数は要求しません');
else { for (const k of ['WP_REST_ROOT','WP_USERNAME','WP_APP_PASSWORD','WP_DEFAULT_STATUS']) if (!process.env[k]) await fail(`post_to_wp:true ですが ${k} が未設定です`); if (process.env.WP_DEFAULT_STATUS && process.env.WP_DEFAULT_STATUS !== 'draft') await fail('WP_DEFAULT_STATUS がdraftではありません'); }
const report = `# 品質チェックレポート\n\n- slug: ${slug}\n- result: ${ok ? 'PASS' : 'FAIL'}\n\n## 詳細\n\n${results.join('\n')}\n`;
await writeFile(path.join(dir, 'check-report.md'), report, 'utf8'); console.log(report); if (!ok) process.exit(1);
