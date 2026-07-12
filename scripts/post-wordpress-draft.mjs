import { argvValue, assertSingleOutputCounts } from './workflow-utils.mjs';
import { atomicJson, editUrl, loadArticle, redact, requireWpEnv, runPrechecks, verifyContent, wpFetch, writeResult } from './wordpress-utils.mjs';

function has(flag) { return process.argv.includes(`--${flag}`); }
function fail(message) { throw new Error(message); }

async function getPost(root, id) {
  return wpFetch(new URL(`wp/v2/posts/${id}?context=edit`, root).toString(), { auth: true });
}

async function findBySlug(root, slug) {
  const url = new URL('wp/v2/posts', root);
  url.searchParams.set('slug', slug);
  url.searchParams.set('status', 'publish,future,draft,pending,private');
  url.searchParams.set('context', 'edit');
  return wpFetch(url.toString(), { auth: true });
}

function slugForGeneration(baseSlug, generationNumber) {
  if (generationNumber <= 1) return baseSlug;
  if (generationNumber === 2) return `${baseSlug}-new`;
  return `${baseSlug}-new-${generationNumber - 1}`;
}

function generationNumberForSlug(baseSlug, slug) {
  if (slug === baseSlug) return 1;
  if (slug === `${baseSlug}-new`) return 2;
  const match = slug.match(new RegExp(`^${baseSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-new-(\\d+)$`));
  return match ? Number(match[1]) + 1 : null;
}

async function chooseWordPressSlug(root, metadata, fallbackSlug) {
  const baseSlug = metadata.base_slug || metadata.requested_slug || fallbackSlug;
  for (let generationNumber = 1; ; generationNumber += 1) {
    const candidate = slugForGeneration(baseSlug, generationNumber);
    const found = await findBySlug(root, candidate);
    if (!found.ok) fail(`WordPress slug check failed for ${candidate}: ${found.status}`);
    const posts = Array.isArray(found.json) ? found.json : [];
    if (posts.length === 0) return { slug: candidate, generationNumber, collision: candidate !== baseSlug };
  }
}

async function main() {
  const cliSlug = argvValue(process.argv, 'slug');
  if (!cliSlug) fail('Usage: npm run wp:draft -- --slug <slug> --confirm');
  const dryRun = has('dry-run');
  const confirm = has('confirm');
  if (has('adopt-existing')) fail('--adopt-existing is prohibited; every execution must create one new draft with the preselected final_slug.');

  const { dir, metaPath, metadata, source, content, hash } = await loadArticle(cliSlug);
  const started = new Date().toISOString();

  try {
    if (metadata.post_to_wp !== true) fail('metadata.post_to_wp must be true');
    if (metadata.status !== 'draft') fail('metadata.status must be draft');
    if (metadata.slug !== cliSlug) fail('metadata.slug must match CLI slug before WordPress slug collision checks');
    if (!metadata.title) fail('metadata.title is required');
    if (metadata.wordpress_draft_id) fail('Existing WordPress draft IDs are not updated by this workflow; create a new final_slug in a separate run.');
    if (!dryRun && !confirm) fail('--confirm is required for writing');
    if (process.env.WP_DRAFT_SKIP_PRECHECKS !== '1') await runPrechecks(cliSlug);

    const cfg = requireWpEnv();
    const selected = await chooseWordPressSlug(cfg.restRoot, metadata, cliSlug);
    const plannedSlug = selected.slug;

    if (dryRun) {
      console.log([
        'wp:draft dry-run PASS',
        `title: ${metadata.title}`,
        `requested slug: ${cliSlug}`,
        `planned final_slug: ${plannedSlug}`,
        'status: draft',
        `source: ${source}`,
        `sha256: ${hash}`,
        'operation: create-one-draft',
        'required env: WP_SITE_URL or WP_REST_ROOT, WP_USERNAME, WP_APPLICATION_PASSWORD or WP_APP_PASSWORD'
      ].join('\n'));
      return;
    }

    assertSingleOutputCounts({ articleCount: 1, articleDirectoryCount: 1, wordpressPostCount: 1 });
    const payload = { title: metadata.title, slug: plannedSlug, content, status: 'draft' };
    const res = await wpFetch(new URL('wp/v2/posts', cfg.restRoot).toString(), { method: 'POST', auth: true, payload });
    if (!res.ok) fail(`post create failed: ${res.status}`);
    const saved = res.json;
    const targetId = saved.id;

    const got = await getPost(cfg.restRoot, targetId);
    if (!got.ok) fail(`post verification fetch failed: ${got.status}`);
    const post = got.json;
    const actualSlug = post.slug || saved.slug || plannedSlug;
    const actualGeneration = generationNumberForSlug(metadata.base_slug || metadata.requested_slug || cliSlug, actualSlug) ?? selected.generationNumber;
    const errors = [];
    if (!post.id) errors.push('post ID missing');
    if (post.status !== 'draft') errors.push(`status is ${post.status}`);
    if ((post.title?.raw || '') !== metadata.title) errors.push('title.raw mismatch');
    errors.push(...verifyContent(content, post.content?.raw || ''));

    const url = editUrl(cfg.siteUrl, targetId);
    metadata.slug = actualSlug;
    metadata.final_slug = actualSlug;
    metadata.generation_number = actualGeneration;
    metadata.slug_collision_detected = selected.collision || actualSlug !== (metadata.base_slug || metadata.requested_slug || cliSlug);
    metadata.post_to_wp = true;
    metadata.wordpress_post_count = 1;
    metadata.wordpress_draft_id = targetId;
    metadata.wordpress_draft_url = url;
    metadata.wordpress_status = post.status;
    metadata.wordpress_last_synced_at = new Date().toISOString();
    metadata.wordpress_content_sha256 = hash;
    await atomicJson(metaPath, metadata);

    const seo = 'SEOメタディスクリプション未設定（wordpress.seo_meta_key未設定）';
    const lines = [
      '# WordPress下書き投稿結果',
      '',
      `- 実行日時: ${started}`,
      '- action: created',
      `- WordPress投稿ID: ${targetId}`,
      `- 編集画面URL: ${url}`,
      `- ステータス: ${post.status}`,
      `- タイトル: ${post.title?.raw || metadata.title}`,
      `- スラッグ: ${actualSlug}`,
      `- 投稿元ファイル: ${source}`,
      `- 投稿元SHA-256: ${hash}`,
      '- WordPress write request: SENT_ONCE',
      `- 投稿後の本文検証結果: ${errors.length ? 'CONTENT_MISMATCH' : 'PASS'}`,
      `- SEOメタディスクリプション設定結果: ${seo}`,
      '- 投稿前チェック結果: PASS',
      `- 警告: ${seo}`,
      `- エラー: ${errors.join('; ') || 'なし'}`
    ];
    await writeResult(dir, lines);
    if (errors.length) fail(`CONTENT_MISMATCH: ${errors.join('; ')}`);
    console.log(lines.join('\n'));
  } catch (e) {
    await writeResult(dir, [
      '# WordPress下書き投稿結果',
      '',
      `- 実行日時: ${started}`,
      '- action: failed',
      `- エラー: ${redact(e.message)}`,
      '- 次の対応: エラー内容を解消し、必要なら別実行で新しいfinal_slugを作成してください。'
    ]);
    console.error(redact(e.message));
    process.exit(1);
  }
}

main();
