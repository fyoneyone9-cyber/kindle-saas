# 📚 Kindle本ファクトリー by NextraLabs

AIがテーマを入力するだけでKindle本（KDP）向けの原稿を自動生成するSaaSアプリです。

## ✨ 機能

- テーマ・ジャンルを入力するだけで5000〜8000字の原稿を自動生成
- Gemini 2.5 Flash APIを使用した高品質な日本語原稿
- DOCX形式でダウンロード可能（KDP直接入稿対応）
- KDP入稿チートシート（JSON）のダウンロード
- 1日3回の生成制限（localStorage管理）
- ローディング中の二重送信防止

## 🛠 技術スタック

- **フロントエンド**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **バックエンド**: Next.js API Routes
- **AI**: Google Gemini 2.5 Flash
- **文書生成**: docx ライブラリ

## 🚀 ローカル起動手順

```bash
# 1. プロジェクトディレクトリへ移動
cd C:\Users\fyone\Desktop\kindle-saas

# 2. 依存関係インストール
npm install

# 3. 開発サーバー起動
npm run dev
```

ブラウザで http://localhost:3000 を開く。

## 📦 Vercelデプロイ手順

### 前提条件
- Vercelアカウント（https://vercel.com）
- GitHubアカウント

### 手順

#### 1. GitHubリポジトリを作成

```bash
cd C:\Users\fyone\Desktop\kindle-saas
git init
git add .
git commit -m "Initial commit: Kindle SaaS"
```

GitHubで新しいリポジトリを作成し、プッシュ:
```bash
git remote add origin https://github.com/YOUR_USERNAME/kindle-saas.git
git branch -M main
git push -u origin main
```

#### 2. Vercelでプロジェクトをインポート

1. https://vercel.com/new にアクセス
2. 「Import Git Repository」からGitHubリポジトリを選択
3. 「Deploy」をクリック

#### 3. 環境変数（任意）

現在はAPIキーがコードに直接記述されています。
本番環境ではVercelの「Settings > Environment Variables」で設定することを推奨:

```
GEMINI_API_KEY=AIzaSyCMbtu9IJIGbml2KOv1Yjit9QP7TkmIgiA
```

その後、`route.ts`の該当箇所を以下に変更:
```typescript
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
```

#### 4. デプロイ完了

Vercelが自動でビルド・デプロイを行います（約2〜3分）。
完了後、`https://your-project.vercel.app` でアクセス可能になります。

## 💰 収益化について

### 自分用として
KDP向けの原稿を素早く生成し、Kindle出版のスピードを上げる。

### NextraLabsメンバー向けとして
1. Vercelにデプロイ後、URLを会員専用コンテンツとして提供
2. 月額メンバーシップに同梱
3. または単体ツールとして980円/月で販売

## 📁 プロジェクト構造

```
kindle-saas/
├── src/
│   └── app/
│       ├── layout.tsx          # ルートレイアウト
│       ├── page.tsx            # メインUI（クライアントコンポーネント）
│       ├── globals.css         # グローバルスタイル
│       └── api/
│           └── generate/
│               └── route.ts    # 原稿生成APIエンドポイント
├── package.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

## ⚠️ 注意事項

- Gemini APIの利用制限・料金にご注意ください
- 生成された原稿は必ず内容を確認・加筆修正してからKDPに入稿してください
- カバー画像は別途作成が必要です（推奨: 2560×1600px）
