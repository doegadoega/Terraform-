import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Package,
  Database,
  HardDrive,
  Layers,
  Shield,
  Lock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Zap,
  Eye,
} from "lucide-react";
import { DownloadCodeButton } from "./DownloadCodeButton";

type Tab =
  | "overview"
  | "ecr-best"
  | "s3"
  | "dynamodb"
  | "ecs-s3"
  | "ecs-dynamodb"
  | "lambda-s3"
  | "lambda-dynamodb"
  | "security"
  | "monitoring";

interface Section {
  title: string;
  description: string;
  code: string;
  tips?: string[];
  warnings?: string[];
}

const tabItems: {
  id: Tab;
  label: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { id: "overview", label: "全体像", icon: Layers, color: "bg-purple-600" },
  { id: "ecr-best", label: "ECR ベストプラクティス", icon: Package, color: "bg-orange-500" },
  { id: "s3", label: "S3 構築", icon: HardDrive, color: "bg-green-600" },
  { id: "dynamodb", label: "DynamoDB 構築", icon: Database, color: "bg-blue-600" },
  { id: "ecs-s3", label: "ECS + S3", icon: Package, color: "bg-cyan-600" },
  { id: "ecs-dynamodb", label: "ECS + DynamoDB", icon: Database, color: "bg-amber-600" },
  { id: "lambda-s3", label: "Lambda + S3", icon: Zap, color: "bg-rose-600" },
  { id: "lambda-dynamodb", label: "Lambda + DynamoDB", icon: Zap, color: "bg-violet-600" },
  { id: "security", label: "セキュリティ", icon: Shield, color: "bg-red-600" },
  { id: "monitoring", label: "監視・運用", icon: Eye, color: "bg-indigo-600" },
];

// ─── ECR ベストプラクティス ───
const ecrBestSections: Section[] = [
  {
    title: "ECR ライフサイクルポリシー",
    description:
      "古いイメージの自動削除ポリシーを設定し、ストレージコストを抑制します。未タグのイメージと、タグ付きでも一定数を超えたものを自動的にクリーンアップします。",
    code: `# ============================
# ECR リポジトリ（本番用）
# ============================
resource "aws_ecr_repository" "app" {
  name                 = "\${var.project}-app"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.ecr.arn
  }

  tags = {
    Name        = "\${var.project}-app"
    Environment = var.environment
  }
}

# ============================
# ライフサイクルポリシー
# ============================
resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "未タグイメージを7日後に削除"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "タグ付きイメージを最新20個まで保持"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v", "release"]
          countType     = "imageCountMoreThan"
          countNumber   = 20
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 3
        description  = "devタグは最新5個まで"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["dev", "staging"]
          countType     = "imageCountMoreThan"
          countNumber   = 5
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ECR用KMSキー
resource "aws_kms_key" "ecr" {
  description             = "ECR暗号化用KMSキー"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name = "\${var.project}-ecr-kms"
  }
}`,
    tips: [
      "image_tag_mutability = IMMUTABLE でタグの上書きを防止",
      "scan_on_push = true で脆弱性を自動スキャン",
      "KMS暗号化で保存時のセキュリティを強化",
      "ライフサイクルポリシーで古いイメージを自動削除しコスト削減",
    ],
  },
  {
    title: "ECR クロスアカウント共有",
    description:
      "複数AWSアカウント間でECRリポジトリを共有する設定です。開発アカウントでビルドしたイメージを、本番アカウントのECS/Lambdaからプルできます。",
    code: `# ============================
# ECR クロスアカウントポリシー
# ============================
resource "aws_ecr_repository_policy" "cross_account" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCrossAccountPull"
        Effect = "Allow"
        Principal = {
          AWS = [
            "arn:aws:iam::\${var.production_account_id}:root",
            "arn:aws:iam::\${var.staging_account_id}:root"
          ]
        }
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability"
        ]
      }
    ]
  })
}

# ============================
# ECR レプリケーション（別リージョン）
# ============================
resource "aws_ecr_replication_configuration" "replication" {
  replication_configuration {
    rule {
      destination {
        region      = "us-west-2"
        registry_id = data.aws_caller_identity.current.account_id
      }

      repository_filter {
        filter      = "\${var.project}-"
        filter_type = "PREFIX_MATCH"
      }
    }

    rule {
      destination {
        region      = "ap-northeast-1"
        registry_id = var.production_account_id
      }

      repository_filter {
        filter      = "\${var.project}-"
        filter_type = "PREFIX_MATCH"
      }
    }
  }
}

variable "production_account_id" {
  description = "本番環境のAWSアカウントID"
  type        = string
}

variable "staging_account_id" {
  description = "ステージング環境のAWSアカウントID"
  type        = string
}

data "aws_caller_identity" "current" {}`,
    tips: [
      "クロスアカウントでは Pull 権限のみを付与（Push は開発アカウント限定）",
      "レプリケーションで別リージョン・別アカウントに自動コピー",
      "PREFIX_MATCH でプロジェクト単位のフィルタリングが可能",
    ],
    warnings: [
      "クロスアカウントの Push 権限は極力避ける（イメージ改ざん防止）",
    ],
  },
  {
    title: "ECR プルスルーキャッシュ",
    description:
      "Docker Hub や GitHub Container Registry のパブリックイメージを ECR 経由でキャッシュし、レート制限を回避します。",
    code: `# ============================
# プルスルーキャッシュルール
# ============================
resource "aws_ecr_pull_through_cache_rule" "dockerhub" {
  ecr_repository_prefix = "dockerhub"
  upstream_registry_url = "registry-1.docker.io"

  credential_arn = aws_secretsmanager_secret.dockerhub_creds.arn
}

resource "aws_ecr_pull_through_cache_rule" "ghcr" {
  ecr_repository_prefix = "ghcr"
  upstream_registry_url = "ghcr.io"
}

resource "aws_ecr_pull_through_cache_rule" "ecr_public" {
  ecr_repository_prefix = "ecr-public"
  upstream_registry_url = "public.ecr.aws"
}

# Docker Hub 認証情報
resource "aws_secretsmanager_secret" "dockerhub_creds" {
  name = "\${var.project}-dockerhub-credentials"

  tags = {
    Name = "\${var.project}-dockerhub-creds"
  }
}

# 使用例:
# docker pull <account_id>.dkr.ecr.<region>.amazonaws.com/dockerhub/nginx:latest
# docker pull <account_id>.dkr.ecr.<region>.amazonaws.com/ghcr/actions/runner:latest`,
    tips: [
      "Docker Hub のレート制限（匿名: 100pulls/6h）を回避可能",
      "初回 Pull 時に自動的に ECR にキャッシュされる",
      "ECSタスク定義のイメージURLをECRプレフィックス付きに変更するだけ",
    ],
  },
];

