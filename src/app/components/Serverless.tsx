import { useState } from "react";
import {
  Zap,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  AlertTriangle,
  FolderTree,
  Layers,
  Settings,
  Shield,
  RefreshCw,
  Eye,
  Package,
  ArrowRight,
  GitBranch,
  Database,
} from "lucide-react";
import { DownloadCodeButton } from "./DownloadCodeButton";

type Tab = "overview" | "lambda-module" | "api-gateway" | "integration" | "multi-lambda" | "versioning" | "monitoring";

const tabs: { id: Tab; label: string; icon: React.ElementType; color: string }[] = [
  { id: "overview", label: "全体像", icon: FolderTree, color: "bg-amber-600" },
  { id: "lambda-module", label: "Lambdaモジュール", icon: Package, color: "bg-orange-500" },
  { id: "api-gateway", label: "API Gateway", icon: Zap, color: "bg-purple-600" },
  { id: "integration", label: "統合構成", icon: Layers, color: "bg-blue-600" },
  { id: "multi-lambda", label: "複数Lambda管理", icon: GitBranch, color: "bg-green-600" },
  { id: "versioning", label: "バージョン管理", icon: RefreshCw, color: "bg-teal-600" },
  { id: "monitoring", label: "監視・ログ", icon: Eye, color: "bg-red-600" },
];

interface Section {
  title: string;
  description: string;
  code: string;
  tips?: string[];
  warnings?: string[];
  fileHint?: string;
}

const overviewSections: Section[] = [
  {
    title: "API Gateway + Lambda の全体構成",
    description:
      "API GatewayをフロントにしてLambda関数をバックエンドとして呼び出す、サーバーレスAPIの典型的な構成です。Terraformでどのようにモジュール化するかが重要になります。",
    code: `# ========================================
# サーバーレスAPIの全体アーキテクチャ
# ========================================

クライアント
    │
    ▼
┌─────────────────────────┐
│   API Gateway (REST)     │  ← ルーティング・認証・レート制限
│   /api/users   → GET     │
│   /api/users   → POST    │
│   /api/users/{id} → GET  │
│   /api/orders  → GET     │
│   /api/orders  → POST    │
└────────┬────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ Lambda │ │ Lambda │         ← ビジネスロジック
│ users  │ │ orders │
└───┬────┘ └───┬────┘
    │          │
    ▼          ▼
┌────────┐ ┌────────┐
│DynamoDB│ │DynamoDB│         ← データストア
│ users  │ │ orders │
└────────┘ └────────┘

# ========================================
# Terraformでの管理単位（モジュール分割）
# ========================================

project/
├── modules/
│   ├── lambda-function/     # Lambda関数の汎用モジュール
│   │   ├── main.tf          #   IAMロール + Lambda本体
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   ├── api-gateway/         # API Gatewayモジュール
│   │   ├── main.tf          #   REST API + ステージ
│   │   ├── routes.tf        #   ルーティング定義
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   └── serverless-api/      # 統合モジュール（Lambda + API GW）
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
│
├── lambdas/                 # Lambda関数のソースコード
│   ├── users/
│   │   ├── index.js         #   (or index.py, main.go)
│   │   └── package.json
│   └── orders/
│       ├── index.js
│       └── package.json
│
└── environments/
    ├── dev/
    └── prod/`,
    tips: [
      "Lambda関数のコードとTerraformの設定は同じリポジトリで管理するのが一般的",
      "モジュールは「Lambda汎用」「API Gateway」「統合」の3層に分けると再利用しやすい",
      "lambdas/ ディレクトリに関数ごとのソースコードを配置",
    ],
  },
  {
    title: "モジュール分割の考え方",
    description:
      "「1つの巨大モジュール」vs「細かいモジュールの組み合わせ」のトレードオフと推奨パターン。",
    code: `# ========================================
# ❌ アンチパターン: 全部1ファイルに書く
# ========================================
# main.tf に Lambda, API Gateway, IAM, DynamoDB を全部書く
# → 1000行超えのファイルになり管理不能に...

# ========================================
# ❌ アンチパターン: Lambda関数ごとに全リソースを書く
# ========================================
# users-lambda.tf に IAMロール + Lambda + API GWルート
# orders-lambda.tf に IAMロール + Lambda + API GWルート
# → コードの重複が大量に発生...

# ========================================
# ✅ 推奨: 汎用モジュール + 環境別の呼び出し
# ========================================

# 汎用Lambdaモジュールを1つ作る
module "users_function" {
  source        = "./modules/lambda-function"
  function_name = "users-api"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  source_dir    = "./lambdas/users"
  environment_variables = {
    TABLE_NAME = module.users_table.table_name
  }
}

module "orders_function" {
  source        = "./modules/lambda-function"
  function_name = "orders-api"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  source_dir    = "./lambdas/orders"
  environment_variables = {
    TABLE_NAME = module.orders_table.table_name
  }
}

# → 同じモジュールを呼ぶだけ！変わるのは設定値のみ

# ========================================
# モジュールの責任範囲
# ========================================
# lambda-function モジュール:
#   - IAMロール（実行ロール）
#   - Lambda関数本体
#   - CloudWatch Logsのロググループ
#   - ソースコードのZIPパッケージング
#
# api-gateway モジュール:
#   - REST API / HTTP API
#   - ステージ（dev, prod）
#   - ルーティング定義
#   - Lambda統合（integration）
#   - Lambda実行権限（permission）
#
# 呼び出し側（環境別 main.tf）:
#   - モジュールの組み合わせ
#   - DynamoDB等のデータストア
#   - 環境固有のパラメータ`,
    tips: [
      "モジュールは「1つの責任」を持つように設計する",
      "Lambda関数が増えてもモジュール呼び出しを追加するだけ",
      "for_each を使えばさらにDRYに書ける（後述）",
    ],
  },
];

