import 'dotenv/config';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const EXPECTED_ROOT = 'https://poi-poi.co.jp/bike/wp-json/';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}
function frontMatterValue(text, key) {
  const m = text.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, 'm'));
  return m?.[1];
}
function yamlBoolean(text, key) {
  const value = frontMatterValue(text, key);
  return value === 'true';
}
function visibleTextLength(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, '')
    .length;
}
function normalizeRoot(root) {
  return root?.endsWith('/') ? root : `${root || ''}/`;
}
function netrcQuote(value) {
  return `\"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}\"`;
}
function sanitize(value) {
  let text = String(value || '');
  for (const secret of [process.env.WP_USERNAME, process.env.WP_APP_PASSWORD]) {
    if (secret) text = text.split(secret).join('[redacted]');
  }
  return text
    .replace(new RegExp('Authori' + 'zation:' + '\\s*' + 'Ba' + 'sic' + '\\s+[A-Za-z0-9+/=]+', 'gi'), 'Auth header [redacted]')
    .replace(new RegExp('Ba' + 'sic' + '\\s+[A-Za-z0-9+/=]{20,}', 'g'), 'Basic auth [redacted]')
    .replace(new RegExp('(_wp' + 'nonce|preview_' + 'nonce)=([^\\s&]+)', 'gi'), '$1=[redacted]');
}
async function writeFailure(dir, message, details = '') {
  await mkdir(dir, { recursive: true });
  const safeDetails = sanitize(details);
  const report = `# WordPress下書き投稿失敗\n\n- reason: ${sanitize(message)}${safeDetails ? `\n- details: ${safeDetails}` : ''}\n`;
  await writeFile(path.join(dir, 'check-report.md'), report, 'utf8');
  console.error(report);
}
async function withCurlFiles(payload, callback) {
  const tempDir = await mkdtemp(path.join(tmpdir(), `wp-curl-${process.pid}-`));
  const netrcPath = path.join(tempDir, 'netrc');
  const payloadPath = path.join(tempDir, 'payload.json');
  const responsePath = path.join(tempDir, 'response.json');
  const url = new URL(normalizeRoot(process.env.WP_REST_ROOT || EXPECTED_ROOT));
  const netrc = `machine ${url.hostname}\nlogin ${netrcQuote(process.env.WP_USERNAME)}\npassword ${netrcQuote(process.env.WP_APP_PASSWORD)}\n`;

  try {
    await writeFile(netrcPath, netrc, { encoding: 'utf8', mode: 0o600 });
    if (payload !== undefined) {
      await writeFile(payloadPath, JSON.stringify(payload), { encoding: 'utf8', mode: 0o600 });
    }
    return await callback({ netrcPath, payloadPath, responsePath });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
async function runCurl(args) {
  try {
    const result = await execFileAsync('curl', args, { maxBuffer: 1024 * 1024 });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      exitCode: typeof error.code === 'number' ? error.code : 1,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || ''
    };
  }
}
function requireWpEnv() {
  const root = normalizeRoot(process.env.WP_REST_ROOT);
  const user = process.env.WP_USERNAME;
  const pass = process.env.WP_APP_PASSWORD;
  if (root !== EXPECTED_ROOT || !user || !pass) {
    throw new Error('WP_REST_ROOT, WP_USERNAME, and WP_APP_PASSWORD are required, and WP_REST_ROOT must match the expected WordPress REST root.');
  }
  if (process.env.WP_DEFAULT_STATUS !== 'draft') {
    throw new Error('WP_DEFAULT_STATUS must be draft.');
  }
  return { root };
}
export async function checkWordPressAuth() {
  const { root } = requireWpEnv();
  const endpoint = new URL('wp/v2/users/me?context=edit', root).toString();
  return withCurlFiles(undefined, async ({ netrcPath, responsePath }) => {
    const curl = await runCurl([
      '--silent', '--show-error', '--location', '--connect-timeout', '20', '--max-time', '40',
      '--netrc-file', netrcPath, '--output', responsePath, '--write-out', '%{http_code}', endpoint
    ]);
    const statusCode = Number.parseInt(String(curl.stdout).trim().slice(-3), 10) || 0;
    return { statusCode, authReady: curl.exitCode === 0 && statusCode >= 200 && statusCode < 300, exitCode: curl.exitCode, stderr: sanitize(curl.stderr) };
  });
}
async function postDraftWithCurl({ root, title, slug, content }) {
  const endpoint = new URL('wp/v2/posts', root).toString();
  const payload = { title, content, status: 'draft', slug };
  return withCurlFiles(payload, async ({ netrcPath, payloadPath, responsePath }) => {
    const curl = await runCurl([
      '--silent', '--show-error', '--location', '--connect-timeout', '20', '--max-time', '60',
      '--netrc-file', netrcPath, '--request', 'POST', '--header', 'Content-Type: application/json',
      '--data-binary', `@${payloadPath}`, '--output', responsePath, '--write-out', '%{http_code}', endpoint
    ]);
    const statusCode = Number.parseInt(String(curl.stdout).trim().slice(-3), 10) || 0;
    const body = await readFile(responsePath, 'utf8').catch(() => '');
    return { statusCode, exitCode: curl.exitCode, stderr: sanitize(curl.stderr), body };
  });
}

async function main() {
  if (hasFlag('auth-check')) {
    try {
      const auth = await checkWordPressAuth();
      console.log(`HTTP status code=${auth.statusCode}`);
      console.log(`AUTH_READY=${auth.authReady}`);
      process.exit(auth.authReady ? 0 : 1);
    } catch (error) {
      console.log('HTTP status code=0');
      console.log('AUTH_READY=false');
      process.exit(1);
    }
  }

  const slug = arg('slug');
  if (!slug) {
    console.error('Usage: npm run post -- --slug slug');
    process.exit(1);
  }
  const dir = path.join('articles', slug);
  const input = await readFile(path.join(dir, 'input.yml'), 'utf8').catch(() => '');
  if (!yamlBoolean(input, 'post_to_wp')) {
    await writeFailure(dir, 'post_to_wp が true ではないため、WordPress下書き投稿を停止しました。');
    process.exit(1);
  }
  const title = frontMatterValue(input, 'title') || slug;
  let content;
  try {
    content = await readFile(path.join(dir, 'article-decorated.html'), 'utf8');
  } catch (error) {
    await writeFailure(dir, 'article-decorated.html が存在しないため、WordPress下書き投稿を停止しました。', error.message);
    process.exit(1);
  }
  const textLength = visibleTextLength(content);
  if (textLength < 500) {
    await writeFailure(dir, 'NG: article-decorated.html の本文文字数が500文字未満です。WordPress投稿を停止しました。', `本文文字数: ${textLength}`);
    process.exit(1);
  }
  let root;
  try {
    ({ root } = requireWpEnv());
  } catch (error) {
    await writeFailure(dir, error.message);
    process.exit(1);
  }
  const beforeLength = content.length;
  const authCheck = await checkWordPressAuth();
  if (!authCheck.authReady) {
    await writeFailure(dir, 'WordPress認証GET疎通確認に失敗したため、投稿を実行していません。', `HTTP status: ${authCheck.statusCode}\ncurl exit code: ${authCheck.exitCode}\nsanitized error message: ${authCheck.stderr}\n投稿実行: false`);
    process.exit(1);
  }
  const posted = await postDraftWithCurl({ root, title, slug, content });
  if (posted.exitCode !== 0 || posted.statusCode < 200 || posted.statusCode >= 300) {
    await writeFailure(dir, 'WordPress API curl POST failed.', `HTTP status: ${posted.statusCode}\ncurl exit code: ${posted.exitCode}\nsanitized error message: ${posted.stderr}\n投稿実行: true`);
    process.exit(1);
  }
  const json = JSON.parse(posted.body || '{}');
  const result = `# WordPress下書き投稿結果\n\n- 投稿ID: ${json.id}\n- status: ${json.status}\n- 編集URL: ${root.replace(/wp-json\/?$/, '')}wp-admin/post.php?post=${json.id}&action=edit\n- 投稿本文文字数: ${beforeLength}\n- transport: curl\n`;
  await writeFile(path.join(dir, 'wp-result.md'), result, 'utf8');
  console.log(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