// ─── S3 構築 ───
const s3Sections: Section[] = [
  {
    title: "S3 バケット（基本構成）",
    description:
      "暗号化、バージョニング、ライフサイクル管理を含む本番グレードのS3バケット設定です。",
    code: `# ============================
# S3 バケット
# ============================
resource "aws_s3_bucket" "app_data" {
  bucket = "\${var.project}-\${var.environment}-data"

  tags = {
    Name        = "\${var.project}-data"
    Environment = var.environment
  }
}

# バージョニング有効化
resource "aws_s3_bucket_versioning" "app_data" {
  bucket = aws_s3_bucket.app_data.id

  versioning_configuration {
    status = "Enabled"
  }
}

# サーバーサイド暗号化（SSE-S3）
resource "aws_s3_bucket_server_side_encryption_configuration" "app_data" {
  bucket = aws_s3_bucket.app_data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
    bucket_key_enabled = true
  }
}

# パブリックアクセスブロック
resource "aws_s3_bucket_public_access_block" "app_data" {
  bucket = aws_s3_bucket.app_data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ライフサイクルルール
resource "aws_s3_bucket_lifecycle_configuration" "app_data" {
  bucket = aws_s3_bucket.app_data.id

  rule {
    id     = "archive-old-objects"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 180
      storage_class = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  rule {
    id     = "cleanup-incomplete-uploads"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# S3 用 KMS キー
resource "aws_kms_key" "s3" {
  description             = "S3暗号化用KMSキー"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name = "\${var.project}-s3-kms"
  }
}`,
    tips: [
      "bucket_key_enabled = true で KMS API コール数を削減しコスト最適化",
      "ライフサイクルで自動アーカイブ: 90日→Standard-IA、180日→Glacier",
      "パブリックアクセスは必ず全ブロック",
      "バージョニングで誤削除からの復旧が可能",
    ],
  },
  {
    title: "S3 バケットポリシーとCORS",
    description:
      "VPC内からのみアクセスを許可するバケットポリシーと、Webアプリ向けCORS設定です。",
    code: `# ============================
# VPC エンドポイント経由のみ許可
# ============================
resource "aws_s3_bucket_policy" "vpc_only" {
  bucket = aws_s3_bucket.app_data.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyNonVPCAccess"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.app_data.arn,
          "\${aws_s3_bucket.app_data.arn}/*"
        ]
        Condition = {
          StringNotEquals = {
            "aws:sourceVpce" = aws_vpc_endpoint.s3.id
          }
        }
      }
    ]
  })
}

# S3 VPCエンドポイント（Gateway型）
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = var.vpc_id
  service_name = "com.amazonaws.\${var.region}.s3"

  route_table_ids = var.private_route_table_ids

  tags = {
    Name = "\${var.project}-s3-endpoint"
  }
}

# ============================
# CORS設定（Webアプリ連携用）
# ============================
resource "aws_s3_bucket_cors_configuration" "app_data" {
  bucket = aws_s3_bucket.app_data.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = [
      "https://\${var.domain_name}",
      "https://app.\${var.domain_name}"
    ]
    expose_headers  = ["ETag", "x-amz-request-id"]
    max_age_seconds = 3600
  }
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "region" {
  description = "AWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "private_route_table_ids" {
  description = "プライベートサブネットのルートテーブルID"
  type        = list(string)
}

variable "domain_name" {
  description = "ドメイン名"
  type        = string
}`,
    tips: [
      "VPCエンドポイント経由のみ許可でセキュリティ強化",
      "S3 Gateway エンドポイントは無料で利用可能",
      "CORS は必要最小限のオリジンのみ許可",
    ],
    warnings: [
      "DenyNonVPCAccess ポリシーを設定するとコンソールからのアクセスも制限される",
    ],
  },
];

