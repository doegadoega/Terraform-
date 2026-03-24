import { useState } from "react";
import {
  Rocket,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  Cloud,
  FolderTree,
  FileCode,
  Server,
  Globe,
  RefreshCw,
  Trash2,
  Eye,
  Settings,
} from "lucide-react";
import { DownloadCodeButton } from "./DownloadCodeButton";

type Scenario = "s3-cloudfront" | "ecs-fargate" | "ec2-nginx";

interface ScenarioInfo {
  id: Scenario;
  name: string;
  description: string;
  difficulty: string;
  cost: string;
  icon: React.ElementType;
  color: string;
}

const scenarios: ScenarioInfo[] = [
  {
    id: "s3-cloudfront",
    name: "S3 + CloudFront（静的サイト）",
    description: "Reactアプリをビルドし、S3に配置してCloudFrontで配信。最もシンプルで低コスト。",
    difficulty: "初級",
    cost: "ほぼ無料",
    icon: Globe,
    color: "bg-green-600",
  },
  {
    id: "ecs-fargate",
    name: "ECS Fargate（コンテナ）",
    description: "DockerイメージにしてECS Fargateで実行。APIサーバーありのフルスタックアプリ向け。",
    difficulty: "中級",
    cost: "月$10〜",
    icon: Server,
    color: "bg-orange-500",
  },
  {
    id: "ec2-nginx",
    name: "EC2 + Nginx",
    description: "EC2インスタンスにNginxを設定してホスティング。最も柔軟だがサーバー管理が必要。",
    difficulty: "中級",
    cost: "月$5〜",
    icon: Cloud,
    color: "bg-blue-500",
  },
];

interface Step {
  title: string;
  description: string;
  code: string;
  tips?: string[];
  warnings?: string[];
  fileHint?: string;
}