const lambdaModuleSections: Section[] = [
  {
    title: "Step 1: Lambda汎用モジュールの変数定義",
    description:
      "どのLambda関数でも使い回せる汎用モジュールを作ります。まずは入力変数を定義。",
    fileHint: "modules/lambda-function/variables.tf",
    code: `# modules/lambda-function/variables.tf

variable "function_name" {
  description = "Lambda関数の名前"
  type        = string
}

variable "description" {
  description = "Lambda関数の説明"
  type        = string
  default     = ""
}

variable "runtime" {
  description = "ランタイム（nodejs20.x, python3.12, go1.x 等）"
  type        = string
  default     = "nodejs20.x"
}

variable "handler" {
  description = "ハンドラー（ファイル名.関数名）"
  type        = string
  default     = "index.handler"
}

variable "source_dir" {
  description = "Lambda関数のソースコードディレクトリ"
  type        = string
}

variable "memory_size" {
  description = "メモリサイズ（MB）"
  type        = number
  default     = 128
}

variable "timeout" {
  description = "タイムアウト（秒）"
  type        = number
  default     = 30
}

variable "environment_variables" {
  description = "環境変数"
  type        = map(string)
  default     = {}
}

variable "environment" {
  description = "環境名（dev, staging, prod）"
  type        = string
  default     = "dev"
}

variable "layers" {
  description = "Lambda Layerの ARN リスト"
  type        = list(string)
  default     = []
}

variable "vpc_config" {
  description = "VPC設定（RDS等に接続する場合）"
  type = object({
    subnet_ids         = list(string)
    security_group_ids = list(string)
  })
  default = null
}

variable "additional_policies" {
  description = "追加のIAMポリシーARNリスト"
  type        = list(string)
  default     = []
}`,
    tips: [
      "default を設定しておくと、呼び出し側で省略できて便利",
      "vpc_config は RDS や ElastiCache に接続する Lambda でのみ使う",
      "additional_policies で関数ごとに必要な権限を追加できる",
    ],
  },
  {
    title: "Step 2: Lambda本体 + IAMロールの定義",
    description:
      "Lambda関数の実行ロール、ソースコードのZIPパッケージング、Lambda関数本体を定義します。",
    fileHint: "modules/lambda-function/main.tf",
    code: `# modules/lambda-function/main.tf

# ========================================
# IAMロール（Lambda実行ロール）
# ========================================
resource "aws_iam_role" "lambda" {
  name = "\${var.function_name}-\${var.environment}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = {
    Function    = var.function_name
    Environment = var.environment
  }
}

# 基本的な実行権限（CloudWatch Logsへの書き込み）
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# VPC内で実行する場合のENI操作権限
resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  count      = var.vpc_config != null ? 1 : 0
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# 追加のポリシー（DynamoDB操作等）
resource "aws_iam_role_policy_attachment" "additional" {
  count      = length(var.additional_policies)
  role       = aws_iam_role.lambda.name
  policy_arn = var.additional_policies[count.index]
}

# ========================================
# ソースコードのZIPパッケージング
# ========================================
data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = var.source_dir
  output_path = "\${path.module}/tmp/\${var.function_name}.zip"
}

# ========================================
# Lambda関数
# ========================================
resource "aws_lambda_function" "this" {
  function_name = "\${var.function_name}-\${var.environment}"
  description   = var.description
  role          = aws_iam_role.lambda.arn

  # ソースコード
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256

  runtime     = var.runtime
  handler     = var.handler
  memory_size = var.memory_size
  timeout     = var.timeout
  layers      = var.layers

  # 環境変数
  dynamic "environment" {
    for_each = length(var.environment_variables) > 0 ? [1] : []
    content {
      variables = merge(var.environment_variables, {
        ENVIRONMENT = var.environment
      })
    }
  }

  # VPC設定（オプション）
  dynamic "vpc_config" {
    for_each = var.vpc_config != null ? [var.vpc_config] : []
    content {
      subnet_ids         = vpc_config.value.subnet_ids
      security_group_ids = vpc_config.value.security_group_ids
    }
  }

  tags = {
    Function    = var.function_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ========================================
# CloudWatch Logs ロググループ
# ========================================
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/\${aws_lambda_function.this.function_name}"
  retention_in_days = var.environment == "prod" ? 90 : 14

  tags = {
    Function    = var.function_name
    Environment = var.environment
  }
}`,
    tips: [
      "archive_file でソースコードを自動でZIP化（手動不要）",
      "source_code_hash でコードが変更された時だけ再デプロイされる",
      "dynamic ブロックで vpc_config をオプション化",
      "ロググループの retention_in_days を環境で変える（コスト最適化）",
    ],
    warnings: [
      "Lambda Layerに node_modules を入れるとデプロイサイズを削減可能",
      "archive_file は terraform plan 時にZIPを作成するため、ソースコードが必要",
    ],
  },
  {
    title: "Step 3: モジュールの出力定義",
    description: "API Gatewayとの統合や他のリソースから参照するための出力値を定義します。",
    fileHint: "modules/lambda-function/outputs.tf",
    code: `# modules/lambda-function/outputs.tf

output "function_name" {
  description = "Lambda関数名"
  value       = aws_lambda_function.this.function_name
}

output "function_arn" {
  description = "Lambda関数のARN"
  value       = aws_lambda_function.this.arn
}

output "invoke_arn" {
  description = "Lambda関数のInvoke ARN（API Gateway統合で使用）"
  value       = aws_lambda_function.this.invoke_arn
}

output "role_name" {
  description = "IAMロール名"
  value       = aws_iam_role.lambda.name
}

output "role_arn" {
  description = "IAMロールのARN"
  value       = aws_iam_role.lambda.arn
}

output "log_group_name" {
  description = "CloudWatch Logsのロググループ名"
  value       = aws_cloudwatch_log_group.lambda.name
}

# ★ 重要: invoke_arn はAPI Gateway統合に必須
# aws_lambda_function.this.arn → Lambda自体のARN
# aws_lambda_function.this.invoke_arn → API GWから呼ぶ時のARN
# この2つは異なるので注意！`,
    tips: [
      "invoke_arn は API Gateway の integration_uri に指定する",
      "function_arn は Lambda Permission（API GWからの呼び出し許可）に使う",
      "role_name は追加のポリシーをアタッチする時に使える",
    ],
  },
];