// ─── DynamoDB 構築 ───
const dynamodbSections: Section[] = [
  {
    title: "DynamoDB テーブル（基本構成）",
    description:
      "オンデマンドキャパシティ、暗号化、ポイントインタイムリカバリを含む本番向けDynamoDBテーブルです。",
    code: `# ============================
# DynamoDB テーブル
# ============================
resource "aws_dynamodb_table" "app" {
  name         = "\${var.project}-\${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  # グローバルセカンダリインデックス
  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  # ポイントインタイムリカバリ
  point_in_time_recovery {
    enabled = true
  }

  # サーバーサイド暗号化
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }

  # TTL設定
  ttl {
    attribute_name = "ExpiresAt"
    enabled        = true
  }

  # テーブルクラス（コスト最適化）
  table_class = "STANDARD"

  tags = {
    Name        = "\${var.project}-table"
    Environment = var.environment
  }
}

# DynamoDB 用 KMS キー
resource "aws_kms_key" "dynamodb" {
  description             = "DynamoDB暗号化用KMSキー"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name = "\${var.project}-dynamodb-kms"
  }
}`,
    tips: [
      "PAY_PER_REQUEST（オンデマンド）で初期はコスト効率が良い",
      "Single Table Design: PK/SK + GSI でアクセスパターンを最適化",
      "point_in_time_recovery で過去35日間の任意の時点に復元可能",
      "TTL で期限切れデータを自動削除（追加料金なし）",
    ],
  },
  {
    title: "DynamoDB オートスケーリング（プロビジョンドモード）",
    description:
      "トラフィックに応じて自動的にキャパシティをスケールする設定です。予測可能なワークロードではプロビジョンドモードの方がコスト効率が良い場合があります。",
    code: `# ============================
# プロビジョンドモードのDynamoDBテーブル
# ============================
resource "aws_dynamodb_table" "app_provisioned" {
  name           = "\${var.project}-\${var.environment}-provisioned"
  billing_mode   = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5
  hash_key       = "PK"
  range_key      = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "\${var.project}-provisioned"
  }
}

# ============================
# オートスケーリング（読み取り）
# ============================
resource "aws_appautoscaling_target" "read" {
  max_capacity       = 100
  min_capacity       = 5
  resource_id        = "table/\${aws_dynamodb_table.app_provisioned.name}"
  scalable_dimension = "dynamodb:table:ReadCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "read" {
  name               = "\${var.project}-read-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.read.resource_id
  scalable_dimension = aws_appautoscaling_target.read.scalable_dimension
  service_namespace  = aws_appautoscaling_target.read.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBReadCapacityUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 60
    scale_out_cooldown = 60
  }
}

# ============================
# オートスケーリング（書き込み）
# ============================
resource "aws_appautoscaling_target" "write" {
  max_capacity       = 100
  min_capacity       = 5
  resource_id        = "table/\${aws_dynamodb_table.app_provisioned.name}"
  scalable_dimension = "dynamodb:table:WriteCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "write" {
  name               = "\${var.project}-write-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.write.resource_id
  scalable_dimension = aws_appautoscaling_target.write.scalable_dimension
  service_namespace  = aws_appautoscaling_target.write.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBWriteCapacityUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 60
    scale_out_cooldown = 60
  }
}`,
    tips: [
      "ターゲット使用率 70% でスケールアウトが安定的",
      "scale_in_cooldown / scale_out_cooldown でスケーリングの頻度を制御",
      "安定したトラフィックならプロビジョンドモードが最大75%安価",
    ],
  },
  {
    title: "DynamoDB VPCエンドポイント",
    description:
      "プライベートサブネットからDynamoDBにインターネットを経由せずアクセスする設定です。",
    code: `# ============================
# DynamoDB VPCエンドポイント（Gateway型）
# ============================
resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id       = var.vpc_id
  service_name = "com.amazonaws.\${var.region}.dynamodb"

  route_table_ids = var.private_route_table_ids

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowDynamoDBAccess"
        Effect    = "Allow"
        Principal = "*"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          aws_dynamodb_table.app.arn,
          "\${aws_dynamodb_table.app.arn}/index/*"
        ]
      }
    ]
  })

  tags = {
    Name = "\${var.project}-dynamodb-endpoint"
  }
}`,
    tips: [
      "DynamoDB Gateway エンドポイントも無料",
      "エンドポイントポリシーで対象テーブルとアクションを制限可能",
      "NAT Gateway経由より低レイテンシー",
    ],
  },
];

