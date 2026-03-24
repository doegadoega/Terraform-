# Terraform 学習サイト

Terraform の基礎から本番運用までを体系的に学べるインタラクティブな Web 学習サイトです。
AWS を中心に、VPC 構築・ECS コンテナ・Lambda・Cognito 認証・Zscaler ZPA まで幅広くカバーしています。

## 特徴

- 全ページにダウンロード可能な **Terraform サンプルコード**を掲載
- **20 問の演習問題**（カテゴリ・難易度フィルター付き）
- コピペですぐ使える実践的なコード例
- 図解・フローチャートによる視覚的な解説

## セットアップ

```bash
# 依存パッケージをインストール
npm install

# 開発サーバーを起動（http://localhost:5173）
npm run dev

# 本番ビルド
npm run build
```

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| フレームワーク | React 19 + TypeScript |
| ビルドツール | Vite |
| ルーティング | React Router v7 |
| スタイリング | Tailwind CSS v4 |
| UI コンポーネント | Radix UI + shadcn/ui |
| アイコン | Lucide React |

## コンテンツ一覧

### 基礎編

| ページ | パス | 内容 |
|---|---|---|
| ダッシュボード | `/` | 学習の全体像・進捗管理 |
| 基本概念 | `/concepts` | Provider / Resource / Data Source / Module / Variable / Output 等 |
| ワークフロー | `/workflow` | init → plan → apply → destroy の流れ |
| コマンド | `/commands` | terraform コマンドリファレンス |
| プロバイダー | `/providers` | AWS / GCP / Azure 等のプロバイダー設定 |

### インフラ構築編

| ページ | パス | 内容 |
|---|---|---|
| コンテナ構築 | `/containers` | ECS / EKS / GKE / Cloud Run の構築手順 |
| ECS アーキテクチャ | `/ecs-architecture` | Cluster → Service → Task → Container の階層構造、マルチコンテナ、コンテナ間通信 |
| VPC 構築ガイド | `/vpc-step-guide` | VPC をゼロから構築するステップバイステップガイド |
| VPC & コンテナ実践 | `/vpc-container` | VPC + ECS/Lambda の統合構成、既存 VPC インポート、リージョン変更、アカウント切替 |

### AWS サービス連携編

| ページ | パス | 内容 |
|---|---|---|
| AWS 連携 | `/aws-integration` | ECR / S3 / DynamoDB のベストプラクティス |
| Cognito 認証 | `/cognito-auth` | User Pool / Identity Pool / ALB 連携 / MFA 設定 |
| サーバーレス | `/serverless` | Lambda + API Gateway + DynamoDB 構成 |

### セキュリティ & ネットワーク編

| ページ | パス | 内容 |
|---|---|---|
| Zscaler ZPA | `/zscaler` | App Connector の EC2 デプロイ、HA 構成、ポリシー設定、運用監視 |
| マルチリージョン | `/multi-region` | DR 構成、リージョン間レプリケーション |

### 運用 & デプロイ編

| ページ | パス | 内容 |
|---|---|---|
| デプロイ実践 | `/deploy-practice` | CI/CD パイプライン、Blue/Green デプロイ |
| Git / GitHub | `/git-workflow` | tfstate の管理、PR ワークフロー、GitHub Actions |
| ベストプラクティス | `/best-practices` | 命名規則、モジュール設計、セキュリティ |

### 演習

| ページ | パス | 内容 |
|---|---|---|
| 演習問題 | `/exercises` | 全 20 問（基礎 / VPC / コンテナ / Lambda / 運用 / セキュリティ、初級〜上級） |

## ディレクトリ構成

```
src/
  app/
    components/
      Dashboard.tsx          # ダッシュボード
      Concepts.tsx           # 基本概念
      Workflow.tsx           # ワークフロー
      Commands.tsx           # コマンドリファレンス
      Providers.tsx          # プロバイダー設定
      Containers.tsx         # コンテナ構築（ECS/EKS/GKE/Cloud Run）
      EcsArchitecture.tsx    # ECS アーキテクチャ解説
      VpcStepGuide.tsx       # VPC 構築ステップガイド
      VpcContainerPractice.tsx # VPC & コンテナ実践
      AwsIntegration.tsx     # AWS 連携（ECR/S3/DynamoDB）
      CognitoAuth.tsx        # Cognito 認証
      ZscalerConnector.tsx   # Zscaler ZPA App Connector
      Serverless.tsx         # サーバーレス構成
      MultiRegion.tsx        # マルチリージョン
      DeployPractice.tsx     # デプロイ実践
      GitWorkflow.tsx        # Git / GitHub 連携
      BestPractices.tsx      # ベストプラクティス
      Exercises.tsx          # 演習問題（20問）
      DownloadCodeButton.tsx # サンプルダウンロード共通コンポーネント
      Sidebar.tsx            # サイドバーナビゲーション
      Layout.tsx             # 共通レイアウト
      ui/                    # shadcn/ui コンポーネント群
    routes.ts                # ルーティング定義
  main.tsx                   # エントリポイント
  styles/                    # グローバルスタイル
```

## サンプルコードのダウンロード

各ページのコードブロック下部にある「サンプルをダウンロード」ボタンから、
Terraform の `.tf` ファイルをダウンロードできます。

対応ページ：
基本概念 / ワークフロー / プロバイダー / コンテナ構築 / ECS アーキテクチャ /
VPC 構築ガイド / VPC & コンテナ実践 / AWS 連携 / Cognito 認証 /
Zscaler ZPA / サーバーレス / マルチリージョン / デプロイ実践 /
Git・GitHub / ベストプラクティス

## 演習問題について

20 問の演習問題を収録しています。

- **カテゴリフィルター**: 基礎 / VPC / コンテナ / Lambda / 運用 / セキュリティ
- **難易度フィルター**: 初級 / 中級 / 上級
- クリックで回答と解説を展開表示

## ライセンス

このプロジェクトは社内学習用に作成されたものです。
