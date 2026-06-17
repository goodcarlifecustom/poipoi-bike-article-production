# バイク買取MAX 新規記事作成ワークフロー

Codex Cloudのタスク詳細に `keyword`・`title`・`slug`・補足条件を入力するだけで、バイク買取MAX向けのSEO記事制作からWordPress下書き投稿までを一連で実行するためのレポジトリです。

対象メディア: https://poi-poi.co.jp/bike/

## このワークフローで行うこと

1. 指定KWの上位3サイト、または `reference_urls` のH2/H3を抽出
2. 抽出見出しをもとに見出し構成を作成
3. 構成をもとに本文記事を作成
4. 信頼できる外部リンクを追加
5. `draft.md` → `article.html` → `article-linked.html` → `article-decorated.html` の順で記事を完成
6. 初期推奨値は `post_to_wp: false`。WordPress下書き投稿まで進めたい場合のみ `post_to_wp: true` を指定
7. 各工程の出力を `articles/{slug}/` に保存

> **重要:** WordPress投稿は必ず `draft` です。公開状態で投稿する設定・運用は禁止です。

## Codex Cloudでの使い方

1. Codex Cloudのタスク詳細に、下記テンプレートを貼り付けます。
2. `keyword`、`title`、`slug`、`notes` を案件に合わせて変更します。
3. 競合参考URLを固定したい場合は `reference_urls` を3件以上入力します。
4. Codexに `prompt.md` と `rules/` の順番に従って記事を作成させます。
5. 初期推奨値は `post_to_wp: false` です。WordPress下書き投稿まで進めたい場合のみ、タスク詳細で `post_to_wp: true` を指定し、`.env` に認証情報を設定して `npm run post -- --slug <slug>` を実行します。
6. 投稿後は `articles/{slug}/wp-result.md` と `articles/{slug}/check-report.md` を確認します。

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

検索結果取得が不安定な場合は、以下のように `reference_urls` を指定してください。

```yaml
keyword: "バイク 買取 千葉"
title: "千葉でバイクを高く売る方法｜おすすめ買取業者と査定前の注意点"
slug: "bike-kaitori-chiba"
category: "バイク買取"
target_media: "https://poi-poi.co.jp/bike/"
post_to_wp: false
reference_urls:
  - "https://example.com/article1"
  - "https://example.com/article2"
  - "https://example.com/article3"
notes: |
  バイク買取MAXへの送客を意識する。
```

WordPress下書き投稿まで実行したい場合のみ、次のように変更してください。

```yaml
post_to_wp: true
```

## .env に入れる項目

`.env.example` をコピーして `.env` を作成してください。`.env` はコミット禁止です。

```env
WP_REST_ROOT=https://poi-poi.co.jp/bike/wp-json/
WP_USERNAME=
WP_APP_PASSWORD=
WP_DEFAULT_STATUS=draft
```

- `WP_REST_ROOT`: WordPress REST APIのルートURL
- `WP_USERNAME`: WordPressユーザー名
- `WP_APP_PASSWORD`: WordPress Application Password
- `WP_DEFAULT_STATUS`: 必ず `draft`

## 主なnpmコマンド

```bash
npm run create -- --slug bike-kaitori-chiba
npm run extract -- --slug bike-kaitori-chiba --keyword "バイク 買取 千葉"
npm run check -- --slug bike-kaitori-chiba
npm run post -- --slug bike-kaitori-chiba
```

## 出力ファイル

記事ごとに `articles/{slug}/` 配下へ保存します。

- `input.yml`: タスク詳細の入力内容
- `serp.md`: 参考URL、除外URL、抽出見出し
- `heading-plan.md`: 見出し構成
- `draft.md`: Markdown本文
- `article.html`: HTML化した本文
- `article-linked.html`: 外部リンク追加後のHTML本文
- `article-decorated.html`: SWELL装飾後、WordPress投稿に使うHTML本文。存在だけでなくHTMLタグを除いた本文500文字以上を必須とする
- `external-links.md`: 外部リンク候補と採用理由
- `check-report.md`: 品質チェック結果、失敗原因
- `wp-result.md`: WordPress下書き投稿結果

## WordPress下書き投稿前の注意点

- `.env` に本番認証情報を設定しているか確認する
- `WP_DEFAULT_STATUS=draft` 以外にしない
- `article-decorated.html` のリンク、CTA、装飾崩れ、HTMLタグを除いた本文500文字以上を確認する
- 医療・法律・税務など高リスク情報が混ざる場合は一次情報で再確認する
- `check-report.md` に重大なNGがないことを確認する
- 本文500文字未満の場合はWordPress下書き投稿を行わない