// ─── ECS + S3 連携 ───
const ecsS3Sections: Section[] = [
  {
    title: "ECS タスクから S3 へアクセス",
    description:
      "ECSタスクのIAMロールにS3アクセス権限を付与し、VPCエンドポイント経由で安全にアクセスする構成です。",
    code: `# ============================
# ECS タスクロール（S3アクセス用）
# ============================
resource "aws_iam_role" "ecs_task" {
  name = "\${var.project}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "\${var.project}-ecs-task-role"
  }
}

# S3 アクセスポリシー（最小権限）
resource "aws_iam_role_policy" "ecs_s3" {
  name = "\${var.project}-ecs-s3-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3ReadWrite"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.app_data.arn,
          "\${aws_s3_bucket.app_data.arn}/*"
        ]
      },
      {
        Sid    = "KMSDecrypt"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [aws_kms_key.s3.arn]
      }
    ]
  })
}

# ============================
# ECS タスク定義（S3連携）
# ============================
resource "aws_ecs_task_definition" "app_with_s3" {
  family                   = "\${var.project}-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "app"
      image = "\${aws_ecr_repository.app.repository_url}:latest"
      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]
      environment = [
        {
          name  = "S3_BUCKET"
          value = aws_s3_bucket.app_data.id
        },
        {
          name  = "AWS_REGION"
          value = var.region
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/\${var.project}"
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "app"
        }
      }
    }
  ])
}`,
    tips: [
      "task_role_arn（タスクロール）でS3アクセス権限を付与",
      "execution_role_arn（実行ロール）はECRプル・CloudWatch Logs用",
      "環境変数でバケット名を渡し、ハードコーディングを回避",
      "KMS復号権限も必要（暗号化バケットの場合）",
    ],
    warnings: [
      "execution_role と task_role を混同しないこと。S3アクセスは task_role に設定",
    ],
  },
  {
    title: "ECS + S3 でファイルアップロード（Pre-signed URL）",
    description:
      "ECSアプリケーションがPre-signed URLを生成し、クライアントから直接S3にアップロードする構成です。サーバー負荷を軽減できます。",
    code: `# ============================
# アップロード専用S3バケット
# ============================
resource "aws_s3_bucket" "uploads" {
  bucket = "\${var.project}-\${var.environment}-uploads"

  tags = {
    Name = "\${var.project}-uploads"
  }
}

resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["https://\${var.domain_name}"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# アップロード用ポリシー（タスクロールに追加）
resource "aws_iam_role_policy" "ecs_upload" {
  name = "\${var.project}-ecs-upload-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "GeneratePresignedURL"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource = "\${aws_s3_bucket.uploads.arn}/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "private"
          }
        }
      }
    ]
  })
}

# S3イベント通知 → SQS（後処理用）
resource "aws_s3_bucket_notification" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  queue {
    queue_arn     = aws_sqs_queue.upload_processor.arn
    events        = ["s3:ObjectCreated:*"]
    filter_prefix = "uploads/"
  }
}

resource "aws_sqs_queue" "upload_processor" {
  name                       = "\${var.project}-upload-processor"
  visibility_timeout_seconds = 300
  message_retention_seconds  = 86400

  tags = {
    Name = "\${var.project}-upload-queue"
  }
}`,
    tips: [
      "Pre-signed URL でサーバーを経由せず直接S3にアップロード",
      "S3イベント通知 + SQS で非同期の後処理パイプラインを構築",
      "CORS設定でフロントエンドからの直接アクセスを許可",
    ],
  },
];

// ─── ECS + DynamoDB 連携 ───
const ecsDynamodbSections: Section[] = [
  {
    title: "ECS タスクから DynamoDB へアクセス",
    description:
      "ECSタスクのIAMロールにDynamoDBの最小権限を付与し、環境変数でテーブル名を渡す構成です。",
    code: `# ============================
# ECS タスクロール（DynamoDB アクセス用）
# ============================
resource "aws_iam_role_policy" "ecs_dynamodb" {
  name = "\${var.project}-ecs-dynamodb-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBReadWrite"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          aws_dynamodb_table.app.arn,
          "\${aws_dynamodb_table.app.arn}/index/*"
        ]
      },
      {
        Sid    = "KMSAccess"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [aws_kms_key.dynamodb.arn]
      }
    ]
  })
}

# ============================
# ECS タスク定義（DynamoDB連携）
# ============================
resource "aws_ecs_task_definition" "app_with_dynamodb" {
  family                   = "\${var.project}-app-dynamo"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "app"
      image = "\${aws_ecr_repository.app.repository_url}:latest"
      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]
      environment = [
        {
          name  = "DYNAMODB_TABLE"
          value = aws_dynamodb_table.app.name
        },
        {
          name  = "AWS_REGION"
          value = var.region
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/\${var.project}"
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "app"
        }
      }
    }
  ])
}`,
    tips: [
      "Scan 権限は意図的に除外（大量読み取りによるコスト増を防止）",
      "GSIのアクセスには /index/* の Resource 指定が必要",
      "環境変数でテーブル名を渡し、環境ごとの切り替えを容易に",
    ],
    warnings: [
      "dynamodb:Scan は本番では極力避ける（テーブル全体を読むためコスト大）",
    ],
  },
  {
    title: "DAX（DynamoDB Accelerator）キャッシュ",
    description:
      "読み取りが多いワークロードにDAXを追加し、マイクロ秒単位のレイテンシーを実現します。",
    code: `# ============================
# DAX クラスター
# ============================
resource "aws_dax_cluster" "app" {
  cluster_name       = "\${var.project}-dax"
  iam_role_arn       = aws_iam_role.dax.arn
  node_type          = "dax.t3.small"
  replication_factor = 2

  subnet_group_name  = aws_dax_subnet_group.app.name
  security_group_ids = [aws_security_group.dax.id]

  server_side_encryption {
    enabled = true
  }

  parameter_group_name = aws_dax_parameter_group.app.name

  tags = {
    Name        = "\${var.project}-dax"
    Environment = var.environment
  }
}

resource "aws_dax_subnet_group" "app" {
  name       = "\${var.project}-dax-subnet"
  subnet_ids = var.private_subnet_ids
}

resource "aws_dax_parameter_group" "app" {
  name = "\${var.project}-dax-params"

  parameters {
    name  = "query-ttl-millis"
    value = "300000"
  }

  parameters {
    name  = "record-ttl-millis"
    value = "180000"
  }
}

resource "aws_security_group" "dax" {
  name_prefix = "\${var.project}-dax-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 8111
    to_port         = 8111
    protocol        = "tcp"
    security_groups = [var.ecs_security_group_id]
  }

  tags = {
    Name = "\${var.project}-dax-sg"
  }
}

# DAX IAM ロール
resource "aws_iam_role" "dax" {
  name = "\${var.project}-dax-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "dax.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "dax" {
  name = "\${var.project}-dax-dynamodb"
  role = aws_iam_role.dax.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:BatchGetItem"
        ]
        Resource = [
          aws_dynamodb_table.app.arn,
          "\${aws_dynamodb_table.app.arn}/index/*"
        ]
      }
    ]
  })
}`,
    tips: [
      "読み取りが書き込みの10倍以上のワークロードに最適",
      "DAXはVPC内に配置されるためセキュリティグループで制御",
      "record-ttl: 個別アイテムのキャッシュ時間、query-ttl: クエリ結果のキャッシュ時間",
    ],
  },
];

