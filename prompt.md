# バイク買取MAX 新規記事作成プロンプト

Codex Cloudのタスク詳細に入力されたYAMLをもとに、以下の順番で作業してください。

## 入力項目

必須:

- `keyword`
- `title`
- `slug`

任意:

- `category`
- `target_media`
- `notes`
- `reference_urls`
- `post_to_wp`

## 実行手順

1. `npm run create -- --slug {slug}` を実行し、`articles/{slug}/` を作成する
2. 入力YAMLを `articles/{slug}/input.yml` に保存する
3. `rules/01-heading-research.md` に従い、見出し調査を行って `serp.md` を作成する
4. `rules/02-article-generation.md` に従い、`heading-plan.md` と `draft.md` を作成する
5. `draft.md` をHTML化して `article.html` を作成する
6. `rules/03-external-links.md` に従い、外部リンクを追加した `article-linked.html` と `external-links.md` を作成する
7. `rules/04-swell-decoration.md` に従い、SWELL装飾済みの `article-decorated.html` を作成する
8. `rules/99-quality-check.md` に従い、`npm run check -- --slug {slug}` を実行する
9. `post_to_wp: true` の場合のみ、`rules/05-wordpress-draft.md` に従い `npm run post -- --slug {slug}` を実行する

## 絶対条件

- 投稿ステータスは常に `draft`
- 公開ステータスを使用しない
- `.env` を作成・編集してもコミットしない
- `post_to_wp` の初期推奨値は `false`
- WordPress下書き投稿まで進めたい場合のみ `post_to_wp: true` を指定する
- `post_to_wp: false` または未指定の場合はWordPress投稿を行わない
- どちらの場合も `article-decorated.html` までは作成する
- `article-decorated.html` は存在だけでなく、HTMLタグを除いた本文500文字以上を必須とする
- 本文500文字未満の場合はWordPress下書き投稿へ進まない
- 失敗時は原因と次アクションを `articles/{slug}/check-report.md` に記録する

## タスク詳細テンプレート

```yaml
keyword: "バイク 買取 千葉"
title: "千葉でバイクを高く売る方法｜おすすめ買取業者と査定前の注意点"
slug: "bike-kaitori-chiba"
category: "バイク買取"
target_media: "https://poi-poi.co.jp/bike/"
post_to_wp: false
notes: |
  バイク買取MAXへの送客を意識する。
  読者は千葉県でバイクを売りたい人。
  出張買取、不動車、原付、事故車、廃車にも触れる。
```

WordPress下書き投稿まで実行したい場合のみ、タスク詳細で次のように指定してください。

```yaml
post_to_wp: true
```
