import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function sha256(text) { return crypto.createHash('sha256').update(text, 'utf8').digest('hex'); }
export function articleDir(slug) { return path.join('articles', slug); }
export async function readDecorated(slug) {
  const file = path.join(articleDir(slug), 'article-decorated.html');
  if (!existsSync(file)) throw new Error('article-decorated.html が存在しません');
  const html = await readFile(file, 'utf8');
  if (!html.trim()) throw new Error('article-decorated.html が空です');
  if (/<h1\b/i.test(html)) throw new Error('article-decorated.html にH1があります');
  return { file, html, hash: sha256(html) };
}
export function validateDecoratedHtml(html) {
  const errors = [];
  const ids = [...html.matchAll(/id=["']([^"']+)["']/gi)].map((m) => m[1]);
  const seen = new Set();
  for (const id of ids) { if (seen.has(id)) errors.push(`IDが重複しています: ${id}`); seen.add(id); }
  for (const href of [...html.matchAll(/href=["']#([^"']*)["']/gi)].map((m) => m[1])) {
    if (!href) errors.push('空のアンカーリンクがあります');
    else if (!seen.has(href)) errors.push(`存在しないページ内アンカーがあります: #${href}`);
  }
  if (/href=["']#["']/i.test(html) || /href=["']["']/i.test(html)) errors.push('空のhrefがあります');
  const capOpen = (html.match(/swell-block-capbox|cap_box/g) || []).length;
  if (capOpen && !/cap_box_content/.test(html)) errors.push('capboxの本文領域が見つかりません');
  for (const m of html.matchAll(/<span\b[^>]*class=["'][^"']*swl-marker[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)) {
    if (!m[1].replace(/<[^>]+>/g, '').trim()) errors.push('空のマーカーがあります');
  }
  return errors;
}
export async function writeDecorationManifest(slug) {
  const { html, hash } = await readDecorated(slug);
  const errors = validateDecoratedHtml(html);
  if (errors.length) throw new Error(errors.join('\n'));
  const manifest = { slug, file: 'article-decorated.html', sha256: hash, generated_at: new Date().toISOString() };
  await writeFile(path.join(articleDir(slug), 'decoration-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
export async function checkDecorationManifest(slug, { requireManifest = true } = {}) {
  const { html, hash } = await readDecorated(slug);
  const errors = validateDecoratedHtml(html);
  const manifestPath = path.join(articleDir(slug), 'decoration-manifest.json');
  if (!existsSync(manifestPath)) {
    if (requireManifest) errors.push('decoration-manifest.json が存在しません');
  } else {
    let manifest;
    try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); }
    catch { errors.push('decoration-manifest.json が有効なJSONではありません'); }
    if (manifest && manifest.sha256 !== hash) errors.push('decoration-manifest.json のSHA-256とarticle-decorated.htmlが一致しません');
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { sha256: hash };
}