// ─── Lambda + S3 連携 ───
const lambdaS3Sections: Section[] = [
  {
    title: "Lambda + S3 イベント駆動",
    description:
      "S3へのファイルアップロードをトリガーにLambdaを起動する構成です。画像リサイズやファイル処理に適しています。",
    code: `# ============================
# Lambda 関数（S3 イベント駆動）
# ============================
resource "aws_lambda_function" "s3_processor" {
  function_name = "\${var.project}-s3-processor"
  role          = aws_iam_role.lambda_s3.arn
  package_type  = "Image"
  image_uri     = "\${aws_ecr_repository.lambda.repository_url}:latest"
  timeout       = 300
  memory_size   = 1024

  environment {
    variables = {
      OUTPUT_BUCKET  = aws_s3_bucket.processed.id
      DYNAMODB_TABLE = aws_dynamodb_table.app.name
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  dead_letter_config {
    target_arn = aws_sqs_queue.dlq.arn
  }

  tags = {
    Name = "\${var.project}-s3-processor"
  }
}

# S3 トリガー
resource "aws_lambda_permission" "s3" {
  statement_id  = "AllowS3Invocation"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.s3_processor.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.uploads.arn
}

resource "aws_s3_bucket_notification" "lambda_trigger" {
  bucket = aws_s3_bucket.uploads.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.s3_processor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "uploads/"
    filter_suffix       = ".jpg"
  }

  lambda_function {
    lambda_function_arn = aws_lambda_function.s3_processor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "uploads/"
    filter_suffix       = ".png"
  }
}

# Lambda IAM ロール
resource "aws_iam_role" "lambda_s3" {
  name = "\${var.project}-lambda-s3-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_s3_access" {
  name = "\${var.project}-lambda-s3-access"
  role = aws_iam_role.lambda_s3.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadSourceBucket"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:HeadObject"
        ]
        Resource = "\${aws_s3_bucket.uploads.arn}/*"
      },
      {
        Sid    = "WriteOutputBucket"
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = "\${aws_s3_bucket.processed.arn}/*"
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# 処理済みファイル用バケット
resource "aws_s3_bucket" "processed" {
  bucket = "\${var.project}-\${var.environment}-processed"

  tags = {
    Name = "\${var.project}-processed"
  }
}

# デッドレターキュー
resource "aws_sqs_queue" "dlq" {
  name                      = "\${var.project}-s3-processor-dlq"
  message_retention_seconds = 1209600

  tags = {
    Name = "\${var.project}-dlq"
  }
}`,
    tips: [
      "filter_prefix/filter_suffix で処理対象ファイルを限定",
      "dead_letter_config で処理失敗したイベントを保存",
      "入力バケット（Read）と出力バケット（Write）を分離するのがベストプラクティス",
      "VPC Lambda の場合は NAT Gateway 又は VPC エンドポイントが必要",
    ],
  },
];

