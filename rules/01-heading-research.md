# 01 見出し調査ルール

## 目的

バイク買取MAX（`https://poi-poi.co.jp/bike/`）向けに、指定KWの検索意図を把握し、参考に適したバイク買取・バイク売却ジャンルのSEO記事3件からH2/H3を抽出する。

## reference_urls がある場合

- Google検索は行わず、指定URLからH2/H3を抽出する
- 参考に不適切なURLが含まれる場合は、理由を `articles/{slug}/serp.md` に記録する

## reference_urls がない場合

- 指定KWで検索し、上位サイトから参考候補を探す
- バイク買取、バイク売却、出張査定、不動車買取、事故車買取、原付買取、廃車手続き、名義変更、必要書類、査定前準備に関する比較記事、おすすめ記事、SEO記事を優先する
- 公式サイト、官公庁、自治体、Wikipedia、Yahoo!知恵袋、SNS、YouTube、PDF、ECサイト、在庫DBページは原則として除外する
- 上位3サイトが不適切な場合は、順位を下げてでも参考になるSEO記事を3件探す

## 出力

以下のファイルを必ず保存する。

- `articles/{slug}/serp.md`
- `articles/{slug}/headings.csv`
- `articles/{slug}/heading-plan.md`

`articles/{slug}/serp.md` には以下を保存する。

- KW
- 採用URL3件と採用理由
- 除外URLと除外理由
- 各URLのH2/H3一覧
- 検索意図の要約

`articles/{slug}/headings.csv` には、採用URLごとのH2/H3をCSV形式で保存する。

`articles/{slug}/heading-plan.md` には、見出し調査から導いた記事構成案を保存する。
