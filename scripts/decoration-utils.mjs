import { readFile, writeFile, rename, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as parse5 from 'parse5';
import { validateNoManualToc } from './toc-validation.mjs';
export const CAP_TITLE_CLASS='cap_box_ttl';
export function sha256(s){return crypto.createHash('sha256').update(s).digest('hex');}
export async function loadDecorationConfig(dir){const p=path.join(dir,'decoration.json'); if(!existsSync(p)) throw new Error('decoration.json がありません'); const c=JSON.parse(await readFile(p,'utf8')); if(c.enabled!==true) throw new Error('decoration.enabled が true ではありません'); return c;}
export function parseFragment(html){return parse5.parseFragment(html,{sourceCodeLocationInfo:false});}
export function serialize(doc){return parse5.serialize(doc).replace(/\n{3,}/g,'\n\n').trim()+"\n";}
export function text(n){if(!n)return''; if(n.nodeName==='#text')return n.value||''; return (n.childNodes||[]).map(text).join('');}
export function els(root,name){const out=[]; walk(root,n=>{if(n.tagName===name)out.push(n)}); return out;}
export function walk(n,fn){fn(n); for(const c of n.childNodes||[])walk(c,fn)}
export function attr(n,k){return n.attrs?.find(a=>a.name===k)?.value||''}
export function setAttr(n,k,v){n.attrs=n.attrs||[]; const a=n.attrs.find(a=>a.name===k); if(a)a.value=v; else n.attrs.push({name:k,value:v});}
export function hasClass(n,c){return (` ${attr(n,'class')} `).includes(` ${c} `)}
export function parent(root,target){let p=null; walk(root,n=>{for(const c of n.childNodes||[])if(c===target)p=n}); return p;}
export function indexInParent(root,n){const p=parent(root,n); return p?p.childNodes.indexOf(n):-1}
export function before(root,ref,nodes){const p=parent(root,ref),i=indexInParent(root,ref); p.childNodes.splice(i,0,...nodes);}
export function after(root,ref,nodes){const p=parent(root,ref),i=indexInParent(root,ref); p.childNodes.splice(i+1,0,...nodes);}
export function replace(root,oldn,nodes){const p=parent(root,oldn),i=indexInParent(root,oldn); p.childNodes.splice(i,1,...nodes);}
export function fragNodes(html){return parseFragment(html).childNodes;}
export function capbox(title, items){return fragNodes(`<!-- wp:loos/cap-block {"className":"is-style-onborder_ttl"} --><div class="swell-block-capbox cap_box is-style-onborder_ttl" data-generated-toc="true"><div class="cap_box_ttl"><span>${esc(title)}</span></div><div class="cap_box_content"><!-- wp:list --><ul class="wp-block-list">${items.map(i=>`<!-- wp:list-item --><li><a href="#${escAttr(i.id)}">${esc(i.title)}</a></li><!-- /wp:list-item -->`).join('')}</ul><!-- /wp:list --></div></div><!-- /wp:loos/cap-block -->`)}
export function esc(s){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')} export function escAttr(s){return esc(s).replaceAll('"','&quot;')}
export function assignHeadingIds(root){const used=new Set(); const h2s=els(root,'h2'); for(const h2 of h2s){let id=attr(h2,'id'); if(!id||used.has(id)){id=`h2-${String(h2s.indexOf(h2)+1).padStart(2,'0')}`; setAttr(h2,'id',id)} setAttr(h2,'class',[...new Set([attr(h2,'class').split(/\s+/).filter(Boolean),'wp-block-heading'].flat())].join(' ')); used.add(id); let j=1; for(const h3 of sectionNodes(root,h2).filter(n=>n.tagName==='h3')){let hid=attr(h3,'id'); if(!hid||used.has(hid)){hid=`${id}-${String(j).padStart(2,'0')}`; setAttr(h3,'id',hid)} setAttr(h3,'class',[...new Set([attr(h3,'class').split(/\s+/).filter(Boolean),'wp-block-heading'].flat())].join(' ')); used.add(hid); j++;}}}
export function sectionNodes(root,heading){const p=parent(root,heading); const i=p.childNodes.indexOf(heading); const lvl=Number(heading.tagName.slice(1)); const out=[]; for(const n of p.childNodes.slice(i+1)){if(/^h[1-6]$/.test(n.tagName||'')&&Number(n.tagName.slice(1))<=lvl)break; out.push(n)} return out;}
export function sectionKeyMatch(sec,heading){if(sec.id&&attr(heading,'id')===sec.id)return true; return Number(sec.level||2)===Number(heading.tagName.slice(1)) && !sec.id && text(heading).trim()===sec.heading;}
export function findSection(root,sec){const hs=els(root,`h${sec.level||2}`).filter(h=>sectionKeyMatch(sec,h)); if(hs.length!==1) throw new Error(`セクションを一意に特定できません: ${JSON.stringify(sec)}`); return hs[0];}
export function isIn(root,n,pred){let p=parent(root,n); while(p){if(pred(p))return true; p=parent(root,p)} return false;}
export function capTitle(n){return hasClass(n,'swell-block-capbox')? text((n.childNodes||[]).find(c=>hasClass(c,CAP_TITLE_CLASS))).trim():''}
export function stripGeneratedText(root){
 const parts=[]; function rec(n){
  if(hasClass(n,'cap_box_ttl')) return;
  if(hasClass(n,'swell-block-capbox')&&attr(n,'data-generated-toc')==='true') return;
  if(hasClass(n,'swell-block-capbox')&&['この記事でわかること','【この記事でわかること】'].includes(capTitle(n))) return;
  if(n.nodeName==='#text') parts.push(n.value||'');
  for(const c of n.childNodes||[]) rec(c);
 }
 rec(root); return parts.join('').replace(/\s+/g,'');
}

export async function atomicWrite(file,content){const tmp=`${file}.tmp-${process.pid}`; await writeFile(tmp,content); await rename(tmp,file)}
export async function sourceFile(dir){const linked=path.join(dir,'article-linked.html'); return existsSync(linked)&&(await stat(linked)).size>0?linked:path.join(dir,'article.html')}

export function articleDir(slug) { return path.join('articles', slug); }
export async function readDecorated(slug) {
  const file = path.join(articleDir(slug), 'article-decorated.html');
  if (!existsSync(file)) throw new Error('article-decorated.html が存在しません');
  const html = await readFile(file, 'utf8');
  if (!html.trim()) throw new Error('article-decorated.html が空です');
  if (/<h1\b/i.test(html)) throw new Error('article-decorated.html にH1があります');
  return { file, html, hash: sha256(html) };
}
export const POSITIVE_MARKER_CLASS='swl-marker';
export const POSITIVE_MARKER_STYLE_CLASS='mark_yellow';
export const NEGATIVE_MARKER_CLASS='has-swl-deep-01-color';
export function markerNodes(root){return [
  ...els(root,'span').filter(n=>hasClass(n,POSITIVE_MARKER_CLASS)&&hasClass(n,POSITIVE_MARKER_STYLE_CLASS)),
  ...els(root,'mark').filter(n=>hasClass(n,NEGATIVE_MARKER_CLASS)),
];}
function japaneseWordChar(ch){return /^[A-Za-z0-9_\u3040-\u30ff\u3400-\u9fff]$/u.test(ch||'')}
function textEdge(node, fromEnd=true){
  if(node.nodeName==='#text'){const s=node.value||''; return fromEnd?s.at(-1)||'':s[0]||''}
  const kids=node.childNodes||[]; const seq=fromEnd?[...kids].reverse():kids;
  for(const c of seq){const v=textEdge(c,fromEnd); if(v)return v}
  return ''
}
function adjacentTextSibling(root,node,previous=true){
  const p=parent(root,node); if(!p)return ''; const i=p.childNodes.indexOf(node);
  const seq=previous?[...p.childNodes.slice(0,i)].reverse():p.childNodes.slice(i+1);
  for(const n of seq){const v=textEdge(n,previous); if(v)return v}
  return ''
}
export function markerBoundaryErrors(root){
  const errors=[];
  for(const m of markerNodes(root)){
    const insideStart=textEdge(m,false), insideEnd=textEdge(m,true);
    const prev=adjacentTextSibling(root,m,true), next=adjacentTextSibling(root,m,false);
    const label=text(m).trim().slice(0,40);
    if(japaneseWordChar(insideEnd)&&japaneseWordChar(next)) errors.push(`マーカー終了位置が語句の途中の疑い: ${label}`);
  }
  return errors;
}
export function validateMarkerPlacement(root){
  const errors=[];
  const markers=markerNodes(root);
  for(const m of markers){
    if(!text(m).trim()) errors.push('空マーカー');
    if(isIn(root,m,n=>['a','li','ul','ol','table','thead','tbody','tr','td','th','h1','h2','h3','h4','h5','h6'].includes(n.tagName)||/cta/i.test(attr(n,'class')))) errors.push('禁止箇所のマーカー');
    if((m.childNodes||[]).some(c=>markerNodes(c).length>0)) errors.push('マーカー入れ子');
  }
  errors.push(...markerBoundaryErrors(root));
  for(const h of [...els(root,'h2'),...els(root,'h3')]){
    const nodes=sectionNodes(root,h);
    const scope=h.tagName==='h2'?nodes.slice(0,nodes.findIndex(n=>n.tagName==='h3')>=0?nodes.findIndex(n=>n.tagName==='h3'):nodes.length):nodes;
    const paragraphs=scope.filter(n=>n.tagName==='p'&&!isIn(root,n,x=>hasClass(x,'swell-block-capbox')||['li','ul','ol','table','thead','tbody','tr','td','th'].includes(x.tagName))&&text(n).trim());
    if(!paragraphs.length) continue;
    const count=paragraphs.reduce((sum,p)=>sum+markerNodes(p).length,0);
    if(count===0) errors.push(`本文マーカーなし: ${text(h).trim()}`);
    if(count>=3) errors.push(`マーカー過多: ${text(h).trim()}`);
  }
  return errors;
}
export function normalLinkSignatures(html) {
  const root = parseFragment(html);
  return els(root, 'a')
    .map((a) => ({
      href: attr(a, 'href'),
      text: text(a).replace(/\s+/g, ' ').trim(),
      target: attr(a, 'target'),
      rel: attr(a, 'rel'),
      title: attr(a, 'title'),
    }))
    .filter((a) => /^(https?:\/\/|\/)/i.test(a.href));
}
export function validateNormalLinks(html, { requireAny = false } = {}) {
  const errors = [];
  const links = normalLinkSignatures(html);
  if (requireAny && links.length === 0) errors.push('通常リンクが存在しません');
  for (const link of links) {
    if (!link.href.trim()) errors.push('hrefが空の通常リンクがあります');
    if (!link.text) errors.push(`アンカーテキストが空の通常リンクがあります: ${link.href}`);
    if (/^https?:\/\/[^\s]+$/i.test(link.text) || /^www\.[^\s]+$/i.test(link.text)) errors.push(`URLベタ書きのアンカーテキストがあります: ${link.href}`);
    if (/^(こちら|詳細はこちら|公式サイト)$/i.test(link.text)) errors.push(`曖昧なアンカーテキストがあります: ${link.text}`);
  }
  return errors;
}
export function compareNormalLinks(beforeHtml, afterHtml) {
  const before = normalLinkSignatures(beforeHtml);
  const after = normalLinkSignatures(afterHtml);
  return JSON.stringify(before) === JSON.stringify(after) ? [] : [
    `装飾前後で通常リンクが一致しません（before=${before.length}, after=${after.length}）`,
  ];
}
export function sourceUrlMap(sourceTexts = []) {
  const map = new Map();
  for (const source of sourceTexts) {
    const textSource = String(source || '');
    for (const match of textSource.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) {
      const labels = map.get(match[2]) || new Set();
      labels.add(match[1].trim());
      map.set(match[2], labels);
    }
    for (const match of textSource.matchAll(/(https?:\/\/[^\s)>\]]+)/g)) {
      const url = match[1].replace(/[、。.,;]+$/g, '');
      if (!map.has(url)) map.set(url, new Set());
      const line = textSource.slice(0, match.index).split(/\r?\n/).pop() + textSource.slice(match.index, textSource.indexOf('\n', match.index) < 0 ? textSource.length : textSource.indexOf('\n', match.index));
      const label = line.replace(url, '').replace(/^[\s#*\-[\]]+/, '').replace(/\[[^\]]*\]\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
      if (label) map.get(url).add(label);
    }
  }
  return map;
}
function meaningfulTokens(s) {
  return String(s || '').replace(/https?:\/\/\S+/g, '').split(/[／/｜|・\s　、。:：()（）「」『』\[\]【】\-ー]+/).map((x) => x.trim()).filter((x) => x.length >= 3 && !/^(公式サイト|案内|情報|詳細|確認先|関連|ページ)$/.test(x));
}
export function validateExternalLinksAgainstSources(html, sourceTexts = [], { articleSlug = '', sourceDirs = [] } = {}) {
  const errors = [];
  const adopted = sourceUrlMap(sourceTexts);
  const externalLinks = normalLinkSignatures(html).filter((link) => /^https?:\/\//i.test(link.href));
  for (const dir of sourceDirs) {
    if (articleSlug && !String(dir).includes(`articles/${articleSlug}`)) errors.push(`記事slugと異なるリンク資料を読み込んでいます: ${dir}`);
  }
  const touringForbidden = [/jars\.gr\.jp/i, /wwwtb\.mlit\.go\.jp\/kanto/i, /keikenkyo\.or\.jp/i, /police\.pref\.chiba\.jp/i, /poi-poi\.co\.jp\/bike\/?$/i];
  for (const link of externalLinks) {
    if (!adopted.has(link.href)) errors.push(`採用資料にない外部URLがあります: ${link.href}`);
    if (/touring/i.test(articleSlug) && touringForbidden.some((re) => re.test(link.href))) errors.push(`別記事用の出典が混入しています: ${link.href}`);
    const labels = [...(adopted.get(link.href) || [])];
    const tokens = labels.flatMap(meaningfulTokens);
    if (tokens.length && !tokens.some((token) => link.text.includes(token))) errors.push(`アンカーテキストとリンク先の内容が一致しません: ${link.text} -> ${link.href}`);
  }
  return [...new Set(errors)];
}
export function validateDecoratedHtml(html) {
  const errors = [];
  errors.push(...validateAnchorNavigation(html));
  const ids = [...html.matchAll(/id=["']([^"']+)["']/gi)].map((m) => m[1]);
  const seen = new Set();
  for (const id of ids) { if (seen.has(id)) errors.push(`IDが重複しています: ${id}`); seen.add(id); }
  for (const href of [...html.matchAll(/href=["']#([^"']*)["']/gi)].map((m) => m[1])) { if (!href) errors.push('空のアンカーリンクがあります'); else if (!seen.has(href)) errors.push(`存在しないページ内アンカーがあります: #${href}`); }
  if (/href=["']#["']/i.test(html) || /href=["']["']/i.test(html)) errors.push('空のhrefがあります');
  if ((html.match(/swell-block-capbox|cap_box/g) || []).length && !/cap_box_content/.test(html)) errors.push('capboxの本文領域が見つかりません');
  errors.push(...validateNoManualToc(html));
  errors.push(...validateMarkerPlacement(parseFragment(html)));
  return errors;
}
export async function writeDecorationManifest(slug) {
  const { html, hash } = await readDecorated(slug);
  const errors = validateDecoratedHtml(html);
  if (errors.length) throw new Error(errors.join('\n'));
  const manifest = { slug, file: 'article-decorated.html', sha256: hash };
  await writeFile(path.join(articleDir(slug), 'decoration-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
export async function checkDecorationManifest(slug, { requireManifest = true } = {}) {
  const { html, hash } = await readDecorated(slug);
  const errors = validateDecoratedHtml(html);
  const manifestPath = path.join(articleDir(slug), 'decoration-manifest.json');
  if (!existsSync(manifestPath)) { if (requireManifest) errors.push('decoration-manifest.json が存在しません'); }
  else {
    let manifest;
    try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch { errors.push('decoration-manifest.json が有効なJSONではありません'); }
    if (manifest && manifest.sha256 && manifest.sha256 !== hash) errors.push('decoration-manifest.json のSHA-256とarticle-decorated.htmlが一致しません');
    if (manifest && manifest.decorated_sha256 && manifest.decorated_sha256 !== hash) errors.push('decoration-manifest.json のdecorated_sha256とarticle-decorated.htmlが一致しません');
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { sha256: hash };
}

export function isGeneratedTocCapbox(n){return hasClass(n,'swell-block-capbox')&&attr(n,'data-generated-toc')==='true'&&['この記事でわかること','【この記事でわかること】','この章でわかること'].includes(capTitle(n))}
export function removeGeneratedTocCapboxes(root){for(const n of els(root,'div').filter(isGeneratedTocCapbox))replace(root,n,[])}
export function headingItems(nodes){return nodes.map(h=>({id:attr(h,'id'),title:text(h).trim()}))}
function blockStartNode(root,node){const p=parent(root,node); if(!p)return node; let i=p.childNodes.indexOf(node)-1; while(i>=0&&p.childNodes[i].nodeName==='#text'&&!String(p.childNodes[i].value||'').trim())i--; const prev=p.childNodes[i]; return prev?.nodeName==='#comment'&&/\bwp:heading\b/.test(prev.data||'')?prev:node}
function blockEndNode(root,node){const p=parent(root,node); if(!p)return node; let i=p.childNodes.indexOf(node)+1; while(i<p.childNodes.length&&p.childNodes[i].nodeName==='#text'&&!String(p.childNodes[i].value||'').trim())i++; const next=p.childNodes[i]; return next?.nodeName==='#comment'&&/\/wp:/.test(next.data||'')?next:node}
export function insertOutline(root,title='【この記事でわかること】'){const h2s=els(root,'h2'); if(!h2s.length)return; before(root,blockStartNode(root,h2s[0]),capbox(title,headingItems(h2s)))}
export function insertSectionNavigation(root,{minimum_h3=3,default_title='この章でわかること'}={}){for(const h2 of els(root,'h2')){const h3s=sectionNodes(root,h2).filter(n=>n.tagName==='h3'); if(h3s.length<minimum_h3)continue; const nodes=sectionNodes(root,h2); const firstH3Index=nodes.findIndex(n=>n.tagName==='h3'); const intro=nodes.slice(0,firstH3Index<0?nodes.length:firstH3Index).filter(n=>!(n.nodeName==='#text'&&!String(n.value||'').trim())&&n.nodeName!=='#comment'); const ref=blockEndNode(root,intro.at(-1)||h2); after(root,ref,capbox(default_title,headingItems(h3s)))}}
function headingList(html){return [...html.matchAll(/<!--\s*wp:heading\s*(\{[\s\S]*?\})?\s*-->\s*<h([23])\b([^>]*)>([\s\S]*?)<\/h\2>\s*<!--\s*\/wp:heading\s*-->/gi)].map(m=>{let attrs={}; try{attrs=m[1]?JSON.parse(m[1]):{}}catch{} const id=(m[3].match(/\sid=["']([^"']+)["']/i)||[])[1]||''; return {level:Number(m[2]),id,anchor:attrs.anchor||'',text:String(m[4]).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim(),index:m.index}})}
export function validateAnchorNavigation(html){const errors=[]; const hs=headingList(html); for(const h of hs){if(!h.id)errors.push(`H${h.level} id is missing: ${h.text}`); if(!h.anchor)errors.push(`H${h.level} anchor is missing: ${h.text}`); if(h.id&&h.anchor&&h.id!==h.anchor)errors.push(`H${h.level} idとanchorが一致しません: ${h.id} != ${h.anchor}`)} const h2s=hs.filter(h=>h.level===2); const root=parseFragment(html); const capboxes=els(root,'div').filter(isGeneratedTocCapbox); const outline=capboxes.find(c=>capTitle(c)==='【この記事でわかること】'||capTitle(c)==='この記事でわかること'); if(h2s.length){if(!outline)errors.push('記事冒頭のH2アンカー一覧がありません'); else {const links=els(outline,'a').map(a=>({href:attr(a,'href'),text:text(a).trim()})); if(links.length!==h2s.length)errors.push(`H2件数と記事冒頭アンカーリンク数が一致しません: ${h2s.length} != ${links.length}`); links.forEach((l,i)=>{const h=h2s[i]; if(!h)return; if(l.href!==`#${h.id}`)errors.push(`H2アンカーリンク順/リンク先が一致しません: ${l.href} != #${h.id}`); if(l.text!==h.text)errors.push(`H2アンカーテキストが一致しません: ${l.text} != ${h.text}`);});}} for(let i=0;i<h2s.length;i++){const h2=h2s[i]; const end=h2s[i+1]?.index??html.length; const child=hs.filter(h=>h.level===3&&h.index>h2.index&&h.index<end); if(child.length>=3){const secCaps=capboxes.filter(c=>capTitle(c)==='この章でわかること'&&els(c,'a').some(a=>child.some(h=>attr(a,'href')===`#${h.id}`))); if(secCaps.length!==1)errors.push(`H2直下のH3アンカー一覧がありません: ${h2.text}`); else {const links=els(secCaps[0],'a').map(a=>({href:attr(a,'href'),text:text(a).trim()})); if(links.length!==child.length)errors.push(`H3件数と章内アンカーリンク数が一致しません: ${h2.text}`); links.forEach((l,j)=>{const h=child[j]; if(!h)return; if(l.href!==`#${h.id}`)errors.push(`H3アンカーリンク順/リンク先が一致しません: ${l.href} != #${h.id}`); if(l.text!==h.text)errors.push(`H3アンカーテキストが一致しません: ${l.text} != ${h.text}`);});}}} return errors}