const s3CloudfrontSteps: Step[] = [
  {
    title: "Step 1: プロジェクト構成を作る",
    description:
      "まずはTerraformプロジェクトのディレクトリを作成します。リージョンごとにディレクトリを分けることで、東京でも大阪でもバージニアでも同じ構成をデプロイできます。",
    fileHint: "ターミナルで実行",
    code: `# プロジェクトの作成
mkdir -p my-app-infra/{modules/static-site,environments/{tokyo,osaka,virginia}}

# ディレクトリ構成
my-app-infra/
├── modules/
│   └── static-site/          # 再利用可能なモジュール
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
├── environments/
│   ├── tokyo/                # ap-northeast-1
│   │   ├── main.tf
│   │   ├── terraform.tfvars
│   │   └── backend.tf
│   ├── osaka/                # ap-northeast-3
│   │   ├── main.tf
│   │   ├── terraform.tfvars
│   │   └── backend.tf
│   └── virginia/             # us-east-1（テスト用）
│       ├── main.tf
│       ├── terraform.tfvars
│       └── backend.tf
└── README.md

# 先にReactアプリをビルドしておく
cd my-react-app
npm run build
# → dist/ または build/ フォルダが生成される`,
    tips: [
      "modules/ に共通ロジック、environments/ にリージョン固有の設定を置く",
      "同じモジュールを全リージョンで使うので構成が統一される",
    ],
  },
  {
    title: "Step 2: 静的サイト用モジュールを作る",
    description:
      "S3バケット + CloudFrontの組み合わせでReactアプリをホスティングするモジュールを作ります。これを各リージョンから呼び出します。",
    fileHint: "modules/static-site/main.tf",
    code: `# modules/static-site/main.tf

# S3バケット（ビルド済みファイルの保存先）
resource "aws_s3_bucket" "site" {
  bucket = var.bucket_name

  tags = {
    Name        = var.bucket_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# バケットのWebサイトホスティング設定
resource "aws_s3_bucket_website_configuration" "site" {
  bucket = aws_s3_bucket.site.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"  # SPAなので全部index.htmlに
  }
}

# バケットポリシー（CloudFrontからのみアクセス許可）
resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontAccess"
      Effect    = "Allow"
      Principal = {
        Service = "cloudfront.amazonaws.com"
      }
      Action   = "s3:GetObject"
      Resource = "\${aws_s3_bucket.site.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.site.arn
        }
      }
    }]
  })
}

# CloudFront OAC（Origin Access Control）
resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "\${var.bucket_name}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFrontディストリビューション
resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  default_root_object = "index.html"
  comment             = "\${var.environment} - Static Site"

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "S3-\${var.bucket_name}"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-\${var.bucket_name}"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  # SPA用：404の場合もindex.htmlを返す
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}`,
    tips: [
      "CloudFront OACを使うことでS3を直接公開せずにセキュアに配信",
      "custom_error_response でSPAのルーティングに対応（React Routerが動く）",
      "本番ではACM証明書を設定してカスタムドメインを使う",
    ],
  },
  {
    title: "Step 3: モジュールの変数と出力を定義",
    description: "モジュールに渡すパラメータと、デプロイ後に確認したい情報（URL等）を定義します。",
    fileHint: "modules/static-site/variables.tf & outputs.tf",
    code: `# modules/static-site/variables.tf
variable "bucket_name" {
  description = "S3バケット名（グローバルでユニーク）"
  type        = string
}

variable "environment" {
  description = "環境名（dev, staging, prod）"
  type        = string
}

# modules/static-site/outputs.tf
output "bucket_name" {
  description = "S3バケット名"
  value       = aws_s3_bucket.site.bucket
}

output "bucket_arn" {
  description = "S3バケットARN"
  value       = aws_s3_bucket.site.arn
}

output "cloudfront_domain" {
  description = "CloudFrontのドメイン名（このURLでアクセス）"
  value       = aws_cloudfront_distribution.site.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFrontディストリビューションID（キャッシュ削除時に使用）"
  value       = aws_cloudfront_distribution.site.id
}

output "site_url" {
  description = "サイトのURL"
  value       = "https://\${aws_cloudfront_distribution.site.domain_name}"
}`,
  },
  {
    title: "Step 4: 大阪リージョンにデプロイ！",
    description:
      "ここが本番！大阪リージョン用の設定ファイルを作成し、terraform apply でインフラを構築します。東京やバージニアも同じ手順でOK。",
    fileHint: "environments/osaka/",
    code: `# ========================================
# environments/osaka/main.tf
# ========================================
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-northeast-3"  # 大阪リージョン！

  default_tags {
    tags = {
      Project     = "my-learning-app"
      Environment = "prod-osaka"
      ManagedBy   = "Terraform"
      Region      = "ap-northeast-3"
    }
  }
}

module "site" {
  source      = "../../modules/static-site"
  bucket_name = "my-learning-app-osaka-prod"  # ユニークな名前
  environment = "prod-osaka"
}

output "site_url" {
  value = module.site.site_url
}

output "bucket_name" {
  value = module.site.bucket_name
}

output "cloudfront_distribution_id" {
  value = module.site.cloudfront_distribution_id
}

# ========================================
# environments/osaka/backend.tf
# ========================================
terraform {
  backend "s3" {
    bucket = "my-terraform-state-bucket"
    key    = "my-learning-app/osaka/terraform.tfstate"
    region = "ap-northeast-1"  # Stateは東京に一元管理
  }
}

# ========================================
# 実行手順
# ========================================

# 1. 大阪ディレクトリに移動
# $ cd environments/osaka

# 2. 初期化
# $ terraform init

# 3. 確認（ここで何が作られるか必ずチェック！）
# $ terraform plan
#
# Plan: 5 to add, 0 to change, 0 to destroy.
#   + aws_s3_bucket.site
#   + aws_s3_bucket_website_configuration.site
#   + aws_s3_bucket_policy.site
#   + aws_cloudfront_origin_access_control.site
#   + aws_cloudfront_distribution.site

# 4. デプロイ実行！
# $ terraform apply
# → "yes" を入力

# 5. 完了！URLが表示される
# site_url = "https://d1234567890.cloudfront.net"`,
    tips: [
      "S3バケット名はグローバルでユニークにする必要がある（リージョン名を含めると安全）",
      "CloudFrontはグローバルサービスだが、オリジン（S3）は大阪リージョンに作成される",
      "backend の region は State の保存先であり、デプロイ先とは別",
    ],
    warnings: [
      "CloudFrontの作成には10-15分かかることがある（気長に待とう）",
    ],
  },
  {
    title: "Step 5: ビルドファイルをS3にアップロード",
    description:
      "Terraformでインフラが作れたら、ビルドしたReactアプリのファイルをS3にアップロードします。Terraformからも可能ですが、AWS CLIが簡単です。",
    fileHint: "ターミナルで実行",
    code: `# ========================================
# 方法1: AWS CLI でアップロード（おすすめ）
# ========================================

# Reactアプリをビルド
$ cd my-react-app
$ npm run build

# S3にアップロード
$ aws s3 sync dist/ s3://my-learning-app-osaka-prod \\
    --delete \\
    --region ap-northeast-3

# upload: dist/index.html to s3://my-learning-app-osaka-prod/index.html
# upload: dist/assets/index-abc123.js to s3://...
# upload: dist/assets/index-def456.css to s3://...

# CloudFrontのキャッシュをクリア（最新版を即座に反映）
$ DIST_ID=$(cd ../my-app-infra/environments/osaka && terraform output -raw cloudfront_distribution_id)
$ aws cloudfront create-invalidation \\
    --distribution-id $DIST_ID \\
    --paths "/*"

# ========================================
# 方法2: Terraform でアップロード（IaCで管理したい場合）
# ========================================

# ファイルタイプごとのContent-Type設定が必要
locals {
  mime_types = {
    ".html" = "text/html"
    ".css"  = "text/css"
    ".js"   = "application/javascript"
    ".json" = "application/json"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
  }
}

resource "aws_s3_object" "site_files" {
  for_each = fileset("../../my-react-app/dist", "**")

  bucket       = module.site.bucket_name
  key          = each.value
  source       = "../../my-react-app/dist/\${each.value}"
  etag         = filemd5("../../my-react-app/dist/\${each.value}")
  content_type = lookup(
    local.mime_types,
    regex("\\\\.[^.]+$", each.value),
    "application/octet-stream"
  )
}

# ========================================
# アクセス確認！
# ========================================

# CloudFront URL でアクセス
$ SITE_URL=$(cd ../my-app-infra/environments/osaka && terraform output -raw site_url)
$ echo "サイトURL: $SITE_URL"
# → https://d1234567890.cloudfront.net

$ curl -s -o /dev/null -w "%{http_code}" $SITE_URL
# → 200

# ブラウザで開く
$ open $SITE_URL  # macOS
# or
$ xdg-open $SITE_URL  # Linux`,
    tips: [
      "aws s3 sync --delete で不要なファイルも自動削除される",
      "CloudFrontのキャッシュクリアは更新後に必ず実行",
      "CI/CDで npm run build → s3 sync → cloudfront invalidation を自動化するのがベスト",
    ],
  },
  {
    title: "Step 6: 東京リージョンにも同じものをデプロイ",
    description:
      "大阪で動いたら、全く同じ手順で東京にもデプロイ。モジュールを使っているから、やることはほぼコピペ！",
    fileHint: "environments/tokyo/main.tf",
    code: `# environments/tokyo/main.tf
# 大阪版とほぼ同じ！リージョンとバケット名だけ変える

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-northeast-1"  # 東京リージョン

  default_tags {
    tags = {
      Project     = "my-learning-app"
      Environment = "prod-tokyo"
      ManagedBy   = "Terraform"
      Region      = "ap-northeast-1"
    }
  }
}

module "site" {
  source      = "../../modules/static-site"
  bucket_name = "my-learning-app-tokyo-prod"  # 東京用の名前
  environment = "prod-tokyo"
}

output "site_url" {
  value = module.site.site_url
}

# ========================================
# デプロイ手順（大阪と全く同じ！）
# ========================================

# $ cd environments/tokyo
# $ terraform init
# $ terraform plan
# $ terraform apply

# S3にアップロード
# $ aws s3 sync ../../my-react-app/dist/ s3://my-learning-app-tokyo-prod \\
#     --delete --region ap-northeast-1

# キャッシュクリア
# $ DIST_ID=$(terraform output -raw cloudfront_distribution_id)
# $ aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"

# ========================================
# これで東京と大阪の両方で同じアプリが動いている！
# ========================================
# 東京: https://d111111111.cloudfront.net
# 大阪: https://d222222222.cloudfront.net`,
    tips: [
      "モジュール化しているので、リージョン追加は main.tf + backend.tf を書くだけ",
      "バージニア (us-east-1) にテスト環境を作りたい場合も同じ手順",
      "将来的にRoute53でドメインを統一し、レイテンシベースルーティングも可能",
    ],
  },
  {
    title: "Step 7: デプロイをスクリプト化して自動化",
    description:
      "毎回手動でやるのは面倒なので、デプロイスクリプトを作っておきましょう。CI/CDに組み込む前段階として便利です。",
    fileHint: "deploy.sh",
    code: `#!/bin/bash
# deploy.sh - 指定リージョンにデプロイするスクリプト
set -e

# 使い方: ./deploy.sh osaka
# 使い方: ./deploy.sh tokyo
# 使い方: ./deploy.sh virginia

REGION=\${1:?"リージョンを指定してください (tokyo/osaka/virginia)"}

echo "========================================"
echo " デプロイ先: $REGION"
echo "========================================"

# 1. Reactアプリのビルド
echo "📦 ビルド中..."
cd my-react-app
npm run build
cd ..

# 2. Terraformでインフラ構築/更新
echo "🏗️  インフラを構築中..."
cd my-app-infra/environments/$REGION
terraform init -input=false
terraform apply -auto-approve

# 3. 出力値を取得
BUCKET=$(terraform output -raw bucket_name)
DIST_ID=$(terraform output -raw cloudfront_distribution_id)
SITE_URL=$(terraform output -raw site_url)

# 4. S3にアップロード
echo "📤 ファイルをアップロード中..."
aws s3 sync ../../../my-react-app/dist/ s3://$BUCKET --delete

# 5. CloudFrontキャッシュクリア
echo "🔄 キャ���シュをクリア中..."
aws cloudfront create-invalidation \\
  --distribution-id $DIST_ID \\
  --paths "/*" \\
  --output text > /dev/null

echo "========================================"
echo "✅ デプロイ完了！"
echo "🌐 URL: $SITE_URL"
echo "========================================"

# ========================================
# 全リージョンに一括デプロイ
# ========================================
# for region in tokyo osaka; do
#   ./deploy.sh $region
# done`,
    tips: [
      "set -e でエラー時にスクリプトを停止",
      "CI/CD（GitHub Actions等）に組み込めばgit pushで自動デプロイ",
      "-auto-approve はCIでは便利だが、本番への初回適用時は慎重に",
    ],
  },
  {
    title: "Step 8: 動作確認 & リージョン比較",
    description:
      "両リージョンにデプロイできたら、実際にアクセスしてレスポンスタイムや動作を確認しましょう。",
    fileHint: "ターミナルで実行",
    code: `# ========================================
# 各リージョンのURLを取得
# ========================================
TOKYO_URL=$(cd environments/tokyo && terraform output -raw site_url)
OSAKA_URL=$(cd environments/osaka && terraform output -raw site_url)

echo "東京: $TOKYO_URL"
echo "大阪: $OSAKA_URL"

# ========================================
# レスポンスタイムの比較
# ========================================
echo "--- 東京リージョン ---"
curl -w "  DNS: %{time_namelookup}s | Connect: %{time_connect}s | Total: %{time_total}s\\n" \\
  -o /dev/null -s $TOKYO_URL

echo "--- 大阪リージョン ---"
curl -w "  DNS: %{time_namelookup}s | Connect: %{time_connect}s | Total: %{time_total}s\\n" \\
  -o /dev/null -s $OSAKA_URL

# ========================================
# ヘルスチェック
# ========================================
for url in $TOKYO_URL $OSAKA_URL; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" $url)
  if [ "$STATUS" = "200" ]; then
    echo "✅ $url → HTTP $STATUS"
  else
    echo "❌ $url → HTTP $STATUS"
  fi
done

# ========================================
# ページの内容が一致するか確認
# ========================================
TOKYO_HASH=$(curl -s $TOKYO_URL | md5sum | cut -d' ' -f1)
OSAKA_HASH=$(curl -s $OSAKA_URL | md5sum | cut -d' ' -f1)

if [ "$TOKYO_HASH" = "$OSAKA_HASH" ]; then
  echo "✅ 東京と大阪のコンテンツが一致しています"
else
  echo "⚠️  コンテンツが異なります（デプロイタイミングのズレ？）"
fi

# ========================================
# terraform state でリソース一覧を確認
# ========================================
echo "--- 東京のリソース ---"
cd environments/tokyo && terraform state list

echo "--- 大阪のリソース ---"
cd ../osaka && terraform state list`,
    tips: [
      "CloudFrontを使っているため、エッジロケーションからの配信でレイテンシは小さい",
      "コンテンツのハッシュ比較で、両リージョンに同じ版がデプロイされているか確認",
      "定期的にヘルスチェックスクリプトを実行するとよい",
    ],
  },
  {
    title: "Step 9: テスト環境の片付け（コスト管理）",
    description:
      "動作確認が終わったら、不要な環境は必ず削除しましょう。CloudFrontは無料枠が大きいですが、習慣として重要です。",
    fileHint: "ターミナルで実行",
    code: `# ========================================
# テスト用のバージニア環境を削除する例
# ========================================

# 1. まずS3バケットを空にする（中身があるとdestroy失敗）
$ cd environments/virginia
$ BUCKET=$(terraform output -raw bucket_name)
$ aws s3 rm s3://$BUCKET --recursive

# 2. 削除対象の確認
$ terraform plan -destroy

# Plan: 0 to add, 0 to change, 5 to destroy.
#   - aws_cloudfront_distribution.site
#   - aws_cloudfront_origin_access_control.site
#   - aws_s3_bucket.site
#   - aws_s3_bucket_policy.site
#   - aws_s3_bucket_website_configuration.site

# 3. 削除実行
$ terraform destroy
# → "yes" を入力

# Destroy complete! Resources: 5 destroyed.

# ========================================
# 環境ごとのコスト目安（S3 + CloudFront）
# ========================================
# S3:         ほぼ無料（数GBまで無料枠）
# CloudFront: 1TB/月まで無料（12ヶ月間）
#             それ以降 $0.114/GB（日本向け）
#
# → テスト環境は放置しても大きなコストにはならないが、
#   習慣として不要なリソースは片付けよう

# ========================================
# 全環境の状態確認
# ========================================
echo "=== 東京 ==="
cd environments/tokyo && terraform state list 2>/dev/null || echo "未構築"

echo "=== 大阪 ==="
cd ../osaka && terraform state list 2>/dev/null || echo "未構築"

echo "=== バージニア ==="
cd ../virginia && terraform state list 2>/dev/null || echo "削除済み"`,
    tips: [
      "S3バケットは中身が空でないと terraform destroy で削除できない",
      "force_destroy = true をバケットに設定しておくと中身ごと削除可能（テスト環境向け）",
      "本番環境には force_destroy = true を設定しないこと！",
    ],
    warnings: [
      "CloudFrontのディストリビューション削除には数分かかる場合がある",
    ],
  },
];