const apiGatewaySections: Section[] = [
  {
    title: "REST API vs HTTP API の選び方",
    description:
      "API Gatewayには REST API と HTTP API の2種類があります。用途に応じて選びましょう。",
    code: `# ========================================
# REST API vs HTTP API 比較
# ========================================

# HTTP API（v2）- おすすめ！
# ✅ 料金が安い（REST APIの約30%のコスト）
# ✅ レイテンシが低い
# ✅ JWT認証がネイティブサポート
# ✅ CORSの設定が簡単
# ✅ 自動デプロイ
# ❌ WAF非対応
# ❌ APIキー認証なし
# ❌ リクエスト/レスポンス変換が限定的

# REST API（v1）
# ✅ 全機能が使える（WAF, APIキー, 使用量プラン等）
# ✅ リクエスト/レスポンスの変換が柔軟
# ✅ キャッシュ機能
# ❌ 料金が高い
# ❌ 設定が複雑

# ========================================
# 判断フローチャート
# ========================================
# WAFが必要？ → YES → REST API
# APIキー認証が必要？ → YES → REST API
# レスポンス変換が必要？ → YES → REST API
# ↓ 全部 NO
# HTTP API を使おう！（安くて速い）

# ========================================
# Terraform リソース名の対応
# ========================================
# HTTP API:
#   aws_apigatewayv2_api
#   aws_apigatewayv2_stage
#   aws_apigatewayv2_integration
#   aws_apigatewayv2_route
#
# REST API:
#   aws_api_gateway_rest_api
#   aws_api_gateway_stage
#   aws_api_gateway_integration
#   aws_api_gateway_method
#   aws_api_gateway_resource`,
    tips: [
      "新規プロジェクトなら HTTP API がおすすめ（シンプル + 低コスト）",
      "既存の REST API から HTTP API への移行も可能",
      "この後の例では両方のパターンを示します",
    ],
  },
  {
    title: "HTTP API モジュール（推奨）",
    description: "シンプルで低コストな HTTP API（v2）のモジュールを作成します。",
    fileHint: "modules/api-gateway-v2/main.tf",
    code: `# modules/api-gateway-v2/main.tf

# ========================================
# HTTP API 本体
# ========================================
resource "aws_apigatewayv2_api" "this" {
  name          = "\${var.api_name}-\${var.environment}"
  protocol_type = "HTTP"
  description   = var.description

  # CORS設定
  cors_configuration {
    allow_origins = var.cors_allow_origins
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization", "X-Api-Key"]
    max_age       = 3600
  }

  tags = {
    Name        = var.api_name
    Environment = var.environment
  }
}

# ========================================
# ステージ（dev, prod等）
# ========================================
resource "aws_apigatewayv2_stage" "this" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = var.stage_name
  auto_deploy = true  # ルート変更時に自動デプロイ

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      errorMessage   = "$context.error.message"
      integrationError = "$context.integrationErrorMessage"
    })
  }

  default_route_settings {
    throttling_burst_limit = var.throttle_burst_limit
    throttling_rate_limit  = var.throttle_rate_limit
  }
}

# アクセスログ
resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/apigateway/\${var.api_name}-\${var.environment}"
  retention_in_days = var.environment == "prod" ? 90 : 14
}

# ========================================
# Lambda統合 + ルート（for_each で一括定義！）
# ========================================
resource "aws_apigatewayv2_integration" "lambda" {
  for_each = var.routes

  api_id             = aws_apigatewayv2_api.this.id
  integration_type   = "AWS_PROXY"
  integration_uri    = each.value.invoke_arn
  integration_method = "POST"  # Lambda統合は常にPOST
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "lambda" {
  for_each = var.routes

  api_id    = aws_apigatewayv2_api.this.id
  route_key = each.key  # "GET /api/users", "POST /api/users" 等
  target    = "integrations/\${aws_apigatewayv2_integration.lambda[each.key].id}"
}

# Lambda実行権限（API GWからLambdaを呼ぶ許可）
resource "aws_lambda_permission" "api_gw" {
  for_each = var.routes

  statement_id  = "AllowAPIGateway-\${replace(each.key, " ", "-")}"
  action        = "lambda:InvokeFunction"
  function_name = each.value.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "\${aws_apigatewayv2_api.this.execution_arn}/*/*"
}`,
    tips: [
      "for_each で全ルートを一括定義（Lambda関数が増えてもDRY）",
      "payload_format_version = \"2.0\" で新しいイベント形式を使う",
      "auto_deploy = true でルート変更が即座に反映",
      "aws_lambda_permission を忘れると API GW → Lambda の呼び出しが403になる！",
    ],
    warnings: [
      "aws_lambda_permission を忘れるのが最も多いミス（API GWが Lambda を呼べない）",
    ],
  },
  {
    title: "HTTP API モジュールの変数と出力",
    description: "API Gatewayモジュールの入力変数と出力値を定義します。routes 変数がポイント。",
    fileHint: "modules/api-gateway-v2/variables.tf & outputs.tf",
    code: `# modules/api-gateway-v2/variables.tf

variable "api_name" {
  description = "API名"
  type        = string
}

variable "description" {
  description = "APIの説明"
  type        = string
  default     = ""
}

variable "environment" {
  description = "環境名"
  type        = string
}

variable "stage_name" {
  description = "ステージ名"
  type        = string
  default     = "$default"
}

# ★ ルーティング定義（これが一番重要！）
variable "routes" {
  description = "APIルートの定義（route_key → Lambda情報）"
  type = map(object({
    invoke_arn    = string  # Lambda の invoke_arn
    function_name = string  # Lambda の function_name
  }))
  # 例:
  # {
  #   "GET /api/users"       = { invoke_arn = "...", function_name = "..." }
  #   "POST /api/users"      = { invoke_arn = "...", function_name = "..." }
  #   "GET /api/users/{id}"  = { invoke_arn = "...", function_name = "..." }
  # }
}

variable "cors_allow_origins" {
  description = "CORS許可オリジン"
  type        = list(string)
  default     = ["*"]
}

variable "throttle_burst_limit" {
  description = "スロットリング バースト制限"
  type        = number
  default     = 100
}

variable "throttle_rate_limit" {
  description = "スロットリング レート制限（リクエスト/秒）"
  type        = number
  default     = 50
}

# ========================================

# modules/api-gateway-v2/outputs.tf

output "api_id" {
  value = aws_apigatewayv2_api.this.id
}

output "api_endpoint" {
  description = "APIのベースURL"
  value       = aws_apigatewayv2_api.this.api_endpoint
}

output "stage_invoke_url" {
  description = "ステージのInvoke URL"
  value       = aws_apigatewayv2_stage.this.invoke_url
}

output "execution_arn" {
  value = aws_apigatewayv2_api.this.execution_arn
}`,
    tips: [
      "routes 変数の key がそのままルートキーになる（\"GET /api/users\"等）",
      "パスパラメータは {id} のように波括弧で指定",
      "cors_allow_origins は本番では具体的なドメインを指定する",
    ],
  },
];

