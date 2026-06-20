import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
const fixtureRoot = 'test/fixtures/decoration-article';
function sh(args){return execFileSync('npm',args,{encoding:'utf8',stdio:'pipe'});}
function prepare(slug){rmSync(`articles/${slug}`,{recursive:true,force:true}); mkdirSync(`articles/${slug}`,{recursive:true}); cpSync(fixtureRoot,`articles/${slug}`,{recursive:true});}
function cleanup(slug){rmSync(`articles/${slug}`,{recursive:true,force:true});}

test('decorate creates ids, outline, h3 nav, capbox, markers and is idempotent without WordPress',()=>{
  const slug='decoration-fixture'; prepare(slug);
  try {
    const sourceBefore=readFileSync(`articles/${slug}/article.html`,'utf8');
    sh(['run','decorate','--','--slug',slug]);
    const one=readFileSync(`articles/${slug}/article-decorated.html`,'utf8');
    sh(['run','decorate','--','--slug',slug]);
    const two=readFileSync(`articles/${slug}/article-decorated.html`,'utf8');
    assert.equal(two,one);
    assert.equal(readFileSync(`articles/${slug}/article.html`,'utf8'),sourceBefore);
    assert.match(one,/id="section-01"/);
    assert.match(one,/id="existing-summary"/);
    assert.match(one,/【この記事でわかること】/);
    assert.match(one,/この章でわかること/);
    assert.match(one,/買取業者を比較するときの確認項目/);
    assert.match(one,/<span class="swl-marker mark_yellow">査定条件を同じ基準で比較することが重要です<\/span>/);
    assert.match(one,/<mark[^>]+>契約後のキャンセル条件は業者によって異なります<\/mark>/);
    assert.equal(existsSync(`articles/${slug}/decoration-manifest.json`), true);
    sh(['run','check:decoration','--','--slug',slug]);
  } finally { cleanup(slug); }
});

test('invalid placeholder title fails decoration',()=>{
  const slug='decoration-bad'; prepare(slug);
  try {
    const c=JSON.parse(readFileSync(`articles/${slug}/decoration.json`));
    c.list_boxes[0].title='ここにタイトル';
    writeFileSync(`articles/${slug}/decoration.json`,JSON.stringify(c));
    assert.throws(()=>sh(['run','decorate','--','--slug',slug]));
  } finally { cleanup(slug); }
});

test('new article template enables decoration config without changing WordPress posting defaults',()=>{
  const slug='template-decoration-test'; cleanup(slug);
  try {
    sh(['run','create','--','--main-keyword','テンプレート バイク','--related-keywords','テンプレート バイク 買取','--slug',slug]);
    assert.equal(JSON.parse(readFileSync(`articles/${slug}/decoration.json`)).enabled,true);
    assert.match(readFileSync(`articles/${slug}/input.yml`,'utf8'),/post_to_wp: false/);
  } finally { cleanup(slug); }
});