const ecsFargateSteps: Step[] = [
  {
    title: "Step 1: Dockerfileを作成",
    description: "ReactアプリをNginxコンテナにパッケージングします。マルチステージビルドで軽量なイメージを作成。",
    fileHint: "Dockerfile",
    code: `# Dockerfile（マルチステージビルド）

# ---- ビルドステージ ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- 実行ステージ ----
FROM nginx:alpine
# Nginx設定（SPAのルーティング対応）
COPY nginx.conf /etc/nginx/conf.d/default.conf
# ビルド成果物をコピー
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# ---- nginx.conf ----
# server {
#     listen 80;
#     location / {
#         root /usr/share/nginx/html;
#         index index.html;
#         try_files $uri $uri/ /index.html;  # SPA対応
#     }
# }

# ---- ビルド & プッシュ ----
# $ docker build -t my-learning-app .
# $ aws ecr get-login-password --region ap-northeast-3 | \\
#     docker login --username AWS --password-stdin \\
#     123456789012.dkr.ecr.ap-northeast-3.amazonaws.com
# $ docker tag my-learning-app:latest \\
#     123456789012.dkr.ecr.ap-northeast-3.amazonaws.com/my-learning-app:latest
# $ docker push \\
#     123456789012.dkr.ecr.ap-northeast-3.amazonaws.com/my-learning-app:latest`,
    tips: [
      "マルチステージビルドで最終イメージを30MB以下に軽量化",
      "try_files で React Router の履歴モードに対応",
    ],
  },
  {
    title: "Step 2: ECS用モジュールを作成",
    description: "ECR + ECSクラスター + Fargateサービス + ALBをまとめたモジュール。リージョンを変えるだけで再利用可能。",
    fileHint: "modules/ecs-app/main.tf（抜粋）",
    code: `# modules/ecs-app/main.tf（主要リソースの抜粋）

# ECRリポジトリ
resource "aws_ecr_repository" "app" {
  name                 = var.app_name
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
}

# ECSクラスター
resource "aws_ecs_cluster" "main" {
  name = "\${var.app_name}-\${var.environment}"
}

# タスク定義
resource "aws_ecs_task_definition" "app" {
  family                   = var.app_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([{
    name  = var.app_name
    image = "\${aws_ecr_repository.app.repository_url}:latest"
    portMappings = [{ containerPort = 80 }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.app.name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

# ECSサービス + ALB
resource "aws_ecs_service" "app" {
  name            = var.app_name
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = var.app_name
    container_port   = 80
  }
}`,
  },
  {
    title: "Step 3: 大阪リージョンにデプロイ",
    description: "大阪リージョン用の設定を作成して、ECS環境を構築＆Dockerイメージをデプロイします。",
    fileHint: "environments/osaka/main.tf",
    code: `# environments/osaka/main.tf
provider "aws" {
  region = "ap-northeast-3"  # 大阪！
}

module "app" {
  source       = "../../modules/ecs-app"
  app_name     = "my-learning-app"
  environment  = "prod-osaka"
  region       = "ap-northeast-3"
  cpu          = "256"     # 0.25 vCPU
  memory       = "512"     # 512MB
  desired_count = 1        # テスト時は1台で十分

  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  public_subnet_ids  = module.networking.public_subnet_ids
}

output "app_url" {
  value = module.app.alb_dns_name
}

output "ecr_repository_url" {
  value = module.app.ecr_repository_url
}

# ========================================
# デプロイ手順
# ========================================

# 1. インフラ構築
# $ cd environments/osaka
# $ terraform init
# $ terraform apply

# 2. Dockerイメージをビルド & プッシュ
# $ ECR_URL=$(terraform output -raw ecr_repository_url)
# $ docker build -t my-learning-app ../../my-react-app/
# $ aws ecr get-login-password --region ap-northeast-3 | \\
#     docker login --username AWS --password-stdin $ECR_URL
# $ docker tag my-learning-app:latest $ECR_URL:latest
# $ docker push $ECR_URL:latest

# 3. ECSサービスを更新（新イメージでデプロイ）
# $ aws ecs update-service \\
#     --cluster my-learning-app-prod-osaka \\
#     --service my-learning-app \\
#     --force-new-deployment \\
#     --region ap-northeast-3

# 4. アクセス確認
# $ ALB_URL=$(terraform output -raw app_url)
# $ curl -s -o /dev/null -w "%{http_code}" http://$ALB_URL
# → 200`,
    tips: [
      "ECRリポジトリはリージョンごとに作成される",
      "イメージのプッシュ先はリージョンのECR URL",
      "aws ecs update-service --force-new-deployment で最新イメージに更新",
    ],
  },
];