// ─── Lambda + DynamoDB 連携 ───
const lambdaDynamodbSections: Section[] = [
  {
    title: "Lambda + DynamoDB Streams",
    description:
      "DynamoDBテーブルの変更をリアルタイムで検知し、Lambdaで後続処理を実行するイベントソースマッピング構成です。",
    code: `# ============================
# DynamoDB Streams 有効化
# ============================
resource "aws_dynamodb_table" "app_with_streams" {
  name             = "\${var.project}-\${var.environment}-streamed"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "PK"
  range_key        = "SK"
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "\${var.project}-streamed"
  }
}

# ============================
# Lambda（DynamoDB Streams ハンドラー）
# ============================
resource "aws_lambda_function" "stream_processor" {
  function_name = "\${var.project}-stream-processor"
  role          = aws_iam_role.lambda_streams.arn
  package_type  = "Image"
  image_uri     = "\${aws_ecr_repository.lambda.repository_url}:stream-handler"
  timeout       = 60
  memory_size   = 512

  environment {
    variables = {
      SNS_TOPIC_ARN = aws_sns_topic.notifications.arn
      ENVIRONMENT   = var.environment
    }
  }

  tags = {
    Name = "\${var.project}-stream-processor"
  }
}

# DynamoDB Streams → Lambda マッピング
resource "aws_lambda_event_source_mapping" "dynamodb_stream" {
  event_source_arn  = aws_dynamodb_table.app_with_streams.stream_arn
  function_name     = aws_lambda_function.stream_processor.arn
  starting_position = "LATEST"
  batch_size        = 10

  maximum_batching_window_in_seconds = 5
  maximum_retry_attempts             = 3
  bisect_batch_on_function_error     = true
  parallelization_factor             = 2

  destination_config {
    on_failure {
      destination_arn = aws_sqs_queue.stream_dlq.arn
    }
  }

  filter_criteria {
    filter {
      pattern = jsonencode({
        eventName = ["INSERT", "MODIFY"]
        dynamodb = {
          NewImage = {
            entityType = {
              S = ["ORDER", "PAYMENT"]
            }
          }
        }
      })
    }
  }
}

# Lambda IAM ロール
resource "aws_iam_role" "lambda_streams" {
  name = "\${var.project}-lambda-streams-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_streams_access" {
  name = "\${var.project}-lambda-streams-access"
  role = aws_iam_role.lambda_streams.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:DescribeStream",
          "dynamodb:ListStreams"
        ]
        Resource = aws_dynamodb_table.app_with_streams.stream_arn
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.notifications.arn
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage"
        ]
        Resource = aws_sqs_queue.stream_dlq.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_sns_topic" "notifications" {
  name = "\${var.project}-notifications"

  tags = {
    Name = "\${var.project}-notifications"
  }
}

resource "aws_sqs_queue" "stream_dlq" {
  name                      = "\${var.project}-stream-dlq"
  message_retention_seconds = 1209600

  tags = {
    Name = "\${var.project}-stream-dlq"
  }
}`,
    tips: [
      "stream_view_type = NEW_AND_OLD_IMAGES で変更前後の両方を取得",
      "filter_criteria でイベントをフィルタし、不要な起動を削減",
      "bisect_batch_on_function_error でエラー時にバッチを半分に分割して再試行",
      "parallelization_factor でシャードごとの並列処理数を調整",
    ],
    warnings: [
      "DynamoDB Streams の保持期間は24時間。処理が遅延すると消失する",
    ],
  },
];

// ─── セキュリティベストプラクティス ───
const securitySections: Section[] = [
  {
    title: "統合セキュリティ設計",
    description:
      "ECR・S3・DynamoDB全体を通じたセキュリティのベストプラクティスです。最小権限、暗号化、監査ログを一元管理します。",
    code: `# ============================
# 統合 KMS キーポリシー
# ============================
resource "aws_kms_key" "master" {
  description             = "統合暗号化マスターキー"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  multi_region            = false

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "KeyAdminAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::\${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowServiceAccess"
        Effect = "Allow"
        Principal = {
          AWS = [
            aws_iam_role.ecs_task.arn,
            aws_iam_role.lambda_s3.arn,
            aws_iam_role.lambda_streams.arn
          ]
        }
        Action = [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name = "\${var.project}-master-key"
  }
}

resource "aws_kms_alias" "master" {
  name          = "alias/\${var.project}-master"
  target_key_id = aws_kms_key.master.key_id
}

# ============================
# CloudTrail（API監査ログ）
# ============================
resource "aws_cloudtrail" "audit" {
  name                       = "\${var.project}-audit-trail"
  s3_bucket_name             = aws_s3_bucket.audit_logs.id
  include_global_service_events = true
  is_multi_region_trail      = true
  enable_log_file_validation = true

  event_selector {
    read_write_type           = "All"
    include_management_events = true

    data_resource {
      type   = "AWS::S3::Object"
      values = ["\${aws_s3_bucket.app_data.arn}/"]
    }

    data_resource {
      type   = "AWS::DynamoDB::Table"
      values = [aws_dynamodb_table.app.arn]
    }
  }

  tags = {
    Name = "\${var.project}-audit"
  }
}

resource "aws_s3_bucket" "audit_logs" {
  bucket = "\${var.project}-\${var.environment}-audit-logs"

  tags = {
    Name = "\${var.project}-audit-logs"
  }
}

resource "aws_s3_bucket_policy" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudTrailWrite"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "\${aws_s3_bucket.audit_logs.arn}/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      },
      {
        Sid    = "AllowCloudTrailCheck"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.audit_logs.arn
      }
    ]
  })
}`,
    tips: [
      "KMSキーローテーションを有効化して暗号鍵を自動更新",
      "CloudTrailでS3/DynamoDBのデータイベントを監査",
      "enable_log_file_validation でログ改ざんを検知",
      "マスターキーを一元化してキー管理を簡素化",
    ],
  },
  {
    title: "IAM 境界ポリシー（Permission Boundary）",
    description:
      "開発者が作成するIAMロールの最大権限を制限し、意図しない権限昇格を防止します。",
    code: `# ============================
# Permission Boundary
# ============================
resource "aws_iam_policy" "boundary" {
  name = "\${var.project}-permission-boundary"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowedServices"
        Effect = "Allow"
        Action = [
          "s3:*",
          "dynamodb:*",
          "ecr:*",
          "ecs:*",
          "lambda:*",
          "logs:*",
          "sqs:*",
          "sns:*",
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "DenyDangerousActions"
        Effect = "Deny"
        Action = [
          "iam:CreateUser",
          "iam:CreateAccessKey",
          "iam:AttachUserPolicy",
          "organizations:*",
          "account:*"
        ]
        Resource = "*"
      },
      {
        Sid      = "RestrictToRegion"
        Effect   = "Deny"
        Action   = "*"
        Resource = "*"
        Condition = {
          StringNotEquals = {
            "aws:RequestedRegion" = [var.region, "us-east-1"]
          }
        }
      }
    ]
  })

  tags = {
    Name = "\${var.project}-boundary"
  }
}

# タスクロールにPermission Boundaryを適用
resource "aws_iam_role" "ecs_task_bounded" {
  name                 = "\${var.project}-ecs-task-bounded"
  permissions_boundary = aws_iam_policy.boundary.arn

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "\${var.project}-ecs-task-bounded"
  }
}`,
    tips: [
      "Permission Boundary で「最大限何ができるか」を制限",
      "リージョン制限でコスト暴走や未承認リージョンでの展開を防止",
      "IAMユーザー作成・アクセスキー作成を明示的に拒否",
    ],
  },
];

