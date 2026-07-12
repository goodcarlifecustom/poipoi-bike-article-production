import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const DEFAULT_CATEGORY = 'バイク買取';
export const DEFAULT_TARGET_MEDIA = 'https://poi-poi.co.jp/bike/';

export function argvValue(argv, name) {
  const candidates = [`--${name}`, `--${name.replace(/_/g, '-')}`];
  for (const flag of candidates) {
    const i = argv.indexOf(flag);
    if (i >= 0) return argv[i + 1];
  }
  return undefined;
}

export function normalizeSpaces(value = '') {
  return String(value).normalize('NFKC').replace(/[\u3000\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

export function parseScalar(text, key) {
  const m = text.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  if (!m) return undefined;
  let v = m[1].trim();
  if (v === '') return '';
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

export function parseList(text, key) {
  const scalar = parseScalar(text, key);
  if (scalar && scalar !== '[]') return scalar.split(',').map((v) => v.trim()).filter(Boolean);
  const lines = text.split(/\r?\n/);
  const out = [];
  let inList = false;
  for (const line of lines) {
    if (new RegExp(`^${key}:\\s*$`).test(line)) { inList = true; continue; }
    if (inList && /^\s*-\s*/.test(line)) out.push(line.replace(/^\s*-\s*/, '').replace(/^['"]|['"]$/g, '').trim());
    else if (inList && /^\S/.test(line)) break;
  }
  return out;
}

export async function loadInput(path) {
  const text = path && existsSync(path) ? await readFile(path, 'utf8') : '';
  return text;
}

export function normalizeRelatedKeywords(value, mainKeyword = '') {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
  const main = normalizeSpaces(mainKeyword);
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const normalized = normalizeSpaces(item);
    if (!normalized || normalized === main || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return Boolean(fallback);
  if (typeof value === 'boolean') return value;
  const v = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'on'].includes(v);
}

export function postToWpFromInputs({ wordpressDraft, postToWp }) {
  const hasWordPressDraft = wordpressDraft !== undefined && wordpressDraft !== null && wordpressDraft !== '';
  const hasPostToWp = postToWp !== undefined && postToWp !== null && postToWp !== '';
  const draftValue = hasWordPressDraft ? normalizeBoolean(wordpressDraft, true) : undefined;
  const postValue = hasPostToWp ? normalizeBoolean(postToWp, true) : undefined;
  if (hasWordPressDraft && hasPostToWp && draftValue !== postValue) throw new Error('wordpress_draft and post_to_wp must match when both are provided.');
  return hasWordPressDraft ? draftValue : hasPostToWp ? postValue : true;
}

export function yamlString(value) { return `"${String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`; }
export function yamlList(values) { return values.length ? values.map((v) => `  - ${yamlString(v)}`).join('\n') : '[]'; }

export function slugFromKeyword(keyword = '') {
  const dictionary = [
    ['CTN', 'ctn'], ['バイク', 'bike'], ['買取', 'kaitori'], ['評判', 'reviews'], ['口コミ', 'reviews'], ['レビュー', 'reviews'],
    ['おすすめ', 'recommended'], ['比較', 'comparison'], ['査定', 'assessment'], ['一括査定', 'bulk-assessment'], ['初心者', 'beginner'],
    ['ネオクラシック', 'neo-classic'], ['千葉', 'chiba'], ['東京', 'tokyo'], ['大阪', 'osaka'], ['神奈川', 'kanagawa'], ['埼玉', 'saitama'],
    ['不動車', 'immobile-bike'], ['原付', 'moped'], ['事故車', 'accident-bike'], ['廃車', 'scrap-bike'], ['料金', 'price'], ['費用', 'cost']
  ];
  let text = normalizeSpaces(keyword).toLowerCase();
  for (const [from, to] of dictionary) text = text.split(from.toLowerCase()).join(` ${to} `).split(from).join(` ${to} `);
  const words = text.normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const unique = [];
  for (const w of words) if (!unique.includes(w)) unique.push(w);
  return unique.slice(0, 4).join('-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '');
}

export function isUnresolved(value) {
  if (value === null || value === undefined) return true;
  const v = String(value).trim().toLowerCase();
  return v === '' || v === 'auto' || v === 'null' || v === 'undefined';
}

export function validateSingleArticleInput(text = '') {
  const errors = [];
  const mainKeywordKeys = [...text.matchAll(/^main_keyword\s*:/gm)];
  const keywordKeys = [...text.matchAll(/^keyword\s*:/gm)];
  const mainKeywordArray = /^main_keyword\s*:\s*\[/m.test(text) || /^main_keyword\s*:\s*$/m.test(text);
  if (mainKeywordArray) errors.push('main_keyword must be a single scalar value, not an array/list.');
  if (mainKeywordKeys.length > 1 || (mainKeywordKeys.length && keywordKeys.length)) errors.push('Multiple main_keyword values were provided.');
  if ((text.match(/^approved_outline\s*:/gm) || []).length > 1) errors.push('Multiple approved_outline inputs were provided.');
  if (/approved_outline\s*:\s*\[[\s\S]*?\{[\s\S]*?\}\s*,\s*\{/m.test(text)) errors.push('Multiple approved_outline inputs were provided.');
  for (const key of ['articles', 'article_jobs', 'article_units', 'generation_units']) {
    const itemCount = countYamlListItems(text, key);
    if (itemCount > 1) errors.push(`Multiple article generation units were provided in ${key}.`);
  }
  if (/(?:1車種1記事|1キーワード1記事).*(?:複数|一括|順番に|自動生成)|(?:複数記事|複数の記事|複数のarticleディレクトリ).*(?:作成|生成)/.test(text)) errors.push('Bulk/multiple article generation instruction was provided.');
  if (errors.length) {
    const error = new Error(`MULTIPLE_ARTICLE_INPUT: ${errors.join(' ')}`);
    error.code = 'MULTIPLE_ARTICLE_INPUT';
    throw error;
  }
}

function countYamlListItems(text, key) {
  const lines = text.split(/\r?\n/);
  let itemCount = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (!new RegExp(`^${key}:\\s*$`).test(lines[i])) continue;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (/^\S/.test(lines[j])) break;
      if (/^\s*-\s+/.test(lines[j])) itemCount += 1;
    }
  }
  return itemCount;
}

export function finalSlugForBase(baseSlug, articlesDir = 'articles') {
  const taken = new Set(existsSync(articlesDir) ? readdirSync(articlesDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : []);
  if (!taken.has(baseSlug)) return { finalSlug: baseSlug, generationNumber: 1, collision: false };
  for (let n = 2; ; n += 1) {
    const candidate = n === 2 ? `${baseSlug}-new` : `${baseSlug}-new-${n - 1}`;
    if (!taken.has(candidate)) return { finalSlug: candidate, generationNumber: n, collision: true };
  }
}

export function assertSingleOutputCounts({ articleCount = 0, articleDirectoryCount = 0, wordpressPostCount = 0 }) {
  if (articleCount > 1 || articleDirectoryCount > 1 || wordpressPostCount > 1) {
    const error = new Error('MULTIPLE_ARTICLE_OUTPUT_BLOCKED: one execution may create at most one article, one article directory, and one WordPress POST.');
    error.code = 'MULTIPLE_ARTICLE_OUTPUT_BLOCKED';
    throw error;
  }
}