const ec2NginxSteps: Step[] = [
  {
    title: "Step 1: EC2 + Nginx モジュールを作成",
    description: "EC2インスタンスにNginxをインストールし、Reactアプリを配信します。user_dataでセットアップを自動化。",
    fileHint: "modules/ec2-web/main.tf（抜粋）",
    code: `# modules/ec2-web/main.tf

# 最新のAmazon Linux 2023 AMI を自動取得（リージョン対応）
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_instance" "web" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [aws_security_group.web.id]
  key_name               = var.key_name

  # 起動時にNginxを自動セットアップ
  user_data = <<-EOF
    #!/bin/bash
    dnf update -y
    dnf install -y nginx
    systemctl enable nginx
    systemctl start nginx
    
    # Nginx設定（SPA対応）
    cat > /etc/nginx/conf.d/app.conf << 'CONF'
    server {
        listen 80;
        root /var/www/app;
        index index.html;
        
        location / {
            try_files $uri $uri/ /index.html;
        }
        
        # 静的ファイルのキャッシュ設定
        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }
    CONF
    
    rm -f /etc/nginx/conf.d/default.conf
    mkdir -p /var/www/app
    systemctl restart nginx
  EOF

  tags = {
    Name        = "\${var.app_name}-\${var.environment}"
    Environment = var.environment
  }
}

# セキュリティグループ
resource "aws_security_group" "web" {
  name   = "\${var.app_name}-\${var.environment}-web"
  vpc_id = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_allowed_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}`,
    tips: [
      "data \"aws_ami\" で最新AMIを動的取得するので、リージョンが変わってもOK",
      "user_data は初回起動時のみ実行される",
    ],
  },
  {
    title: "Step 2: 大阪リージョンにデプロイ & ファイル転送",
    description: "EC2インスタンスを大阪リージョンに作成し、scpでReactアプリのビルドファイルを転送します。",
    fileHint: "environments/osaka/main.tf & ターミナル",
    code: `# environments/osaka/main.tf
provider "aws" {
  region = "ap-northeast-3"  # 大阪
}

module "web" {
  source           = "../../modules/ec2-web"
  app_name         = "my-learning-app"
  environment      = "prod-osaka"
  instance_type    = "t3.micro"
  vpc_id           = module.networking.vpc_id
  subnet_id        = module.networking.public_subnet_ids[0]
  key_name         = var.key_name
  ssh_allowed_cidr = var.my_ip_cidr
}

output "public_ip" {
  value = module.web.public_ip
}

output "site_url" {
  value = "http://\${module.web.public_ip}"
}

# ========================================
# デプロイ手順
# ========================================

# 1. インフラ構築
# $ cd environments/osaka
# $ terraform init
# $ terraform apply

# 2. Reactアプリをビルド
# $ cd ../../my-react-app
# $ npm run build

# 3. ビルドファイルをEC2に転送
# $ IP=$(cd ../my-app-infra/environments/osaka && terraform output -raw public_ip)
# $ scp -r -i ~/.ssh/my-key.pem dist/* ec2-user@$IP:/var/www/app/

# 4. アクセス確認
# $ curl http://$IP
# → HTMLが返ってくればOK！`,
    tips: [
      "t3.micro は無料枠対象（12ヶ月間）",
      "本番ではALB + Auto Scaling Group を検討",
      "HTTPS対応にはACM + ALBまたはLet's Encryptが必要",
    ],
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1.5 rounded hover:bg-white/10 transition-colors"
      title="コピー"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
    </button>
  );
}