// ─── 監視・運用 ───
const monitoringSections: Section[] = [
  {
    title: "CloudWatch ダッシュボード＆アラーム",
    description:
      "ECR・S3・DynamoDB・ECS・Lambdaの主要メトリクスを統合監視するダッシュボードとアラームです。",
    code: `# ============================
# 統合 CloudWatch ダッシュボード
# ============================
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "\${var.project}-\${var.environment}"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "ECS CPU & Memory"
          region = var.region
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ServiceName", "\${var.project}-service", "ClusterName", "\${var.project}-cluster"],
            ["AWS/ECS", "MemoryUtilization", "ServiceName", "\${var.project}-service", "ClusterName", "\${var.project}-cluster"]
          ]
          period = 300
          stat   = "Average"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "DynamoDB Read/Write"
          region = var.region
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.app.name],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", aws_dynamodb_table.app.name]
          ]
          period = 300
          stat   = "Sum"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "Lambda Errors & Duration"
          region = var.region
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", "\${var.project}-s3-processor"],
            ["AWS/Lambda", "Duration", "FunctionName", "\${var.project}-s3-processor"]
          ]
          period = 300
          stat   = "Sum"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "S3 Requests"
          region = var.region
          metrics = [
            ["AWS/S3", "NumberOfObjects", "BucketName", aws_s3_bucket.app_data.id, "StorageType", "AllStorageTypes"],
            ["AWS/S3", "BucketSizeBytes", "BucketName", aws_s3_bucket.app_data.id, "StorageType", "StandardStorage"]
          ]
          period = 86400
          stat   = "Average"
        }
      }
    ]
  })
}

# ============================
# アラーム: DynamoDB スロットリング
# ============================
resource "aws_cloudwatch_metric_alarm" "dynamodb_throttle" {
  alarm_name          = "\${var.project}-dynamodb-throttle"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "DynamoDB throttling detected"

  dimensions = {
    TableName = aws_dynamodb_table.app.name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Name = "\${var.project}-dynamodb-throttle"
  }
}

# ============================
# アラーム: Lambda エラー率
# ============================
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "\${var.project}-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Lambda error rate is high"

  dimensions = {
    FunctionName = "\${var.project}-s3-processor"
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Name = "\${var.project}-lambda-errors"
  }
}

# ============================
# アラーム: S3 4xx エラー
# ============================
resource "aws_cloudwatch_metric_alarm" "s3_errors" {
  alarm_name          = "\${var.project}-s3-4xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "4xxErrors"
  namespace           = "AWS/S3"
  period              = 300
  statistic           = "Sum"
  threshold           = 100
  alarm_description   = "S3 client error rate is high"

  dimensions = {
    BucketName = aws_s3_bucket.app_data.id
    FilterId   = "AllRequests"
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Name = "\${var.project}-s3-errors"
  }
}

resource "aws_sns_topic" "alerts" {
  name = "\${var.project}-alerts"

  tags = {
    Name = "\${var.project}-alerts"
  }
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

variable "alert_email" {
  description = "アラート通知先メールアドレス"
  type        = string
}`,
    tips: [
      "DynamoDBスロットリングは容量不足の重要サイン",
      "Lambda エラーアラームで処理失敗を早期検知",
      "S3 4xxエラーはアクセス設定ミスの可能性を示す",
      "SNS → Email でチームにアラート通知",
    ],
  },
];

// ─── タブとセクションのマッピング ───
function getSectionsForTab(tab: Tab): Section[] {
  const mapping: Record<Tab, Section[]> = {
    overview: [],
    "ecr-best": ecrBestSections,
    s3: s3Sections,
    dynamodb: dynamodbSections,
    "ecs-s3": ecsS3Sections,
    "ecs-dynamodb": ecsDynamodbSections,
    "lambda-s3": lambdaS3Sections,
    "lambda-dynamodb": lambdaDynamodbSections,
    security: securitySections,
    monitoring: monitoringSections,
  };
  return mapping[tab];
}

