# バイク買取MAX 新規記事作成ワークフロー

Codex Cloudのタスク詳細に基本3項目（`main_keyword`・`title`・`target_word_count`）を入力するだけで、バイク買取MAX向けのSEO記事制作から、必要な場合のみWordPress下書き投稿まで進めるためのレポジトリです。既存互換のため `keyword` も使えますが、優先順位は `main_keyword > keyword` です。

対象メディア: https://poi-poi.co.jp/bike/

## このワークフローで行うこと

1. `main_keyword` の検索上位、または `reference_urls` の上位3サイト相当からH2/H3を抽出
2. `serp.md`、`headings.csv`、`heading-analysis.md` を作成
3. 抽出見出しを比較し、HTMLタグのみの `heading-plan.md` を作成
4. `target_word_count` を目標文字数として本文記事を作成
5. 信頼できる外部リンクを追加
6. `draft.md` → `article.html` → `article-linked.html` → `article-decorated.html` の順で記事を完成
7. `post_to_wp: true` の場合のみWordPress下書き投稿へ進む。未指定時は必ず `false` として扱う
8. 各工程の出力を `articles/{slug}/` に保存

> **重要:** WordPress投稿は必ず `draft` です。公開状態で投稿する設定・運用は禁止です。

## Codex Cloudでの使い方

1. Codex Cloudのタスク詳細に、下記の通常テンプレートを貼り付けます。
2. 原則として `main_keyword`、`title`、`target_word_count` の3つだけを案件に合わせて変更します。
3. `slug` は任意です。未指定の場合は `main_keyword` または `keyword` から自動生成します。
4. `category`、`target_media`、`post_to_wp` は未指定ならデフォルト補完します。
5. 競合参考URLを固定したい場合は `reference_urls` を3件以上入力します。
6. Codexに `prompt.md` と `rules/` の順番に従って記事を作成させます。
7. WordPress下書き投稿まで進めたい場合のみ、`post_to_wp: true` を指定します。

## 通常の記事生成（最小入力テンプレート）

```yaml
main_keyword: "バイク 買取 千葉"
title: "千葉でバイクを高く売る方法｜おすすめ買取業者と査定前の注意点"
target_word_count: 5000
```

この3つだけで、以下がデフォルト補完されます。

```yaml
category: "バイク買取"
target_media: "https://poi-poi.co.jp/bike/"
post_to_wp: false
```

## WordPress下書き投稿まで行う場合

```yaml
main_keyword: "バイク 買取 千葉"
title: "千葉でバイクを高く売る方法｜おすすめ買取業者と査定前の注意点"
target_word_count: 5000
post_to_wp: true
```

注意:

- `post_to_wp: true` の場合のみWordPress下書き投稿を実行する
- 未指定または `false` の場合はWordPress投稿しない
- 投稿ステータスは必ず `draft`
- 公開は絶対にしない

## 検索が不安定な場合

```yaml
main_keyword: "バイク 買取 千葉"
title: "千葉でバイクを高く売る方法｜おすすめ買取業者と査定前の注意点"
target_word_count: 5000
reference_urls:
  - "https://example.com/article1"
  - "https://example.com/article2"
  - "https://example.com/article3"
```

## 任意項目を含めたテンプレート

```yaml
main_keyword: "バイク 買取 千葉"
title: "千葉でバイクを高く売る方法｜おすすめ買取業者と査定前の注意点"
target_word_count: 5000
slug: "bike-kaitori-chiba"
category: "バイク買取"
target_media: "https://poi-poi.co.jp/bike/"
post_to_wp: false
notes: |
  バイク買取MAXへの送客を意識する。
  読者は千葉県でバイクを売りたい人。
  出張買取、不動車、原付、事故車、廃車、査定前準備に触れる。
```

## slug自動生成

- `slug` は任意です。
- 未指定の場合は `main_keyword` または `keyword` から、可能な限り意味のある英数字slugを生成します。
- 例: `main_keyword: "バイク 買取 千葉"` → `bike-kaitori-chiba`
- 英数字slugに変換できない場合は `article-YYYYMMDD-HHmmss` 形式の安全なslugを生成します。

## 検索失敗時の安全ルール

検索結果取得や競合サイトのH2/H3抽出に失敗した場合、上位3サイトや見出しを推測で作りません。

- `reference_urls` が指定されている場合は、そのURLから見出し抽出を行います。
- `reference_urls` がない場合は、`serp.md` と `check-report.md` に失敗理由を記録し、参考URLの指定を促します。
- 架空の上位サイト、推測の競合見出し、実際に取得していない参考URLは記録しません。

## .env に入れる項目

`.env.example` をコピーして `.env` を作成してください。`.env` はコミット禁止です。

```env
WP_REST_ROOT=https://poi-poi.co.jp/bike/wp-json/
WP_USERNAME=
WP_APP_PASSWORD=
WP_DEFAULT_STATUS=draft
```

## 主なnpmコマンド

```bash
npm run create -- --main_keyword "バイク 買取 千葉" --title "千葉でバイクを高く売る方法｜おすすめ買取業者と査定前の注意点" --target_word_count 5000
npm run extract -- --slug bike-kaitori-chiba --main_keyword "バイク 買取 千葉"
npm run check -- --slug bike-kaitori-chiba
npm run post -- --slug bike-kaitori-chiba
```

## 出力ファイル

- `input.yml`: タスク詳細の入力内容とデフォルト補完結果
- `serp.md`: 参考URL、除外URL、抽出見出し概要
- `headings.csv`: 参考3サイトのH2/H3抽出結果
- `heading-analysis.md`: 共通テーマ、採用/不採用理由、H3基準、FAQ/まとめ理由
- `heading-plan.md`: HTMLタグのみの最終見出し構成
- `draft.md`: Markdown本文
- `article.html`: HTML化した本文
- `article-linked.html`: 外部リンク追加後のHTML本文
- `article-decorated.html`: SWELL装飾後、WordPress投稿に使うHTML本文
- `external-links.md`: 外部リンク候補と採用理由
- `check-report.md`: 品質チェック結果、失敗原因
- `wp-result.md`: WordPress下書き投稿結果

WordPress本文内にH1は入れません。記事タイトルはWordPress側の投稿タイトルとして扱い、本文HTMLはH2から開始します。
