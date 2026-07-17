import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNoManualToc } from '../scripts/toc-validation.mjs';

const approvedOutline=[
  {level:2,text:'選び方'}, {level:3,text:'費用を見る'}, {level:3,text:'対応を見る'}, {level:2,text:'まとめ'}
];
function ok(html, opts={}){assert.deepEqual(validateNoManualToc(html, opts),[])}
function ng(html, pattern, opts={}){assert.match(validateNoManualToc(html, opts).join('\n'),pattern)}

test('PASS: intro summary box after lead before H2 uses div ul li and is not TOC',()=>{
  ok('<p>導入文です。</p><div class="summary"><p>この記事でわかること</p><ul><li>失敗しない選び方の考え方</li><li>費用を見るときの注意点</li><li>売却前に準備すること</li></ul></div><h2>選び方</h2><p>概要文です。</p><h3>費用を見る</h3><p>本文です。</p><h3>対応を見る</h3><p>本文です。</p><h2>まとめ</h2><p>本文です。</p>',{approvedOutline});
});

test('PASS: H2 lead paragraph followed by H3 and no article TOC',()=>{
  ok('<p>導入文です。</p><div><p>この記事でわかること</p><ul><li>比較前の整理方法</li><li>査定依頼時の注意点</li><li>納得して売る手順</li></ul></div><h2>選び方</h2><p>この章では概要を説明します。</p><h3>費用を見る</h3><p>本文です。</p><h3>対応を見る</h3><p>本文です。</p><h2>まとめ</h2><p>本文です。</p>',{approvedOutline});
});

test('FAIL: H2直下に全H3の一覧がある',()=>{
  ng('<h2>選び方</h2><p>概要文です。</p><ul><li>費用を見る</li><li>対応を見る</li></ul><h3>費用を見る</h3><p>本文です。</p><h3>対応を見る</h3><p>本文です。</p>',/H2直下に配下H3の一覧/);
});

test('FAIL: banned labels and toc shortcodes',()=>{
  ng('<h2>選び方</h2><p>この章でわかること</p><h3>費用を見る</h3><p>本文です。</p>',/章内の見出し一覧ラベル/);
  ng('<p>[swell_toc]</p><h2>選び方</h2><p>本文です。</p>',/\[swell_toc\]/);
  ng('<p>[toc]</p><h2>選び方</h2><p>本文です。</p>',/\[toc\]/);
});

test('FAIL: nav heading links',()=>{
  ng('<nav class="toc"><ul><li><a href="#a">選び方</a></li><li><a href="#b">まとめ</a></li></ul></nav><h2 id="a">選び方</h2><p>本文です。</p><h2 id="b">まとめ</h2><p>本文です。</p>',/目次用nav/);
});

test('PASS: regular external and internal links are not TOC even when H2/H3 ids exist',()=>{
  ok('<h2 id="price">料金確認</h2><p>通行料金は<a href="https://www.chiba-dourokousha.or.jp/price_list/">千葉県道路公社の通行料金案内</a>で確認してください。</p><h3 id="facility">施設</h3><p>施設情報は<a href="https://www.umihotaru.com/">海ほたる公式サイト</a>で確認できます。出発前には<a href="/bike/touring-items/">バイクツーリングの持ち物</a>も確認してください。</p>');
});

test('FAIL: heading anchors listed in ul/ol/nav are manual TOC',()=>{
  ng('<h2 id="a">選び方</h2><ul><li><a href="#b">費用を見る</a></li><li><a href="#c">対応を見る</a></li></ul><h3 id="b">費用を見る</h3><p>本文です。</p><h3 id="c">対応を見る</h3><p>本文です。</p>',/見出しへのアンカーリンク/);
  ng('<nav><a href="#a">選び方</a><a href="#b">まとめ</a></nav><h2 id="a">選び方</h2><p>本文です。</p><h2 id="b">まとめ</h2><p>本文です。</p>',/目次用nav|目次要素/);
});

test('FAIL: H3 before first H2 and duplicate H3',()=>{
  ng('<h3>費用を見る</h3><p>本文です。</p><h2>選び方</h2><p>本文です。</p>',/最初のH2より前にH3|親H2/);
  ng('<h2>選び方</h2><p>本文です。</p><h3>費用を見る</h3><p>本文です。</p><h3>費用を見る</h3><p>本文です。</p>',/同じ見出しタグ/);
});

test('FAIL: unapproved title contaminates opening body',()=>{
  ng('<p>別記事タイトル案</p><h2>選び方</h2><p>本文です。</p>',/未採用タイトル/,{metadata:{unused_titles:['別記事タイトル案']}});
});

test('PASS: plain HTML headings validate against an H2-only approved outline',()=>{
  ok('<h2 id="cases">ケース別</h2><p>本文です。</p><h3 id="loan">ローン中</h3><p>本文です。</p><h2 id="faq">質問</h2><p>本文です。</p><h3 id="cancel">断り方</h3><p>本文です。</p>', {approvedOutline:[{level:2,text:'ケース別'},{level:2,text:'質問'}]});
});