// ─── アーキテクチャ図 ───
function OverviewTab() {
  const patterns = [
    {
      title: "ECR + ECS + S3 連携パターン",
      description: "ECSタスクがS3にファイルを読み書きする基本構成",
      flow: ["ECR", "→ ECS Fargate", "→ S3 Bucket"],
      color: "bg-green-100 text-green-800",
    },
    {
      title: "ECR + ECS + DynamoDB 連携パターン",
      description: "ECSタスクがDynamoDBにデータを読み書きする構成",
      flow: ["ECR", "→ ECS Fargate", "→ DynamoDB"],
      color: "bg-blue-100 text-blue-800",
    },
    {
      title: "ECR + Lambda + S3 イベント駆動パターン",
      description: "S3アップロードをトリガーにLambdaで処理する構成",
      flow: ["S3 Upload", "→ Lambda", "→ S3 Output"],
      color: "bg-amber-100 text-amber-800",
    },
    {
      title: "ECR + Lambda + DynamoDB Streams パターン",
      description: "DynamoDB変更をLambdaでリアルタイム処理する構成",
      flow: ["DynamoDB", "→ Streams", "→ Lambda", "→ SNS"],
      color: "bg-purple-100 text-purple-800",
    },
    {
      title: "フルスタック統合パターン",
      description: "全サービスを組み合わせた本番向け構成",
      flow: ["ALB", "→ ECS", "→ S3 + DynamoDB + Lambda"],
      color: "bg-rose-100 text-rose-800",
    },
  ];

  const bestPractices = [
    { icon: Lock, text: "最小権限の IAM ポリシー設計", color: "text-red-600" },
    { icon: Shield, text: "KMS 暗号化の一元管理", color: "text-blue-600" },
    { icon: RefreshCw, text: "VPC エンドポイントでプライベート通信", color: "text-green-600" },
    { icon: Eye, text: "CloudWatch + CloudTrail で統合監視", color: "text-purple-600" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-[16px] font-medium mb-4">連携パターン一覧</h3>
        <div className="grid grid-cols-1 gap-4">
          {patterns.map((p) => (
            <div key={p.title} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div>
                  <h4 className="text-[14px] font-medium mb-1">{p.title}</h4>
                  <p className="text-[13px] text-muted-foreground mb-3">{p.description}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.flow.map((step, i) => (
                      <span key={i} className={`text-[12px] px-2.5 py-1 rounded-full ${step.startsWith("→") ? "text-muted-foreground" : p.color}`}>
                        {step}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-[16px] font-medium mb-4">共通ベストプラクティス</h3>
        <div className="grid grid-cols-2 gap-3">
          {bestPractices.map((bp) => (
            <div key={bp.text} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
              <bp.icon className={`w-5 h-5 ${bp.color} shrink-0`} />
              <span className="text-[13px]">{bp.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── セクションリスト ───
function SectionList({ sections }: { sections: Section[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-4">
      {sections.map((section, index) => {
        const isOpen = openIndex === index;

        return (
          <div key={index} className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="w-full flex items-center justify-between p-5 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center text-[13px]">
                  {index + 1}
                </div>
                <div>
                  <h4 className="text-[14px] font-medium">{section.title}</h4>
                  <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-1">
                    {section.description}
                  </p>
                </div>
              </div>
              {isOpen ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
              )}
            </button>

            {isOpen && (
              <div className="px-5 pb-5 space-y-4">
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  {section.description}
                </p>

                <div>
                  <pre className="bg-zinc-950 text-zinc-100 rounded-lg p-4 overflow-x-auto text-[12px] leading-relaxed">
                    <code>{section.code}</code>
                  </pre>
                  <div className="mt-2">
                    <DownloadCodeButton
                      code={section.code}
                      filename={`${section.title.replace(/[^a-zA-Z0-9\u3040-\u9FFF]/g, "_")}.tf`}
                    />
                  </div>
                </div>

                {section.tips && section.tips.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-[12px] font-medium text-emerald-700">ベストプラクティス</span>
                    </div>
                    <ul className="space-y-1.5">
                      {section.tips.map((tip, i) => (
                        <li key={i} className="text-[12px] text-emerald-700 flex items-start gap-2">
                          <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {section.warnings && section.warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="text-[12px] font-medium text-amber-700">注意点</span>
                    </div>
                    <ul className="space-y-1.5">
                      {section.warnings.map((w, i) => (
                        <li key={i} className="text-[12px] text-amber-700 flex items-start gap-2">
                          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                          {w}
                        </li>
                      ))}
                    </ul>
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

// ─── メインコンポーネント ───
export function AwsIntegration() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const sections = getSectionsForTab(activeTab);

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-[24px] font-bold mb-2">AWS連携ベストプラクティス</h1>
          <p className="text-[14px] text-muted-foreground">
            ECR・S3・DynamoDB を安全かつ効率的に連携させるためのTerraform設計パターン集
          </p>
        </div>

        {/* タブ */}
        <div className="flex flex-wrap gap-2 mb-8">
          {tabItems.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] transition-colors ${
                activeTab === tab.id
                  ? `${tab.color} text-white`
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* コンテンツ */}
        {activeTab === "overview" ? <OverviewTab /> : <SectionList sections={sections} />}
      </div>
    </main>
  );
}