const integrationSections: Section[] = [
  {
    title: "Lambda + API Gateway を組み合わせる",
    description:
      "個別に作ったモジュールを環境別の main.tf で組み合わせます。ここが Terraform の真価を発揮するところ！",
    fileHint: "environments/dev/main.tf",
    code: `# environments/dev/main.tf

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region = "ap-northeast-1"
}

locals {
  environment = "dev"
  app_name    = "my-api"
}

# ========================================
# DynamoDB テーブル
# ========================================
resource "aws_dynamodb_table" "users" {
  name         = "users-\${local.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
}

resource "aws_dynamodb_table" "orders" {
  name         = "orders-\${local.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
}

# ========================================
# DynamoDB操作用のIAMポリシー
# ========================================
resource "aws_iam_policy" "users_dynamodb" {
  name = "users-dynamodb-\${local.environment}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ]
      Resource = [
        aws_dynamodb_table.users.arn,
        "\${aws_dynamodb_table.users.arn}/index/*"
      ]
    }]
  })
}

resource "aws_iam_policy" "orders_dynamodb" {
  name = "orders-dynamodb-\${local.environment}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ]
      Resource = [
        aws_dynamodb_table.orders.arn,
        "\${aws_dynamodb_table.orders.arn}/index/*"
      ]
    }]
  })
}

# ========================================
# Lambda関数（モジュール呼び出し）
# ========================================
module "users_function" {
  source        = "../../modules/lambda-function"
  function_name = "\${local.app_name}-users"
  description   = "Users API handler"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  source_dir    = "../../lambdas/users"
  memory_size   = 256
  timeout       = 10
  environment   = local.environment

  environment_variables = {
    TABLE_NAME = aws_dynamodb_table.users.name
  }

  additional_policies = [
    aws_iam_policy.users_dynamodb.arn
  ]
}

module "orders_function" {
  source        = "../../modules/lambda-function"
  function_name = "\${local.app_name}-orders"
  description   = "Orders API handler"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  source_dir    = "../../lambdas/orders"
  memory_size   = 256
  timeout       = 10
  environment   = local.environment

  environment_variables = {
    TABLE_NAME = aws_dynamodb_table.orders.name
  }

  additional_policies = [
    aws_iam_policy.orders_dynamodb.arn
  ]
}

# ========================================
# API Gateway（モジュール呼び出し）
# ========================================
module "api" {
  source      = "../../modules/api-gateway-v2"
  api_name    = local.app_name
  environment = local.environment

  cors_allow_origins = ["http://localhost:3000"]  # dev用

  # ★ ここでルーティングとLambda関数を紐付ける！
  routes = {
    "GET /api/users" = {
      invoke_arn    = module.users_function.invoke_arn
      function_name = module.users_function.function_name
    }
    "POST /api/users" = {
      invoke_arn    = module.users_function.invoke_arn
      function_name = module.users_function.function_name
    }
    "GET /api/users/{id}" = {
      invoke_arn    = module.users_function.invoke_arn
      function_name = module.users_function.function_name
    }
    "GET /api/orders" = {
      invoke_arn    = module.orders_function.invoke_arn
      function_name = module.orders_function.function_name
    }
    "POST /api/orders" = {
      invoke_arn    = module.orders_function.invoke_arn
      function_name = module.orders_function.function_name
    }
  }
}

# ========================================
# 出力
# ========================================
output "api_endpoint" {
  value = module.api.api_endpoint
}

output "users_function" {
  value = module.users_function.function_name
}

output "orders_function" {
  value = module.orders_function.function_name
}`,
    tips: [
      "routes でHTTPメソッド + パスとLambda関数の対応を宣言的に定義",
      "同じLambda関数を複数のルートに紐付けられる（GET/POST → 同一関数）",
      "DynamoDBのポリシーは最小権限（必要な操作+テーブルのみ許可）",
      "環境ごとに cors_allow_origins を変える（dev: localhost, prod: 本番ドメイン）",
    ],
  },
  {
    title: "Lambda関数のソースコード例",
    description: "Terraformで管理するLambda関数のソースコード例。lambdas/ ディレクトリに配置します。",
    fileHint: "lambdas/users/index.js",
    code: `// lambdas/users/index.js
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
  const { httpMethod, routeKey } = event.requestContext || {};
  const method = httpMethod || routeKey?.split(" ")[0];
  const path = event.rawPath || event.path;

  try {
    // GET /api/users - 一覧取得
    if (method === "GET" && !event.pathParameters?.id) {
      const result = await ddb.send(
        new ScanCommand({ TableName: TABLE_NAME })
      );
      return response(200, result.Items);
    }

    // GET /api/users/{id} - 個別取得
    if (method === "GET" && event.pathParameters?.id) {
      const result = await ddb.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { id: event.pathParameters.id },
        })
      );
      if (!result.Item) return response(404, { error: "Not found" });
      return response(200, result.Item);
    }

    // POST /api/users - 新規作成
    if (method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const item = {
        id: randomUUID(),
        ...body,
        createdAt: new Date().toISOString(),
      };
      await ddb.send(
        new PutCommand({ TableName: TABLE_NAME, Item: item })
      );
      return response(201, item);
    }

    return response(400, { error: "Unsupported method" });
  } catch (err) {
    console.error(err);
    return response(500, { error: "Internal server error" });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}

// ========================================
// lambdas/users/package.json
// ========================================
// {
//   "name": "users-api",
//   "version": "1.0.0",
//   "dependencies": {
//     "@aws-sdk/client-dynamodb": "^3.0.0",
//     "@aws-sdk/lib-dynamodb": "^3.0.0"
//   }
// }
//
// $ cd lambdas/users && npm install
// → node_modules が作られる
// → archive_file で自動的にZIPに含まれる`,
    tips: [
      "環境変数 TABLE_NAME はTerraformから渡される",
      "Lambda内のルーティングは httpMethod + pathParameters で分岐",
      "node_modules も source_dir に含めてZIP化する（またはLayerを使う）",
    ],
  },
];

