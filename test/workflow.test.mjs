import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { assertSingleOutputCounts, normalizeRelatedKeywords, postToWpFromInputs, slugFromKeyword, validateSingleArticleInput } from '../scripts/workflow-utils.mjs';
import { requireWpEnv } from '../scripts/post-wp-draft.mjs';
const execFileAsync = promisify(execFile);
const repo = path.resolve('.');
async function run(args, cwd) { return execFileAsync('node', [path.join(repo,'scripts/create-article-dir.mjs'), ...args], { cwd, maxBuffer: 1024*1024 }); }

test('related_keywords array/comma normalization and duplicates', () => {
  assert.deepEqual(normalizeRelatedKeywords([' CTN　バイク  買取 口コミ ', 'CTN バイク 買取 評判', 'CTN バイク 買取 口コミ'], 'CTN バイク 買取 評判'), ['CTN バイク 買取 口コミ']);
  assert.deepEqual(normalizeRelatedKeywords('a, b, a,, c', 'main'), ['a','b','c']);
});

test('wordpress_draft conversion and default', () => {
  assert.equal(postToWpFromInputs({ wordpressDraft: 'true', postToWp: 'true' }), true);
  assert.equal(postToWpFromInputs({ wordpressDraft: undefined, postToWp: 'true' }), true);
  assert.equal(postToWpFromInputs({}), true);
  assert.throws(() => postToWpFromInputs({ wordpressDraft: 'false', postToWp: 'true' }), /must match/);
});

test('slug generation', () => { assert.equal(slugFromKeyword('CTN バイク買取 評判'), 'ctn-bike-kaitori-reviews'); });