function StepList({ steps, color }: { steps: Step[]; color: string }) {
  const [expanded, setExpanded] = useState<number | null>(0);

  return (
    <div className="space-y-4">
      {steps.map((step, i) => {
        const isOpen = expanded === i;
        return (
          <div key={step.title} className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center gap-4 p-5 text-left"
              onClick={() => setExpanded(isOpen ? null : i)}
            >
              <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center shrink-0`}>
                <span className="text-white text-[14px]">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[15px]">{step.title}</p>
                  {step.fileHint && (
                    <code className="text-[11px] bg-muted px-2 py-0.5 rounded text-purple-600">
                      {step.fileHint}
                    </code>
                  )}
                </div>
                <p className="text-[13px] text-muted-foreground">{step.description}</p>
              </div>
              {isOpen ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
              )}
            </button>
            {isOpen && (
              <div className="px-5 pb-5 space-y-4">
                <div className="relative">
                  <div className="absolute top-2 right-2 z-10">
                    <CopyButton text={step.code} />
                  </div>
                  <pre className="bg-[#1e1e2e] text-[#cdd6f4] text-[13px] p-4 rounded-lg overflow-x-auto">
                    <code>{step.code}</code>
                  </pre>
                  <div className="flex justify-end mt-2">
                    <DownloadCodeButton
                      code={step.code}
                      filename={`${step.title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}.tf`}
                    />
                  </div>
                </div>
                {step.tips && step.tips.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-[13px] text-blue-700 mb-2">Tips</p>
                    <ul className="space-y-1.5">
                      {step.tips.map((tip) => (
                        <li key={tip} className="text-[13px] text-blue-800 flex items-start gap-2">
                          <span className="text-blue-500 mt-0.5">*</span> {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {step.warnings && step.warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <p className="text-[13px] text-amber-700">注意</p>
                    </div>
                    {step.warnings.map((w) => (
                      <p key={w} className="text-[13px] text-amber-800 ml-6">{w}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DeployPractice() {
  const [scenario, setScenario] = useState<Scenario>("s3-cloudfront");

  const currentScenario = scenarios.find((s) => s.id === scenario)!;

  const stepMap: Record<Scenario, Step[]> = {
    "s3-cloudfront": s3CloudfrontSteps,
    "ecs-fargate": ecsFargateSteps,
    "ec2-nginx": ec2NginxSteps,
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1>デプロイ実践ガイド</h1>
        <p className="text-muted-foreground mt-1">
          「このアプリを大阪リージョンにデプロイしたい！」を実現するステップバイステップ手順
        </p>
      </div>

      {/* Intro */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Rocket className="w-6 h-6 text-purple-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[15px] text-purple-800">やりたいこと</p>
            <p className="text-[14px] text-purple-700 mt-1">
              今見ているこのTerraform学習ダッシュボード（Reactアプリ）を、
              <strong>大阪リージョン（ap-northeast-3）</strong>にデプロイして動かす。
              さらに東京やバージニアにも同じ手順で展開する。
            </p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-[12px] bg-purple-100 text-purple-700 px-2 py-1 rounded">React App</span>
              <ArrowRight className="w-3 h-3 text-purple-400" />
              <span className="text-[12px] bg-purple-100 text-purple-700 px-2 py-1 rounded">npm run build</span>
              <ArrowRight className="w-3 h-3 text-purple-400" />
              <span className="text-[12px] bg-purple-100 text-purple-700 px-2 py-1 rounded">Terraform</span>
              <ArrowRight className="w-3 h-3 text-purple-400" />
              <span className="text-[12px] bg-orange-100 text-orange-700 px-2 py-1 rounded">大阪リージョン</span>
              <span className="text-[12px] bg-blue-100 text-blue-700 px-2 py-1 rounded">東京リージョン</span>
              <span className="text-[12px] bg-green-100 text-green-700 px-2 py-1 rounded">バージニア</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scenario Selection */}
      <div>
        <h2 className="mb-3">デプロイ方式を選択</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => setScenario(s.id)}
              className={`p-5 rounded-xl border text-left transition-all ${
                scenario === s.id
                  ? "border-purple-500 bg-purple-50 shadow-sm"
                  : "border-border bg-card hover:border-purple-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center`}>
                  <s.icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-[14px]">{s.name}</span>
              </div>
              <p className="text-[12px] text-muted-foreground">{s.description}</p>
              <div className="flex gap-2 mt-3">
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full ${
                    s.difficulty === "初級" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {s.difficulty}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {s.cost}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected scenario info */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-10 h-10 rounded-lg ${currentScenario.color} flex items-center justify-center`}>
            <currentScenario.icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2>{currentScenario.name}</h2>
            <p className="text-[13px] text-muted-foreground">
              {stepMap[scenario].length} ステップ
            </p>
          </div>
        </div>
        <p className="text-[14px] text-muted-foreground">{currentScenario.description}</p>
        {scenario === "s3-cloudfront" && (
          <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-[12px] text-green-700">
              <strong>おすすめ:</strong> Reactアプリ（静的サイト）のデプロイにはS3 + CloudFrontが最適です。サーバー管理不要、高速、低コスト！
            </p>
          </div>
        )}
      </div>

      {/* Steps */}
      <StepList steps={stepMap[scenario]} color={currentScenario.color} />

      {/* Summary */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="mb-4">まとめ: リージョン展開チートシート</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3">手順</th>
                <th className="text-left py-2 px-3">東京</th>
                <th className="text-left py-2 px-3">大阪</th>
                <th className="text-left py-2 px-3">バージニア</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="py-2 px-3 text-purple-600">リージョンコード</td>
                <td className="py-2 px-3"><code className="bg-muted px-1 rounded">ap-northeast-1</code></td>
                <td className="py-2 px-3"><code className="bg-muted px-1 rounded">ap-northeast-3</code></td>
                <td className="py-2 px-3"><code className="bg-muted px-1 rounded">us-east-1</code></td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 px-3 text-purple-600">作業ディレクトリ</td>
                <td className="py-2 px-3">environments/tokyo/</td>
                <td className="py-2 px-3">environments/osaka/</td>
                <td className="py-2 px-3">environments/virginia/</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 px-3 text-purple-600">terraform init</td>
                <td className="py-2 px-3">✅ 同じ</td>
                <td className="py-2 px-3">✅ 同じ</td>
                <td className="py-2 px-3">✅ 同じ</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 px-3 text-purple-600">terraform apply</td>
                <td className="py-2 px-3">✅ 同じ</td>
                <td className="py-2 px-3">✅ 同じ</td>
                <td className="py-2 px-3">✅ 同じ</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 px-3 text-purple-600">ファイルアップロード</td>
                <td className="py-2 px-3">✅ 同じ</td>
                <td className="py-2 px-3">✅ 同じ</td>
                <td className="py-2 px-3">✅ 同じ</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-purple-600">変わるのは...</td>
                <td className="py-2 px-3 text-muted-foreground">region名 & バケット名だけ！</td>
                <td className="py-2 px-3 text-muted-foreground">region名 & バケット名だけ！</td>
                <td className="py-2 px-3 text-muted-foreground">region名 & バケット名だけ！</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-muted-foreground mt-4">
          モジュール化のおかげで、<strong>リージョンコードとリソース名を変えるだけ</strong>で
          世界中のどのリージョンにも同じ構成をデプロイできます。これがTerraformの真骨頂です！
        </p>
      </div>
    </div>
  );
}