const multiLambdaSections: Section[] = [
  {
    title: "for_each で大量のLambdaを一括管理",
    description:
      "Lambda関数が増えてきた時、for_each を使えばモジュール呼び出しを変数のマップ定義だけで管理できます。",
    fileHint: "environments/prod/main.tf",
    code: `# ========================================
# Lambda関数の定義をデータとして管理
# ========================================
locals {
  lambda_functions = {
    users = {
      description   = "Users API handler"
      source_dir    = "../../lambdas/users"
      memory_size   = 256
      timeout       = 10
      env_vars = {
        TABLE_NAME = aws_dynamodb_table.users.name
      }
      policies = [aws_iam_policy.users_dynamodb.arn]
    }
    orders = {
      description   = "Orders API handler"
      source_dir    = "../../lambdas/orders"
      memory_size   = 256
      timeout       = 10
      env_vars = {
        TABLE_NAME = aws_dynamodb_table.orders.name
      }
      policies = [aws_iam_policy.orders_dynamodb.arn]
    }
    notifications = {
      description   = "Notification service"
      source_dir    = "../../lambdas/notifications"
      memory_size   = 128
      timeout       = 30
      env_vars = {
        SNS_TOPIC_ARN = aws_sns_topic.alerts.arn
      }
      policies = [aws_iam_policy.sns_publish.arn]
    }
    auth = {
      description   = "Auth / token validation"
      source_dir    = "../../lambdas/auth"
      memory_size   = 128
      timeout       = 5
      env_vars = {
        JWT_SECRET_ARN = aws_secretsmanager_secret.jwt.arn
      }
      policies = [aws_iam_policy.secrets_read.arn]
    }
  }
}

# ========================================
# for_each で一括作成！
# ========================================
module "functions" {
  for_each = local.lambda_functions

  source        = "../../modules/lambda-function"
  function_name = "\${local.app_name}-\${each.key}"
  description   = each.value.description
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  source_dir    = each.value.source_dir
  memory_size   = each.value.memory_size
  timeout       = each.value.timeout
  environment   = local.environment

  environment_variables = each.value.env_vars
  additional_policies   = each.value.policies
}

# ========================================
# API Gateway ルーティング定義
# ========================================
locals {
  api_routes = {
    # Users
    "GET /api/users"        = "users"
    "POST /api/users"       = "users"
    "GET /api/users/{id}"   = "users"
    "PUT /api/users/{id}"   = "users"
    "DELETE /api/users/{id}" = "users"
    # Orders
    "GET /api/orders"       = "orders"
    "POST /api/orders"      = "orders"
    "GET /api/orders/{id}"  = "orders"
    # Notifications
    "POST /api/notifications" = "notifications"
    # Auth
    "POST /api/auth/login"    = "auth"
    "POST /api/auth/refresh"  = "auth"
  }

  # ルート定義をAPI Gatewayモジュール用に変換
  routes_for_api = {
    for route_key, func_name in local.api_routes :
    route_key => {
      invoke_arn    = module.functions[func_name].invoke_arn
      function_name = module.functions[func_name].function_name
    }
  }
}

module "api" {
  source      = "../../modules/api-gateway-v2"
  api_name    = local.app_name
  environment = local.environment
  routes      = local.routes_for_api  # ← 自動変換されたルート定義

  cors_allow_origins = [
    "https://app.example.com"
  ]
}

# ========================================
# 全関数の情報を出力
# ========================================
output "functions" {
  value = {
    for name, func in module.functions :
    name => {
      function_name = func.function_name
      arn           = func.function_arn
    }
  }
}

output "api_endpoint" {
  value = module.api.api_endpoint
}`,
    tips: [
      "for_each で Lambda をマップ化すると、関数の追加は locals にエントリを足すだけ",
      "api_routes で「HTTPメソッド + パス → 関数名」の対応を宣言的に管理",
      "for 式で api_routes を API Gateway モジュールの入力形式に自動変換",
      "関数が10個、20個に増えてもコード量がほとんど増えない！",
    ],
  },
  {
    title: "Lambda Layer で共通ライブラリを管理",
    description:
      "複数のLambda関数で共通のライブラリ（SDK、ユーティリティ等）を Lambda Layer として一元管理します。",
    fileHint: "modules/lambda-layer/main.tf",
    code: `# ========================================
# Lambda Layer モジュール
# ========================================
# modules/lambda-layer/main.tf

data "archive_file" "layer" {
  type        = "zip"
  source_dir  = var.source_dir
  output_path = "\${path.module}/tmp/\${var.layer_name}.zip"
}

resource "aws_lambda_layer_version" "this" {
  layer_name          = "\${var.layer_name}-\${var.environment}"
  filename            = data.archive_file.layer.output_path
  source_code_hash    = data.archive_file.layer.output_base64sha256
  compatible_runtimes = var.compatible_runtimes
  description         = var.description
}

# modules/lambda-layer/outputs.tf
output "layer_arn" {
  value = aws_lambda_layer_version.this.arn
}

# ========================================
# Layer のディレクトリ構成（Node.js）
# ========================================
# layers/
# └── common/
#     └── nodejs/              ← この構成が重要！
#         ├── package.json
#         └── node_modules/    ← npm install で生成
#             ├── uuid/
#             ├── dayjs/
#             └── ...
#
# ★ Lambda Layer は nodejs/ ディレクトリ直下に
#   node_modules がある必要がある

# ========================================
# 使い方
# ========================================
module "common_layer" {
  source             = "../../modules/lambda-layer"
  layer_name         = "common-libs"
  source_dir         = "../../layers/common"
  compatible_runtimes = ["nodejs20.x"]
  environment        = local.environment
  description        = "Common libraries (uuid, dayjs, etc.)"
}

# Lambda関数でLayerを参照
module "functions" {
  for_each = local.lambda_functions

  source   = "../../modules/lambda-function"
  # ... 他の設定 ...
  layers   = [module.common_layer.layer_arn]  # ← Layer を指定
}

# ========================================
# Layer を使うメリット
# ========================================
# 1. デプロイパッケージが小さくなる（高速デプロイ）
# 2. 共通ライブラリのバージョンを一元管理
# 3. Lambda関数のコードが純粋なビジネスロジックだけになる
# 4. Layer の更新だけで全関数に反映可能`,
    tips: [
      "nodejs/ ディレクトリ構成を間違えると Layer が読み込めないので注意",
      "Layer は最大5つまで重ね掛け可能",
      "共通のバリデーション、ロギング、エラーハンドリングを Layer に入れると便利",
    ],
  },
];

