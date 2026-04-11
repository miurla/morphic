# Issue #798: File upload/download with docker not working

## 事象

R2/S3互換ストレージへのファイルアップロードは成功するが、ダウンロード時に `400 Bad Request` が発生する。

### 原因

- `R2_PUBLIC_URL` に S3 APIエンドポイント (`https://{accountId}.r2.cloudflarestorage.com`) が設定されている
- S3 APIエンドポイントは認証(AWS Signature V4)が必要だが、AI SDKは認証なしのHTTP GETでファイルを取得しようとするため 400 になる
- `.env.local.example` に `R2_PUBLIC_URL` が何を指すのか説明がなく、ユーザーがS3 APIエンドポイントと混同しやすい

### 該当コード

- `app/api/upload/route.ts:94` — ダウンロードURLを `R2_PUBLIC_URL + filePath` で構築
- `lib/storage/r2-client.ts:4` — `R2_PUBLIC_URL` の定義

## 対応方針

Phase 1: ドキュメント整備（今回対応）
Phase 2: Presigned URL方式への変更（将来検討）

## TODO (Phase 1: ドキュメント整備)

- [ ] `.env.local.example` の `R2_PUBLIC_URL` にコメントを追加
  - S3 APIエンドポイントではなく、パブリックアクセスURLであることを明記
  - R2の場合: `https://pub-xxx.r2.dev` またはカスタムドメイン
  - Cloudflare R2ダッシュボードでバケットのパブリックアクセスを有効にする必要がある旨を記載
- [ ] Issue #798 にコメントで回答

## 将来検討 (Phase 2: Presigned URL)

- object key をDBに保存し、表示時・AI投入時に都度 presigned URL を生成する方式
- `R2_PUBLIC_URL` 環境変数の廃止
- バケットのパブリック公開が不要になるセキュリティ上のメリット
- 詳細は Codex レビュー指摘事項を参照（DBへの署名付きURL保存禁止、既存データ互換など）
