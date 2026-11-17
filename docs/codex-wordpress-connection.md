# Codex・GitHub・WordPress 接続手順

確認日: 2026-11-17

## 対象

- GitHub: `goodcarlifecustom/poipoi-bike-article-production`
- GitHubログイン用アカウント: `goodcarlifecustom-ctrl`
- WordPress: `https://poi-poi.co.jp/bike/`
- REST API: `https://poi-poi.co.jp/bike/wp-json/`

WordPressの公開ページが返すREST APIリンクを確認した。WordPressへの認証・下書き送信の成否は、下記の手順で別途確認する。

## GitHubへの変更保存・PR

1. 最新のmainを確認し、目的ごとの作業ブランチを使う。
2. READMEと適用されるAGENTS.mdを読んでから編集する。
3. 差分と必要な確認結果を見てからコミットする。
4. 作業ブランチをGitHubへ送信し、main向けのPRを作成する。
5. PRの所有者、リポジトリ、取り込み先、変更ファイルを確認する。

ChatGPTのGitHub連携によるファイル保存・PR作成と、Codex Cloudのコマンドによる `git push` の認証は別々に確認する。前者の成功だけを後者の成功として扱わない。

コマンドの送信確認では、リポジトリ・ブランチ・未保存の変更を確認し、今回の接続確認用ファイルだけを対象にする。失敗時は認証情報を表示せず、完了した段階と未完了の段階を報告する。

## WordPressの接続設定

Codex Cloudの環境設定で、次の3項目をプロセス環境変数として登録する。認証情報をチャット、GitHub、記事、ログへ書かない。`.env` は作成・コミットしない。

| キー | 設定する値 |
| --- | --- |
| `WP_SITE_URL` | `https://poi-poi.co.jp/bike` |
| `WP_USERNAME` | 接続に使うWordPressユーザーのログイン名 |
| `WP_APPLICATION_PASSWORD` | この連携用に発行したWordPressアプリケーションパスワード |

1. 対象WordPressの管理画面を開き、接続に使うユーザーのプロフィールを開く。
2. 「アプリケーションパスワード」で、用途が分かる名前（例: `Codex-bikekaitori`）を付けて発行する。
3. 発行された値はCodexの保護された環境変数入力欄へ直接登録する。
4. 環境の通信許可に `poi-poi.co.jp` があることを確認する。
5. 設定を保存し、更新した環境を再利用可能にしてから、新しいタスクで確認する。

通常のWordPressログイン用パスワードではなく、発行したアプリケーションパスワードを使う。HTTPシークレットのプレースホルダーを使う構成では、このプログラムが認証ヘッダーを組み立てる際に必要な値を読めるか、別途確認する。

## 読み取りだけの接続テスト

新しいタスクで次を実行する。

```bash
npm run wp:doctor
```

現在の実装はREST APIルート、認証ユーザー、記事一覧の取得をGETで確認する。実サイトの下書き作成権限や投稿結果まで確認したとは扱わない。失敗時はHTTPステータスやエラーの種類だけを報告し、認証情報を表示しない。

## 下書き送信の確認

認証が成功したら、1回の実行で新規1記事・下書き1件だけを対象にする。README、AGENTS.md、`rules/06-wordpress-draft.md` の品質・装飾チェックと送信前確認をそのまま通す。

WordPressへ送信する記事は `wordpress_draft: true` とし、送信ペイロードの `status` は必ず `draft` とする。接続設定だけを確認する作業中は、既存記事の品質チェックから自動送信を発火させない。

成功の確認には、下書きID、編集URL、保存後の `draft` 状態、本文照合結果を使う。結果は対象記事の `wp-result.md` に保存する。

既存の投稿・下書きの更新や削除は行わない。認証情報は保存結果へ含めない。

## 公式情報

- WordPress Application Passwords: https://developer.wordpress.org/advanced-administration/security/application-passwords/
- WordPress REST API Authentication: https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/
- Codex Cloud environments: https://learn.chatgpt.com/docs/environments/cloud-environments