const versioningSections: Section[] = [
  {
    title: "Lambda のエイリアスとバージョン管理",
    description:
      "Lambda関数のバージョンとエイリアスを使って、安全なデプロイ（カナリアリリース、ロールバック）を実現します。",
    fileHint: "modules/lambda-function/main.tf に追加",
    code: `# ========================================
# Lambda バージョンの発行
# ========================================
resource "aws_lambda_function" "this" {
  # ... 既存の設定 ...
  publish = true  # ← これを追加！バージョンが自動発行される
}

# ========================================
# エイリアス（live = 本番トラフィック用）
# ========================================
resource "aws_lambda_alias" "live" {
  name             = "live"
  function_name    = aws_lambda_function.this.function_name
  function_version = aws_lambda_function.this.version

  # カナリアリリース: 新バージョンに10%のトラフィックを流す
  # routing_config {
  #   additional_version_weights = {
  #     (aws_lambda_function.this.version) = 0.1
  #   }
  # }
}

# ========================================
# API Gateway はエイリアスを参照する
# ========================================
# 直接 Lambda を参照する代わりに、エイリアスを参照
# こうすることで API GW の設定を変えずに Lambda だけ更新可能

# modules/lambda-function/outputs.tf に追加
output "alias_invoke_arn" {
  description = "エイリアスのInvoke ARN（API GW統合用）"
  value       = aws_lambda_alias.live.invoke_arn
}

output "alias_arn" {
  value = aws_lambda_alias.live.arn
}

# ========================================
# デプロイの流れ
# ========================================

# 1. Lambda のコードを更新
$ cd lambdas/users
$ vim index.js  # コードを修正
$ npm install   # 依存関係更新

# 2. terraform apply
$ cd environments/prod
$ terraform plan
# ~ aws_lambda_function.this (update)
#     source_code_hash: "old..." → "new..."
#     version:          "5" → "6"
# ~ aws_lambda_alias.live
#     function_version: "5" → "6"

$ terraform apply
# → 新しいバージョンが発行され、エイリアスが更新される

# 3. ロールバック（前のバージョンに戻す場合）
# エイリアスのバージョンを手動で書き換え
$ aws lambda update-alias \\
    --function-name my-api-users-prod \\
    --name live \\
    --function-version 5  # ← 前のバージョン番号

# ★ terraform state とズレるので、次の apply で修正される`,
    tips: [
      "publish = true でデプロイごとにバージョン番号がインクリメントされる",
      "エイリアス経由で参照すると、API GWの設定を変更せずにLambdaだけ更新可能",
      "routing_config でカナリアリリース（段階的トラフィック移行）が可能",
    ],
    warnings: [
      "ロールバックを AWS CLI で行うと terraform state とズレる。次の apply で自動修正されるが注意",
    ],
  },
  {
    title: "API Gateway のステージとデプロイ管理",
    description: "API Gatewayのステージ変数やデプロイ管理を使って、環境ごとに異なる設定を適用します。",
    code: `# ========================================
# ステージ変数（HTTP API）
# ========================================
resource "aws_apigatewayv2_stage" "this" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = var.environment  # "dev", "staging", "prod"
  auto_deploy = var.environment != "prod"  # prodは手動デプロイ

  stage_variables = {
    environment  = var.environment
    lambda_alias = "live"
  }

  # 環境別のスロットリング設定
  default_route_settings {
    throttling_burst_limit = var.environment == "prod" ? 1000 : 100
    throttling_rate_limit  = var.environment == "prod" ? 500 : 50
  }
}

# ========================================
# REST API の場合のデプロイ管理
# ========================================
resource "aws_api_gateway_deployment" "this" {
  rest_api_id = aws_api_gateway_rest_api.this.id

  # リソースやメソッドの変更を検知してデプロイ
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.users.id,
      aws_api_gateway_method.users_get.id,
      aws_api_gateway_integration.users_get.id,
      # ... 変更を検知したいリソースを列挙 ...
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ========================================
# 環境ごとのURL一覧
# ========================================
# dev:     https://abc123.execute-api.ap-northeast-1.amazonaws.com/dev
# staging: https://abc123.execute-api.ap-northeast-1.amazonaws.com/staging
# prod:    https://abc123.execute-api.ap-northeast-1.amazonaws.com/prod
#
# カスタムドメインを使う場合:
# dev:     https://api-dev.example.com
# prod:    https://api.example.com

# ========================================
# カスタムドメイン設定
# ========================================
resource "aws_apigatewayv2_domain_name" "api" {
  domain_name = "api\${var.environment == "prod" ? "" : "-\${var.environment}"}.example.com"

  domain_name_configuration {
    certificate_arn = var.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "api" {
  api_id      = aws_apigatewayv2_api.this.id
  domain_name = aws_apigatewayv2_domain_name.api.id
  stage       = aws_apigatewayv2_stage.this.id
}`,
    tips: [
      "prod は auto_deploy = false にして意図しない変更を防ぐ",
      "カスタムドメインを使うとURLが分かりやすくなる",
      "REST API の triggers で変更検知を忘れるとデプロイされないことがある",
    ],
  },
];

