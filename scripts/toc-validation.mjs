import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import * as parse5 from 'parse5';


function parseFragment(html){return parse5.parseFragment(html,{sourceCodeLocationInfo:false});}
function text(n){if(!n)return''; if(n.nodeName==='#text')return n.value||''; return (n.childNodes||[]).map(text).join('');}
function walk(n,fn){fn(n); for(const c of n.childNodes||[])walk(c,fn)}
function els(root,name){const out=[]; walk(root,n=>{if(n.tagName===name)out.push(n)}); return out;}
function attr(n,k){return n.attrs?.find(a=>a.name===k)?.value||''}
function hasClass(n,c){return (` ${attr(n,'class')} `).includes(` ${c} `)}
function parent(root,target){let p=null; walk(root,n=>{for(const c of n.childNodes||[])if(c===target)p=n}); return p;}
function sectionNodes(root,heading){const p=parent(root,heading); if(!p)return[]; const i=p.childNodes.indexOf(heading); const lvl=Number(heading.tagName.slice(1)); const out=[]; for(const n of p.childNodes.slice(i+1)){if(/^h[1-6]$/.test(n.tagName||'')&&Number(n.tagName.slice(1))<=lvl)break; out.push(n)} return out;}
function capTitle(n){return hasClass(n,'swell-block-capbox')? text((n.childNodes||[]).find(c=>hasClass(c,'cap_box_ttl'))).trim():''}