test('create reads main_keyword and related_keywords list, writes required files', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'workflow-'));
  try {
    await mkdir(path.join(dir,'jobs'));
    await writeFile(path.join(dir,'jobs/in.yml'), 'main_keyword: "ネオクラシックバイク おすすめ"\nrelated_keywords:\n  - "ネオクラシックバイク 初心者"\n  - "ネオクラシックバイク 比較"\nwordpress_draft: false\ntarget_media: \"https://poi-poi.co.jp/bike/\"\narticle_type: \"比較\"\npersona: \"初心者\"\narticle_purpose: \"選び方を理解してもらう\"\nmin_word_count: 1000\ntarget_word_count: 1500\nmax_word_count: 2000\n');
    await run(['--input','jobs/in.yml'], dir);
    const articleDir = path.join(dir,'articles/neo-classic-bike-recommended');
    assert.equal(existsSync(articleDir), true);
    const input = await readFile(path.join(articleDir,'input.yml'),'utf8');
    assert.match(input, /main_keyword:/); assert.match(input, /related_keywords:/); assert.match(input, /post_to_wp: false/);
    assert.equal(existsSync(path.join(articleDir,'metadata.json')), true);
    assert.equal(existsSync(path.join(articleDir,'research.md')), true);
    await run(['--input','jobs/in.yml'], dir);
    assert.equal(existsSync(path.join(dir,'articles/neo-classic-bike-recommended-new')), true);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('create chooses final_slug sequence without overwriting previous article directories', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'workflow-'));
  const yml = 'main_keyword: "千葉 ツーリング"\nrelated_keywords:\n  - "千葉 バイク"\nwordpress_draft: false\ntarget_media: "https://poi-poi.co.jp/bike/"\narticle_type: "地域"\npersona: "売却検討者"\narticle_purpose: "情報収集"\nmin_word_count: 1000\ntarget_word_count: 1500\nmax_word_count: 2000\nslug: "chiba-touring"\n';
  try {
    await mkdir(path.join(dir,'jobs'));
    await writeFile(path.join(dir,'jobs/in.yml'), yml);
    await run(['--input','jobs/in.yml'], dir);
    await writeFile(path.join(dir,'articles/chiba-touring/sentinel.txt'), 'keep');
    await run(['--input','jobs/in.yml'], dir);
    await run(['--input','jobs/in.yml'], dir);
    assert.equal(existsSync(path.join(dir,'articles/chiba-touring/sentinel.txt')), true);
    const second = JSON.parse(await readFile(path.join(dir,'articles/chiba-touring-new/metadata.json'),'utf8'));
    const third = JSON.parse(await readFile(path.join(dir,'articles/chiba-touring-new-2/metadata.json'),'utf8'));
    assert.equal(second.base_slug, 'chiba-touring');
    assert.equal(second.final_slug, 'chiba-touring-new');
    assert.equal(second.generation_number, 2);
    assert.equal(third.final_slug, 'chiba-touring-new-2');
    assert.equal(third.generation_number, 3);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('single article input validation rejects multiple keywords, multiple outlines, and structured generation units', () => {
  assert.throws(() => validateSingleArticleInput('main_keyword:\n  - a\n  - b\n'), /MULTIPLE_ARTICLE_INPUT/);
  assert.throws(() => validateSingleArticleInput('main_keyword: a\nmain_keyword: b\n'), /MULTIPLE_ARTICLE_INPUT/);
  assert.throws(() => validateSingleArticleInput('main_keyword: a\napproved_outline: {}\napproved_outline: {}\n'), /MULTIPLE_ARTICLE_INPUT/);
  assert.throws(() => validateSingleArticleInput('main_keyword: a\narticle_jobs:\n  - main_keyword: a\n  - main_keyword: b\n'), /MULTIPLE_ARTICLE_INPUT/);
  assert.throws(() => validateSingleArticleInput('main_keyword: a\n1キーワード1記事で複数作成してください\n'), /MULTIPLE_ARTICLE_INPUT/);
});

test('single article input validation allows multi-keyword context and multi-model comparison inside one article', () => {
  assert.doesNotThrow(() => validateSingleArticleInput('main_keyword: "250cc バイク おすすめ"\nrelated_keywords:\n  - "250cc バイク 比較"\n  - "250cc バイク 初心者"\nbike_models:\n  - "レブル250"\n  - "GB350"\nsource_plan:\n  - "https://example.test/a"\n  - "https://example.test/b"\narticle_purpose: "1記事内で複数車種を比較する"\n'));
  assert.doesNotThrow(() => validateSingleArticleInput('main_keyword: "おすすめ車種"\nnotes: "見出しや本文で複数車種名を扱い、おすすめ車種を複数紹介する1記事"\n'));
});

test('single output count guard blocks second article directory or WordPress POST', () => {
  assert.doesNotThrow(() => assertSingleOutputCounts({ articleCount: 1, articleDirectoryCount: 1, wordpressPostCount: 1 }));
  assert.throws(() => assertSingleOutputCounts({ articleCount: 1, articleDirectoryCount: 2, wordpressPostCount: 0 }), /MULTIPLE_ARTICLE_OUTPUT_BLOCKED/);
  assert.throws(() => assertSingleOutputCounts({ articleCount: 1, articleDirectoryCount: 1, wordpressPostCount: 2 }), /MULTIPLE_ARTICLE_OUTPUT_BLOCKED/);
});

test('create supports comma related keywords and wordpress_draft true', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'workflow-'));
  try { await run(['--main-keyword','CTN バイク買取 評判','--related-keywords','CTN バイク買取 口コミ,CTN バイク買取 査定','--wordpress-draft','true','--target-media','https://poi-poi.co.jp/bike/','--article-type','評判','--persona','売却検討者','--article-purpose','評判の判断材料を示す','--min-word-count','1000','--target-word-count','1500','--max-word-count','2000'], dir);
    const input = await readFile(path.join(dir,'articles/ctn-bike-kaitori-reviews/input.yml'),'utf8');
    assert.match(input, /post_to_wp: true/); assert.match(input, /CTN バイク買取 口コミ/);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('post env safety', () => {
  assert.throws(() => requireWpEnv({}), /WP_REST_ROOT/);
  assert.throws(() => requireWpEnv({WP_REST_ROOT:'https://example.test/wp-json/', WP_USERNAME:'user', WP_APP_PASSWORD:'pass', WP_DEFAULT_STATUS:'publish'}), /draft/);
});

test('post_to_wp false exits before network/env requirement', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'workflow-'));
  try { await mkdir(path.join(dir,'articles/sample'), {recursive:true}); await writeFile(path.join(dir,'articles/sample/input.yml'),'post_to_wp: false\n');
    const p = await execFileAsync('node', [path.join(repo,'scripts/post-wp-draft.mjs'),'--slug','sample'], {cwd:dir, env:{PATH:process.env.PATH}, maxBuffer:1024*1024}).catch(e=>e);
    assert.notEqual(p.code, 0); const report = await readFile(path.join(dir,'articles/sample/check-report.md'),'utf8'); assert.match(report, /接続しません/);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