const monitoringSections: Section[] = [
  {
    title: "CloudWatch ダッシュボード + アラーム",
    description: "Lambda と API Gateway の主要メトリクスを監視し、異常を検出したらアラートを発報します。",
    fileHint: "modules/serverless-monitoring/main.tf",
    code: `# ========================================
# Lambda エラーアラーム
# ========================================
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = var.function_names

  alarm_name          = "\${each.value}-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300  # 5分間
  statistic           = "Sum"
  threshold           = 5   # 5分間に5エラー以上
  alarm_description   = "\${each.value} で連続エラーが発生"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = each.value
  }

  alarm_actions = [var.sns_topic_arn]
}

# ========================================
# Lambda スロットリングアラーム
# ========================================
resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  for_each = var.function_names

  alarm_name          = "\${each.value}-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "\${each.value} でスロットリング発生"

  dimensions = {
    FunctionName = each.value
  }

  alarm_actions = [var.sns_topic_arn]
}

# ========================================
# Lambda 実行時間アラーム（タイムアウト近いとき）
# ========================================
resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  for_each = var.function_names

  alarm_name          = "\${each.value}-high-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Average"
  threshold           = 8000  # 8秒（タイムアウト10秒の80%）
  alarm_description   = "\${each.value} の実行時間が長い"

  dimensions = {
    FunctionName = each.value
  }

  alarm_actions = [var.sns_topic_arn]
}

# ========================================
# API Gateway 5xx アラーム
# ========================================
resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "\${var.api_name}-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5xx"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "API Gateway で 5xx エラーが多発"

  dimensions = {
    ApiId = var.api_id
  }

  alarm_actions = [var.sns_topic_arn]
}

# ========================================
# API Gateway レイテンシアラーム
# ========================================
resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "\${var.api_name}-high-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "Latency"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "p99"     # 99パーセンタイル
  threshold           = 3000      # 3秒
  alarm_description   = "API レイテンシが高い（p99 > 3s）"

  dimensions = {
    ApiId = var.api_id
  }

  alarm_actions = [var.sns_topic_arn]
}

# ========================================
# SNS通知先（Slack, Email等）
# ========================================
resource "aws_sns_topic" "alerts" {
  name = "serverless-alerts-\${var.environment}"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Slack通知にはChatbot or Lambda + Slack Webhook を使う`,
    tips: [
      "Errors, Throttles, Duration の3つは Lambda の最重要メトリクス",
      "5xx と Latency は API Gateway の必須監視項目",
      "p99 レイテンシで「ほとんどのリクエスト」の応答時間を監視",
      "アラームは最初は緩めに設定し、徐々にチューニング",
    ],
  },
  {
    title: "X-Ray によるトレーシング",
    description: "AWS X-Ray を有効にすると、API Gateway → Lambda → DynamoDB のリクエストフローを可視化できます。",
    code: `# ========================================
# Lambda で X-Ray トレーシングを有効化
# ========================================

# modules/lambda-function/main.tf に追加
resource "aws_lambda_function" "this" {
  # ... 既存の設定 ...

  tracing_config {
    mode = "Active"  # または "PassThrough"
  }
}

# X-Ray の権限を追加
resource "aws_iam_role_policy_attachment" "xray" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

# ========================================
# API Gateway で X-Ray を有効化
# ========================================

# HTTP API の場合
# → 現時点で HTTP API はネイティブの X-Ray 統合なし
# → Lambda 側の Active tracing で対応

# REST API の場合
resource "aws_api_gateway_stage" "prod" {
  # ... 既存の設定 ...

  xray_tracing_enabled = true
}

# ========================================
# Lambda 関数内での X-Ray 利用
# ========================================
# // lambdas/users/index.js
# const AWSXRay = require("aws-xray-sdk-core");
# const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
#
# // X-Ray でDynamoDB呼び出しをトレース
# const client = AWSXRay.captureAWSv3Client(
#   new DynamoDBClient({})
# );
#
# // カスタムサブセグメント
# const segment = AWSXRay.getSegment();
# const subsegment = segment.addNewSubsegment("processData");
# // ... 処理 ...
# subsegment.close();

# ========================================
# 確認方法
# ========================================
# 1. AWS コンソール → X-Ray → Service Map
#    → API GW → Lambda → DynamoDB のフロー図が見える
#
# 2. Traces で個別リクエストのボトルネックを特定
#    → どのサービスで時間がかかっているか一目瞭然
#
# 3. Analytics で傾向を分析
#    → レスポンスタイム分布、エラー率のトレンド`,
    tips: [
      "X-Ray を有効にすると API GW → Lambda → DynamoDB の呼び出しチェーンが可視化される",
      "パフォーマンス問題の原因特定に非常に有効",
      "aws-xray-sdk-core を Lambda Layer に入れると全関数で使える",
      "本番では Active、開発では PassThrough が推奨",
    ],
  },
];