function norm(s){return String(s||'').replace(/\s+/g,' ').trim();}
function visible(n){return norm(text(n));}
function stripTags(s){return String(s||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();}
function headings(root){return [...els(root,'h2').map(n=>({level:2,node:n,text:visible(n)})),...els(root,'h3').map(n=>({level:3,node:n,text:visible(n)}))].sort((a,b)=>order(root,a.node)-order(root,b.node));}
function order(root,target){let i=0, found=-1; (function walk(n){if(n===target)found=i; i++; for(const c of n.childNodes||[])walk(c)})(root); return found;}
function descendants(n,name){return els(n,name);}
function linkListTargets(root,n){const links=descendants(n,'a').map(a=>attr(a,'href')).filter(h=>h.startsWith('#')); return links;}
function isManualTocNav(root,n){if(n.tagName!=='nav')return false; const label=[attr(n,'class'),attr(n,'id'),attr(n,'aria-label'),visible(n)].join(' '); return /目次|toc|index|table-of-contents|outline/i.test(label)||linkListTargets(root,n).length>=2;}
function directMeaningful(nodes){return nodes.filter(n=>!(n.nodeName==='#text'&&!norm(n.value))&&n.nodeName!=='#comment');}
function parsePlanHeadings(plan){return [...String(plan||'').matchAll(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map(m=>({level:Number(m[1]),text:stripTags(m[2])}));}
export async function loadApprovedOutline(dir){const json=path.join(dir,'approved_outline.json'); if(existsSync(json)){const data=JSON.parse(await readFile(json,'utf8')); const arr=Array.isArray(data)?data:(data.headings||data.outline||[]); return arr.flatMap(h=> h.h3 ? [{level:2,text:h.h2||h.heading||h.text},...h.h3.map(x=>({level:3,text:typeof x==='string'?x:(x.heading||x.text)}))] : [{level:h.level||2,text:h.heading||h.text||h.title}]).filter(h=>h.text);}
 const plan=path.join(dir,'heading-plan.md'); if(existsSync(plan))return parsePlanHeadings(await readFile(plan,'utf8'));
 return [];
}
export function validateNoManualToc(html,{approvedOutline=[],metadata={}}={}){
 const errors=[]; const root=parseFragment(html); const raw=String(html||'');
 if(/\[swell_toc\]/i.test(raw))errors.push('[swell_toc] が存在します');
 if(/\[toc\]/i.test(raw))errors.push('[toc] が存在します');
 if(/\[(?:table_of_contents|ez-toc|toc[^\]]*)\]/i.test(raw))errors.push('目次用shortcodeが存在します');
 const bodyText=visible(root);
 if(/この章でわかること|このセクションでわかること|この章の内容|各章でわかること/.test(bodyText))errors.push('章内の見出し一覧ラベルが存在します');
 for(const n of els(root,'nav')) if(isManualTocNav(root,n)) errors.push('手動生成された目次用navが存在します');
 for(const n of [...els(root,'h2'),...els(root,'h3'),...els(root,'p'),...els(root,'div')]){const t=visible(n); if(/^(目次|INDEX|TOC)$/i.test(t)&& (descendants(n,'a').length||hasClass(n,'toc')||/toc|index|目次/i.test(attr(n,'class')+attr(n,'id')))) errors.push('「目次」「INDEX」が目次要素として本文に存在します');}
 const hs=headings(root); const firstH2=hs.find(h=>h.level===2); const firstH3=hs.find(h=>h.level===3); if(firstH3&&(!firstH2||order(root,firstH3.node)<order(root,firstH2.node))) errors.push('最初のH2より前にH3が存在します');
 let currentH2=null; for(const h of hs){if(h.level===2)currentH2=h; if(h.level===3&&!currentH2)errors.push(`H3に対応する親H2が存在しません: ${h.text}`);}
 const seen=new Set(); for(const h of hs){const key=`h${h.level}:${h.text}`; if(seen.has(key))errors.push(`同じ見出しタグが複数回出現します: ${key}`); seen.add(key);}
 for(const h2 of els(root,'h2')){const nodes=directMeaningful(sectionNodes(root,h2)); const h3s=sectionNodes(root,h2).filter(n=>n.tagName==='h3').map(visible); const beforeH3=nodes.slice(0,nodes.findIndex(n=>n.tagName==='h3')<0?nodes.length:nodes.findIndex(n=>n.tagName==='h3'));
   for(const n of beforeH3){const links=linkListTargets(root,n); const items=[...descendants(n,'li')].map(visible); const cap=hasClass(n,'swell-block-capbox')?capTitle(n):''; const joined=visible(n); const matches=h3s.filter(t=>t&&(items.includes(t)||joined.includes(t))).length; if(cap==='この章でわかること'||(h3s.length&&matches>=Math.min(2,h3s.length))) errors.push(`H2直下に配下H3の一覧が存在します: ${visible(h2)}`); if(links.length>=2&&descendants(n,'a').every(a=>attr(a,'href').startsWith('#'))) errors.push(`見出しへのアンカーリンクを並べた一覧が存在します: ${visible(h2)}`); }
 }
 const introBoxes=els(root,'div').filter(d=>/この記事でわかること/.test(visible(d))); if(introBoxes.length>1)errors.push('「この記事でわかること」が複数存在します'); for(const box of introBoxes){if(descendants(box,'h2').length||descendants(box,'h3').length)errors.push('「この記事でわかること」に見出しタグが使われています'); if(linkListTargets(root,box).length)errors.push('「この記事でわかること」に見出しアンカーリンクがあります'); const listTexts=descendants(box,'li').map(visible); const headingTexts=hs.map(h=>h.text); if(listTexts.some(x=>headingTexts.includes(x)))errors.push('「この記事でわかること」に見出し文字列が転載されています'); if(listTexts.length&& (listTexts.length<3||listTexts.length>5))errors.push('「この記事でわかること」は3〜5項目で要約してください'); }
 if(approvedOutline.length){const approved=approvedOutline.map(h=>({level:Number(h.level),text:norm(h.text)})).filter(h=>h.level&&h.text); const actual=hs.map(h=>({level:h.level,text:h.text})); if(JSON.stringify(actual)!==JSON.stringify(approved))errors.push('承認済みH2・H3の件数、順序、親子関係が異なります'); }
 const titles=[...(metadata.unused_titles||metadata.rejected_titles||[])].filter(Boolean); for(const title of titles){if(bodyText.includes(title))errors.push(`未採用タイトルが本文へ混入しています: ${title}`)}
 return [...new Set(errors)];
}
