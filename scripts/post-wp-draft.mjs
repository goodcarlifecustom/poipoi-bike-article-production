import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import { parseScalar } from './workflow-utils.mjs';
import { checkDecorationManifest, readDecorated, sha256 } from './decoration-utils.mjs';
const execFileAsync = promisify(execFile);
function arg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
function sanitize(text='') { let out=String(text); for (const s of [process.env.WP_USERNAME, process.env.WP_APP_PASSWORD]) if (s) out=out.split(s).join('[redacted]'); return out.replace(/Authorization:\s*Basic\s+[A-Za-z0-9+/=]+/gi,'Auth header [redacted]'); }
function apiUrl(root, p) { return new URL(p, root).toString(); }
function statusOk(s) { return s >= 200 && s < 300; }
function normalizeRoot(root) { return root.endsWith('/') ? root : `${root}/`; }
export function requireWpEnv(env = process.env) { for (const k of ['WP_REST_ROOT','WP_USERNAME','WP_APP_PASSWORD','WP_DEFAULT_STATUS']) if (!env[k]) throw new Error(`${k} is required.`); if (env.WP_DEFAULT_STATUS !== 'draft') throw new Error('WP_DEFAULT_STATUS must be draft.'); return { root: normalizeRoot(env.WP_REST_ROOT) }; }
export function buildMinimalDraftPayload({ title, slug, contentSha, requestId }) { return { title, slug, status: 'draft', content: `<!-- codex-staged-draft slug=${slug} sha256=${contentSha} request-id=${requestId} -->` }; }
export function buildContentUpdatePayload(content) { return { content }; }
export function buildTitleUpdatePayload(title) { return { title }; }
async function fail(dir, message, details='') { const report = `# WordPress下書き投稿失敗\n\n- reason: ${sanitize(message)}${details ? `\n- details: ${sanitize(details)}` : ''}\n`; await writeFile(path.join(dir,'check-report.md'), report, 'utf8'); console.error(report); }
async function pyRequest(args, input='') { const script = `
import json, os, sys, urllib.request, urllib.parse, base64
method,url=sys.argv[1],sys.argv[2]
body=sys.stdin.buffer.read() if method in ('POST','PUT','PATCH') else None
headers={'User-Agent':'article-production staged wordpress draft workflow'}
if len(sys.argv) > 3 and sys.argv[3] == 'auth':
    token=base64.b64encode((os.environ['WP_USERNAME']+':'+os.environ['WP_APP_PASSWORD']).encode()).decode()
    headers['Authorization']='Basic '+token
if body:
    headers['Content-Type']='application/json; charset=utf-8'
opener=urllib.request.build_opener(urllib.request.ProxyHandler())
req=urllib.request.Request(url, data=body, headers=headers, method=method)
try:
    with opener.open(req, timeout=int(os.environ.get('WP_REQUEST_TIMEOUT','180'))) as r:
        sys.stdout.write(str(r.status)+'\\n')
        sys.stdout.flush()
        sys.stdout.buffer.write(r.read())
except urllib.error.HTTPError as e:
    sys.stdout.write(str(e.code)+'\\n')
    sys.stdout.flush()
    sys.stdout.buffer.write(e.read())
    sys.exit(2)
`; return execFileAsync('python3', ['-c', script, ...args], { input, maxBuffer: 8*1024*1024, env: process.env, timeout: Number(process.env.WP_PROCESS_TIMEOUT || 240000) }); }

async function curlRequest(method, url, auth=false, payload=null) {
  const args = ['-sS', '--max-time', String(process.env.WP_REQUEST_TIMEOUT || 180), '-X', method, '-w', '\n%{http_code}', '-H', 'Content-Type: application/json; charset=utf-8'];
  if (auth) args.push('-u', `${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`);
  if (payload) args.push('--data-binary', '@-');
  args.push(url);
  try {
    const { stdout } = await execFileAsync('curl', args, { input: payload ? JSON.stringify(payload) : '', maxBuffer: 8*1024*1024, timeout: Number(process.env.WP_PROCESS_TIMEOUT || 240000) });
    const text = String(stdout); const idx = text.lastIndexOf('\n'); const status = Number(text.slice(idx+1)); const body = idx >= 0 ? text.slice(0, idx) : '';
    return { status, body };
  } catch (error) {
    const err = new Error(`WordPress request failed for ${method} ${url}: ${error.killed ? 'request timed out' : `exit code ${error.code ?? 'unknown'}`}`);
    err.timeout = Boolean(error.killed) || /timed out|Operation timed out/i.test(String(error.stderr || error.message));
    throw err;
  }
}