// ---- Shared UI ----
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

function SectionList({ sections, color }: { sections: Section[]; color: string }) {
  const [expanded, setExpanded] = useState<number | null>(0);
  return (
    <div className="space-y-4">
      {sections.map((section, i) => {
        const isOpen = expanded === i;
        return (
          <div key={section.title} className="bg-card border border-border rounded-xl overflow-hidden">
            <button className="w-full flex items-center gap-4 p-5 text-left" onClick={() => setExpanded(isOpen ? null : i)}>
              <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center shrink-0`}>
                <span className="text-white text-[14px]">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[15px]">{section.title}</p>
                  {section.fileHint && (
                    <code className="text-[11px] bg-muted px-2 py-0.5 rounded text-purple-600">{section.fileHint}</code>
                  )}
                </div>
                <p className="text-[13px] text-muted-foreground">{section.description}</p>
              </div>
              {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />}
            </button>
            {isOpen && (
              <div className="px-5 pb-5 space-y-4">
                <div className="relative">
                  <div className="absolute top-2 right-2 z-10"><CopyButton text={section.code} /></div>
                  <div>
                    <pre className="bg-[#1e1e2e] text-[#cdd6f4] text-[13px] p-4 rounded-lg overflow-x-auto"><code>{section.code}</code></pre>
                    <div className="flex justify-end mt-2">
                      <DownloadCodeButton
                        code={section.code}
                        filename={`${section.title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}.tf`}
                      />
                    </div>
                  </div>
                </div>
                {section.tips && section.tips.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-[13px] text-blue-700 mb-2">Tips</p>
                    <ul className="space-y-1.5">
                      {section.tips.map((tip) => (
                        <li key={tip} className="text-[13px] text-blue-800 flex items-start gap-2">
                          <span className="text-blue-500 mt-0.5">*</span> {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {section.warnings && section.warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <p className="text-[13px] text-amber-700">注意</p>
                    </div>
                    {section.warnings.map((w) => (
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

const sectionMap: Record<Tab, Section[]> = {
  overview: overviewSections,
  "lambda-module": lambdaModuleSections,
  "api-gateway": apiGatewaySections,
  integration: integrationSections,
  "multi-lambda": multiLambdaSections,
  versioning: versioningSections,
  monitoring: monitoringSections,
};

export function Serverless() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1>サーバーレス構築</h1>
        <p className="text-muted-foreground mt-1">
          API Gateway + Lambda のモジュール設計・複数Lambda管理・バージョニング・監視
        </p>
      </div>

      {/* Architecture summary */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Zap className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[15px] text-amber-800">このセクションで学ぶこと</p>
            <p className="text-[14px] text-amber-700 mt-1">
              API Gatewayをフロントにして複数のLambda関数を呼び出すサーバーレスAPIを、
              Terraformのモジュールで<strong>再利用可能かつスケーラブル</strong>に管理する方法。
            </p>
            <div className="flex items-center gap-1.5 mt-3 flex-wrap text-[12px]">
              {["クライアント", "API Gateway", "Lambda (users)", "DynamoDB"].map((item, i) => (
                <span key={item} className="flex items-center gap-1.5">
                  {i > 0 && <ArrowRight className="w-3 h-3 text-amber-400" />}
                  <span className={`px-2 py-1 rounded ${
                    i === 0 ? "bg-gray-100 text-gray-700" :
                    i === 1 ? "bg-purple-100 text-purple-700" :
                    i === 2 ? "bg-orange-100 text-orange-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>{item}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-[14px] transition-all ${
              activeTab === tab.id
                ? `${tab.color} text-white border-transparent`
                : "bg-card border-border text-muted-foreground hover:border-purple-300"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <SectionList sections={sectionMap[activeTab]} color={tabs.find((t) => t.id === activeTab)!.color} />
    </div>
  );
}
