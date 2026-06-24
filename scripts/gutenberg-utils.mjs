import { readFile } from 'node:fs/promises';

export function stripFrontMatter(content) {
  return String(content).replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '').trimStart();
}

export async function readWordPressContent(file) {
  return stripFrontMatter(await readFile(file, 'utf8'));
}

export function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

export function stripTags(html) {
  return decodeHtmlEntities(String(html).replace(/<!--([\s\S]*?)-->/g, '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

export function normalizeVisibleText(value) {
  return decodeHtmlEntities(String(value).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function removeExcludedForMarkdown(content) {
  let out = String(content);
  out = out.replace(/<!--\s*wp:(code|html)\b[\s\S]*?<!--\s*\/wp:\1\s*-->/gi, '');
  out = out.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style\b[\s\S]*?<\/style>/gi, '');
  out = out.replace(/<pre\b[\s\S]*?<\/pre>/gi, '');
  out = out.replace(/<code\b[\s\S]*?<\/code>/gi, '');
  return out;
}

export function visibleCharCount(html) {
  let content = stripFrontMatter(html);
  content = content.replace(/<!--\s*wp:[\s\S]*?-->/g, '');
  content = content.replace(/<!--\s*\/wp:[\s\S]*?-->/g, '');
  content = content.replace(/<!--(?!\s*\/?wp:)[\s\S]*?-->/g, '');
  content = content.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style\b[\s\S]*?<\/style>/gi, '');
  content = content.replace(/<[^>]+>/g, '');
  return decodeHtmlEntities(content).replace(/[\s\u200b]+/g, '').length;
}

export function parseWpBlocks(html) {
  const content = stripFrontMatter(html);
  const re = /<!--\s*(\/?)wp:([a-z0-9-]+(?:\/[a-z0-9-]+)?)([\s\S]*?)\s*(\/?)-->/gi;
  const events = [];
  let m;
  while ((m = re.exec(content))) {
    const closing = Boolean(m[1]);
    const name = m[2];
    const rawAttrs = (m[3] || '').trim().replace(/\/$/, '').trim();
    const selfClosing = !closing && (Boolean(m[4]) || /\/\s*$/.test(m[3] || ''));
    let attrs = null;
    if (!closing && rawAttrs) {
      if (rawAttrs.startsWith('{')) {
        try { attrs = JSON.parse(rawAttrs); }
        catch (e) { events.push({ type: 'error', message: `invalid JSON attributes for ${name}: ${e.message}`, index: m.index }); }
      } else if (rawAttrs !== '/') {
        events.push({ type: 'error', message: `invalid block attributes for ${name}`, index: m.index });
      }
    }
    events.push({ type: closing ? 'close' : selfClosing ? 'self' : 'open', name, attrs, raw: m[0], index: m.index });
  }
  return events;
}

export function validateBlockNesting(html) {
  const errors = [];
  const stack = [];
  for (const event of parseWpBlocks(html)) {
    if (event.type === 'error') { errors.push(event.message); continue; }
    if (event.type === 'self') continue;
    if (event.type === 'open') stack.push(event);
    if (event.type === 'close') {
      const last = stack.pop();
      if (!last) errors.push(`closing block without opener: ${event.name}`);
      else if (last.name !== event.name) errors.push(`Gutenberg block close mismatch: expected ${last.name}, got ${event.name}`);
    }
  }
  if (stack.length) errors.push(`Gutenberg block is not closed: ${stack.map(x => x.name).join(', ')}`);
  return errors;
}

function blockAttributes(content, name, index) {
  const before = content.slice(0, index + 1);
  const start = before.lastIndexOf('<!-- wp:');
  if (start < 0) return null;
  const close = content.indexOf('-->', start);
  const comment = content.slice(start, close + 3);
  const parsed = parseWpBlocks(comment).find(e => e.name === name && (e.type === 'open' || e.type === 'self'));
  return parsed?.attrs || null;
}

export function validateGutenbergContent(html, { title = '' } = {}) {
  const content = stripFrontMatter(html);
  const errors = [];
  errors.push(...validateBlockNesting(content));
  if (!/<!--\s*wp:/.test(content)) errors.push('Gutenberg block comments are missing');
  if (/^---\s*$/m.test(content)) errors.push('front matter remains in content');
  const markdownTarget = removeExcludedForMarkdown(content).replace(/<!--[\s\S]*?-->/g, '');
  if (/^#{1,6}\s+/m.test(markdownTarget)) errors.push('Markdown headings remain');
  if (/^\s*[-*+]\s+/m.test(markdownTarget)) errors.push('Markdown unordered lists remain');
  if (/!\[[^\]]*\]\([^)]*\)/.test(markdownTarget)) errors.push('Markdown image syntax remains');
  if (/```/.test(markdownTarget)) errors.push('Markdown code fences remain');
  if (/<h1\b/i.test(content)) errors.push('H1 is not allowed in article body');
  const meaningfulBlocks = [...content.matchAll(/<!--\s*wp:([a-z0-9-]+(?:\/[a-z0-9-]+)?)/gi)].map(m => m[1]).filter(n => !n.startsWith('/'));
  if (meaningfulBlocks.length === 1 && meaningfulBlocks[0] === 'html') errors.push('article must not be a single wp:html block');
  const ids = [...content.matchAll(/\sid=["']([^"']+)["']/gi)].map(x => x[1]);
  const dup = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (dup.length) errors.push(`duplicate id: ${dup.join(', ')}`);
  const h2s = [...content.matchAll(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi)].map(x => {
    const id = (x[1].match(/\sid=["']([^"']+)["']/i) || [])[1] || '';
    return { id, text: normalizeVisibleText(x[2]), index: x.index, attrs: x[1] };
  });
  for (const h of h2s) {
    if (!h.id) errors.push(`H2 id is missing: ${h.text}`);
    const attrs = blockAttributes(content, 'heading', h.index);
    if (attrs?.anchor && attrs.anchor !== h.id) errors.push(`H2 anchor does not match id: ${attrs.anchor} != ${h.id}`);
  }
  const secIds = h2s.map(h => h.id).filter(id => /^sec-\d{2}$/.test(id));
  const duplicatedSec = [...new Set(secIds.filter((id, i) => secIds.indexOf(id) !== i))];
  if (duplicatedSec.length) errors.push(`duplicate sec id: ${duplicatedSec.join(', ')}`);
  const hrefs = [...content.matchAll(/<a\b[^>]*href=["']#([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(x => ({ id: x[1], text: normalizeVisibleText(x[2]), index: x.index }));
  for (const href of hrefs) if (!ids.includes(href.id)) errors.push(`missing target: #${href.id}`);
  if (h2s.length) {
    const firstH2 = h2s[0].index;
    const beforeFirstH2 = content.slice(0, firstH2);
    if (!/この記事でわかること/.test(normalizeVisibleText(beforeFirstH2))) errors.push('「この記事でわかること」は最初のH2より前に必要です');
    const tocLinks = hrefs.filter(h => h.index < firstH2 && h2s.some(x => x.id === h.id));
    const h2Ids = h2s.map(h => h.id);
    if (JSON.stringify(tocLinks.map(h => h.id)) !== JSON.stringify(h2Ids)) errors.push('toc hrefs must match H2 ids in order');
    for (const link of tocLinks) {
      const target = h2s.find(h => h.id === link.id);
      if (target && normalizeVisibleText(link.text) !== normalizeVisibleText(target.text)) errors.push(`toc text must match H2 text for #${link.id}`);
    }
  }
  if (title) {
    const bodyText = normalizeVisibleText(content);
    const escaped = normalizeVisibleText(title).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escaped && new RegExp(escaped, 'g').test(bodyText)) errors.push('article title is duplicated in body');
  }
  return { ok: errors.length === 0, errors, content };
}