export async function request(method, url, auth=false, payload=null) {
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') return curlRequest(method, url, auth, payload);
  let stdout;
  try { ({ stdout } = await pyRequest([method, url, auth?'auth':'anon'], payload ? JSON.stringify(payload) : '')); }
  catch (error) {
    stdout = error.stdout || '';
    if (!stdout) {
      const errText = error.stderr ? ` stderr: ${error.stderr}` : '';
      const reason = error.killed ? 'request timed out' : `exit code ${error.code ?? 'unknown'}${errText}`;
      const err = new Error(`WordPress request failed for ${method} ${url}: ${reason}`);
      err.timeout = Boolean(error.killed);
      throw err;
    }
  }
  const text=String(stdout); const first=text.split(/\n/,1)[0]; const status=Number(first); const body=text.includes('\n') ? text.slice(text.indexOf('\n')+1) : '';
  return { status, body };
}
function parseJson(body, fallback) { try { return JSON.parse(body || ''); } catch { return fallback; } }
function rawContent(post) { return post?.content?.raw ?? post?.content?.rendered ?? ''; }
function postTitle(post) { return post?.title?.raw ?? post?.title?.rendered ?? post?.title ?? ''; }
async function getPost(root, id) {
  const r = await request('GET', apiUrl(root, `wp/v2/posts/${id}?context=edit`), true);
  if (r.status === 404) return null;
  if (!statusOk(r.status)) throw new Error(`post ${id} check failed: ${r.status}`);
  return parseJson(r.body, null);
}
async function searchBySlug(root, slug) {
  const statuses = 'publish,draft,pending,private,future';
  const r = await request('GET', apiUrl(root, `wp/v2/posts?slug=${encodeURIComponent(slug)}&status=${statuses}&context=edit&per_page=100`), true);
  if (!statusOk(r.status)) throw new Error(`duplicate check failed: ${r.status}`);
  return parseJson(r.body, []);
}
async function searchRecent(root, slug, title, requestId, contentSha) {
  const posts = await searchBySlug(root, slug);
  return posts.filter((p) => p.status === 'draft' && (postTitle(p).includes(title) || rawContent(p).includes(requestId) || rawContent(p).includes(contentSha)));
}
export async function resolveDraft({ root, slug, title, preferredId = 29442 }) {
  const preferred = await getPost(root, preferredId).catch((e) => { if (/404/.test(e.message)) return null; throw e; });
  if (preferred) {
    if (preferred.status === 'publish') throw new Error(`投稿ID ${preferredId} はpublishのため更新しません。`);
    if (preferred.status === 'draft' && preferred.slug === slug) return { post: preferred, action: 'existing-id' };
    throw new Error(`投稿ID ${preferredId} は対象下書きではありません。status=${preferred.status}, slug=${preferred.slug}`);
  }
  const posts = await searchBySlug(root, slug);
  if (posts.some((p) => ['publish','future','pending','private'].includes(p.status))) throw new Error('同一スラッグのpublish/future/pending/privateが存在するため停止しました。');
  const drafts = posts.filter((p) => p.status === 'draft');
  if (drafts.length > 1) throw new Error('同一スラッグのdraftが複数存在するため停止しました。');
  if (drafts.length === 1) return { post: drafts[0], action: 'existing-slug-draft' };
  return { post: null, action: 'create' };
}
async function createMinimalDraft({ root, slug, title, contentSha, requestId, startedAt }) {
  const payload = buildMinimalDraftPayload({ title, slug, contentSha, requestId });
  try {
    const r = await request('POST', apiUrl(root, 'wp/v2/posts'), true, payload);
    if (!statusOk(r.status)) throw new Error(`minimal draft create failed: ${r.status} ${r.body}`);
    return { post: parseJson(r.body, null), result: 'created' };
  } catch (e) {
    if (!e.timeout) throw e;
    const matches = await searchRecent(root, slug, title, requestId, contentSha);
    if (matches.length === 1) return { post: matches[0], result: 'created-timeout-recovered' };
    throw new Error(`最小下書き作成がタイムアウトし、再検索結果が${matches.length}件だったため再POSTせず停止しました。`);
  }
}
async function updateTitleIfNeeded(root, post, title) {
  if (postTitle(post).replace(/<[^>]+>/g, '') === title) return { result: 'unchanged' };
  const r = await request('POST', apiUrl(root, `wp/v2/posts/${post.id}?_fields=id,status,slug,link,title`), true, buildTitleUpdatePayload(title));
  if (!statusOk(r.status)) throw new Error(`title update failed: ${r.status}`);
  return { result: 'updated' };
}
async function updateContentOnly({ root, postId, content, contentSha }) {
  try {
    const r = await request('POST', apiUrl(root, `wp/v2/posts/${postId}?_fields=id,status,slug,link`), true, buildContentUpdatePayload(content));
    if (!statusOk(r.status)) throw new Error(`content update failed: ${r.status}`);
    return { post: parseJson(r.body, null), result: 'updated' };
  } catch (e) {
    if (!e.timeout) throw e;
    const got = await getPost(root, postId);
    const wpSha = sha256(rawContent(got));
    if (wpSha === contentSha) return { post: got, result: 'update-timeout-saved' };
    throw new Error('本文更新がタイムアウトし、再取得した本文SHA-256が一致しないため再POSTせず停止しました。');
  }
}
async function appendReport(dir, text) { await writeFile(path.join(dir, 'check-report.md'), text, 'utf8'); }
export async function main() {
 const slug=arg('slug'); if(!slug){ console.error('Usage: npm run post -- --slug slug'); process.exit(1); }
 const dir=path.join('articles',slug); const input=await readFile(path.join(dir,'input.yml'),'utf8').catch(()=> '');
 if (parseScalar(input,'post_to_wp') !== 'true') { await fail(dir,'post_to_wp が true ではないため、WordPressへ接続しません。'); process.exit(1); }
 let env; try { env=requireWpEnv(); } catch(e){ await fail(dir,e.message); process.exit(1); }
 try {
  const metadata=JSON.parse(await readFile(path.join(dir,'metadata.json'),'utf8')); const title=metadata.title || parseScalar(input,'title');
  const decorated=await readDecorated(slug); await checkDecorationManifest(slug, { requireManifest: existsSync(path.join(dir, 'decoration-manifest.json')) });
  try { await execFileAsync('npm',['run','check','--','--slug',slug],{maxBuffer:2*1024*1024}); } catch(e){ throw new Error(`品質チェックに失敗したため投稿しません。\n${e.stdout || e.stderr || e.message}`); }
  const root=env.root; const requestId=crypto.randomUUID(); const startedAt=new Date().toISOString();
  const anon=await request('GET', root, false); if(!statusOk(anon.status)) throw new Error(`REST root GET failed: ${anon.status}`);
  const me=await request('GET', apiUrl(root, 'wp/v2/users/me?context=edit'), true); if(!statusOk(me.status)) throw new Error(`auth check failed: ${me.status}`);
  const types=await request('GET', apiUrl(root, 'wp/v2/types/post?context=edit'), true); if(!statusOk(types.status)) throw new Error(`capability check failed: ${types.status}`);
  const resolved=await resolveDraft({ root, slug, title, preferredId: Number(process.env.WP_PREFERRED_DRAFT_ID || 29442) });
  let post=resolved.post; let createResult=resolved.action;
  if (!post) { const created=await createMinimalDraft({ root, slug, title, contentSha: decorated.hash, requestId, startedAt }); post=created.post; createResult=created.result; }
  if (!post?.id) throw new Error('投稿IDを取得できませんでした。');
  if (post.status !== 'draft' || post.slug !== slug) throw new Error(`対象下書きの検証に失敗しました。status=${post.status}, slug=${post.slug}`);
  const titleResult=await updateTitleIfNeeded(root, post, title);
  const contentResult=await updateContentOnly({ root, postId: post.id, content: decorated.html, contentSha: decorated.hash });
  const got=await getPost(root, post.id); const wpRaw=rawContent(got); const wpSha=sha256(wpRaw);
  if (got.status !== 'draft') throw new Error(`再取得した投稿statusがdraftではありません: ${got.status}`);
  if (got.slug !== slug) throw new Error(`再取得した投稿slugが一致しません: ${got.slug}`);
  if (!wpRaw.trim()) throw new Error('再取得したcontent.rawが空です。');
  if (/<h1\b/i.test(wpRaw)) throw new Error('WordPress本文にH1があります。');
  if (wpSha !== decorated.hash) throw new Error('WordPress本文とarticle-decorated.htmlのSHA-256が一致しません。');
  metadata.status='draft'; metadata.wordpress_draft_id=got.id; metadata.wordpress_draft_url=got.link || null; metadata.decorated_content_sha256=decorated.hash; metadata.wordpress_content_sha256=wpSha; metadata.updated_at=new Date().toISOString(); metadata.notes=`${metadata.notes || ''}\nWordPress staged draft workflow completed. draft_id=${got.id}, create_result=${createResult}, content_result=${contentResult.result}, sha256 matched.`.trim();
  await writeFile(path.join(dir,'metadata.json'), JSON.stringify(metadata,null,2)+'\n');
  const result=`# WordPress下書き投稿結果\n\n- 投稿ID: ${got.id}\n- 下書きURL: ${got.link || ''}\n- title: ${title}\n- slug: ${got.slug}\n- status: ${got.status}\n- request_id: ${requestId}\n- 最小下書き作成結果: ${createResult}\n- タイトル更新結果: ${titleResult.result}\n- 本文更新結果: ${contentResult.result}\n- REST API再取得結果: success\n- article-decorated.html SHA-256: ${decorated.hash}\n- WordPress本文 SHA-256: ${wpSha}\n- SHA-256一致: yes\n- H1なし確認: yes\n- 装飾確認: success\n- 実行日時: ${new Date().toISOString()}\n`;
  await writeFile(path.join(dir,'wp-result.md'), result);
  const report=`# 品質チェックレポート\n\n- slug: ${slug}\n- result: PASS\n\n## WordPress完了確認\n\n- Local article validation: PASS\n- Decoration validation: PASS\n- WordPress connection: PASS\n- Duplicate check: PASS\n- Minimal draft createまたはexisting draft reuse: ${createResult}\n- Content update: ${contentResult.result}\n- REST API read-back: PASS\n- Content SHA match: PASS\n- Final status: ${got.status}\n- Overall: PASS\n`;
  await appendReport(dir, report); console.log(result);
 } catch(e){ await fail(dir,e.message); process.exit(1); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
