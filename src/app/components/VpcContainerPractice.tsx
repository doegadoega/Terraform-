import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Network,
  Container,
  Package,
  Zap,
  Globe,
  Shield,
  Server,
  Layers,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Lock,
  Monitor,
  RefreshCw,
  Import,
  Settings,
} from "lucide-react";
import { DownloadCodeButton } from "./DownloadCodeButton";

type Tab =
  | "overview"
  | "vpc"
  | "ecr"
  | "ecs"
  | "lambda-container"
  | "web-app"
  | "fullstack"
  | "operations";

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
  { id: "vpc", label: "VPC構築", icon: Network, color: "bg-blue-600" },
  { id: "ecr", label: "ECR (レジストリ)", icon: Package, color: "bg-orange-500" },
  { id: "ecs", label: "ECS構築", icon: Container, color: "bg-cyan-600" },
  {
    id: "lambda-container",
    label: "Lambda コンテナ",
    icon: Zap,
    color: "bg-amber-600",
  },
  { id: "web-app", label: "Webアプリ配置", icon: Globe, color: "bg-green-600" },
  {
    id: "fullstack",
    label: "統合構成",
    icon: Server,
    color: "bg-rose-600",
  },
  {
    id: "operations",
    label: "運用テクニック",
    icon: Settings,
    color: "bg-violet-600",
  },
];

const vpcSections: Section[] = [
  {
    title: "Step 1: VPCの作成",
    description:
      "コンテナを配置するための仮想ネットワーク（VPC）を構築します。CIDRブロックでIPアドレス範囲を定義し、DNS設定を有効化します。",
    code: `# ============================
# VPC の作成
# ============================
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name        = "\${var.project}-vpc"
    Environment = var.environment
  }
}

# 変数定義
variable "project" {
  description = "プロジェクト名"
  type        = string
  default     = "my-app"
}

variable "environment" {
  description = "環境名（dev / staging / prod）"
  type        = string
  default     = "dev"
}

variable "azs" {
  description = "使用するアベイラビリティゾーン"
  type        = list(string)
  default     = ["ap-northeast-1a", "ap-northeast-1c"]
}`,
    tips: [
      "enable_dns_hostnames = true はECSタスク間の通信に必要",
      "CIDRは /16 で十分な範囲を確保（65,536 IPアドレス）",
      "AZを2つ以上使うことで高可用性を実現",
    ],
  },
  {
    title: "Step 2: サブネットの作成（パブリック＋プライベート）",
    description:
      "パブリックサブネット（ALB用）とプライベートサブネット（ECSタスク用）を各AZに作成します。",
    code: `# ============================
# パブリックサブネット（ALB・NAT Gateway用）
# ============================
resource "aws_subnet" "public" {
  count = length(var.azs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone       = var.azs[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "\${var.project}-public-\${var.azs[count.index]}"
    Type = "Public"
  }
}

# ============================
# プライベートサブネット（ECSタスク・Lambda用）
# ============================
resource "aws_subnet" "private" {
  count = length(var.azs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 10)
  availability_zone = var.azs[count.index]

  tags = {
    Name = "\${var.project}-private-\${var.azs[count.index]}"
    Type = "Private"
  }
}`,
    tips: [
      "cidrsubnet() 関数で自動的にCIDRブロックを分割",
      "count.index + 10 でプライベートサブネットのCIDRをオフセット",
      "パブリック: 10.0.0.0/24, 10.0.1.0/24 / プライベート: 10.0.10.0/24, 10.0.11.0/24",
    ],
  },
  {
    title: "Step 3: インターネットゲートウェイ & NATゲートウェイ",
    description:
      "パブリックサブネットにインターネット接続を、プライベートサブネットにNAT経由のアウトバウンド通信を提供します。",
    code: `# ============================
# インターネットゲートウェイ
# ============================
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "\${var.project}-igw" }
}

# ============================
# Elastic IP（NAT Gateway用）
# ============================
resource "aws_eip" "nat" {
  domain = "vpc"

  tags = { Name = "\${var.project}-nat-eip" }
}

# ============================
# NAT Gateway（プライベートサブネット→インターネット）
# ============================
resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = { Name = "\${var.project}-nat" }

  depends_on = [aws_internet_gateway.main]
}`,
    tips: [
      "NAT GatewayはECSタスクがECRからイメージをプルするために必要",
      "コスト削減のためNAT Gatewayは1つで運用可能（本番は各AZに配置推奨）",
      "NAT Gatewayの代わりにVPCエンドポイント（PrivateLink）でも代替可能",
    ],
  },
  {
    title: "Step 4: ルートテーブルの設定",
    description:
      "パブリックサブネットはIGW経由でインターネットへ、プライベートサブネットはNAT Gateway経由で外部通信を行います。",
    code: `# ============================
# パブリック用ルートテーブル
# ============================
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "\${var.project}-public-rt" }
}

resource "aws_route_table_association" "public" {
  count = length(var.azs)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ============================
# プライベート用ルートテーブル
# ============================
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = { Name = "\${var.project}-private-rt" }
}

resource "aws_route_table_association" "private" {
  count = length(var.azs)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}`,
    tips: [
      "パブリックサブネット → IGW（双方向のインターネット通信）",
      "プライベートサブネット → NAT GW（アウトバウンドのみ）",
      "ルートテーブルの関連付けを忘れるとサブネットはデフォルトRT使用になる",
    ],
  },
  {
    title: "Step 5: セキュリティグループの作成",
    description:
      "ALB用とECSタスク用のセキュリティグループを作成し、最小権限のアクセス制御を実現します。",
    code: `# ============================
# ALB 用セキュリティグループ
# ============================
resource "aws_security_group" "alb" {
  name        = "\${var.project}-alb-sg"
  description = "ALB security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "\${var.project}-alb-sg" }
}

# ============================
# ECS タスク用セキュリティグループ
# ============================
resource "aws_security_group" "ecs_tasks" {
  name        = "\${var.project}-ecs-sg"
  description = "ECS tasks security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "From ALB only"
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "\${var.project}-ecs-sg" }
}

# ============================
# Output: 他モジュールから参照
# ============================
output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "alb_sg_id" {
  value = aws_security_group.alb.id
}

output "ecs_sg_id" {
  value = aws_security_group.ecs_tasks.id
}`,
    tips: [
      "ECSタスクへのアクセスはALBのSGからのみ許可（最小権限）",
      "egress は全開放が一般的（ECRプル、外部API通信に必要）",
      "本番ではHTTPS（443）のみにしてHTTP→HTTPSリダイレクトを設定",
    ],
  },
];

const ecrSections: Section[] = [
  {
    title: "Step 1: ECRリポジトリの作成",
    description:
      "Docker イメージを保存するプライベートコンテナレジストリ (ECR) を作成します。セキュリティスキャンとライフサイクルポリシーを設定します。",
    code: `# ============================
# ECR リポジトリ
# ============================
resource "aws_ecr_repository" "app" {
  name                 = "\${var.project}-app"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true  # プッシュ時に自動脆弱性スキャン
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name        = "\${var.project}-app"
    Environment = var.environment
  }
}

# ============================
# ライフサイクルポリシー（古いイメージの自動削除）
# ============================
resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "未タグ付きイメージを7日後に削除"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "最新20イメージのみ保持"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 20
        }
        action = { type = "expire" }
      }
    ]
  })
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}`,
    tips: [
      "scan_on_push でCVE脆弱性を自動検出",
      "ライフサイクルポリシーでストレージコストを自動管理",
      "image_tag_mutability = IMMUTABLE にするとタグの上書きを防止（CI/CD推奨）",
    ],
  },
  {
    title: "Step 2: Docker イメージのビルド & プッシュ",
    description:
      "Dockerfile からイメージをビルドし、ECR にプッシュする手順です。CI/CD パイプラインに組み込むことが一般的です。",
    code: `# ============================
# Docker イメージのビルド & プッシュ手順
# ============================

# 1. ECR にログイン
# $ aws ecr get-login-password --region ap-northeast-1 | \\
#     docker login --username AWS --password-stdin \\
#     <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com

# 2. イメージをビルド
# $ docker build -t my-app .

# 3. タグ付け
# $ docker tag my-app:latest \\
#     <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/my-app:latest

# 4. プッシュ
# $ docker push \\
#     <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/my-app:latest

# ============================
# Webアプリ用 Dockerfile の例
# ============================
# --- Dockerfile ---
# FROM node:20-alpine AS builder
# WORKDIR /app
# COPY package*.json ./
# RUN npm ci
# COPY . .
# RUN npm run build
#
# FROM node:20-alpine
# WORKDIR /app
# COPY --from=builder /app/dist ./dist
# COPY --from=builder /app/node_modules ./node_modules
# COPY --from=builder /app/package.json ./
# EXPOSE 3000
# CMD ["node", "dist/index.js"]

# ============================
# Lambda コンテナ用 Dockerfile の例
# ============================
# --- Dockerfile.lambda ---
# FROM public.ecr.aws/lambda/nodejs:20
# COPY index.mjs \${LAMBDA_TASK_ROOT}/
# CMD ["index.handler"]`,
    tips: [
      "マルチステージビルドでイメージサイズを最小化",
      "Lambda用はAWS公式ベースイメージ（public.ecr.aws/lambda/xxx）を使用",
      "CI/CDで自動ビルド&プッシュする場合はGitHub Actionsとの連携が便利",
    ],
  },
];

const ecsSections: Section[] = [
  {
    title: "Step 1: ECS クラスターの作成",
    description:
      "コンテナを実行するためのECSクラスターを作成します。Fargateを使えばEC2インスタンスの管理は不要です。",
    code: `# ============================
# ECS クラスター
# ============================
resource "aws_ecs_cluster" "main" {
  name = "\${var.project}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name        = "\${var.project}-cluster"
    Environment = var.environment
  }
}

# Fargate キャパシティプロバイダー
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }
}`,
    tips: [
      "Container Insights でCPU/メモリ/ネットワークのメトリクスを可視化",
      "FARGATE_SPOT で最大70%のコスト削減（中断リスクあり、バッチ処理向け）",
    ],
  },
  {
    title: "Step 2: IAMロール（タスク実行 & タスク）",
    description:
      "タスク実行ロール（ECRプル、ログ出力）とタスクロール（アプリケーションからのAWSサービスアクセス）を作成します。",
    code: `# ============================
# タスク実行ロール（ECS Agent用）
# ============================
resource "aws_iam_role" "ecs_task_execution" {
  name = "\${var.project}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ============================
# タスクロール（アプリケーション用）
# ============================
resource "aws_iam_role" "ecs_task" {
  name = "\${var.project}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

# 例: S3 アクセスが必要な場合
resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "\${var.project}-ecs-task-s3"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject"]
      Resource = "arn:aws:s3:::\${var.project}-bucket/*"
    }]
  })
}`,
    tips: [
      "実行ロール: ECRプル、CloudWatch Logs書き込みの権限",
      "タスクロール: アプリが使うAWSサービス（S3, DynamoDB等）の権限",
      "最小権限の原則を厳守し、必要な権限のみ付与",
    ],
  },
  {
    title: "Step 3: タスク定義（コンテナの設定）",
    description:
      "コンテナのイメージ、CPU/メモリ、ポート、環境変数、ログ設定を定義します。Docker Compose のサービス定義に相当します。",
    code: `# ============================
# CloudWatch ロググループ
# ============================
resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/\${var.project}"
  retention_in_days = 30

  tags = { Name = "\${var.project}-logs" }
}

# ============================
# ECS タスク定義
# ============================
resource "aws_ecs_task_definition" "app" {
  family                   = "\${var.project}-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"    # 0.25 vCPU
  memory                   = "512"    # 512 MB
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "app"
      image = "\${aws_ecr_repository.app.repository_url}:latest"

      portMappings = [{
        containerPort = 3000
        hostPort      = 3000
        protocol      = "tcp"
      }]

      environment = [
        { name = "NODE_ENV",  value = "production" },
        { name = "PORT",      value = "3000" },
      ]

      # Secrets Manager から機密情報を注入
      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "arn:aws:secretsmanager:ap-northeast-1:123456789:secret:db-url"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/\${var.project}"
          "awslogs-region"        = "ap-northeast-1"
          "awslogs-stream-prefix" = "app"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])
}`,
    tips: [
      "Fargate の CPU/メモリは組み合わせに制約がある（256/512, 512/1024 等）",
      "secrets で Secrets Manager / SSM Parameter Store から安全に値を注入",
      "healthCheck でコンテナの状態を監視し、異常時は自動再起動",
    ],
  },
  {
    title: "Step 4: ALB + ECSサービスの作成",
    description:
      "Application Load Balancerでトラフィックを受け、ECSサービスでコンテナの起動数とロードバランシングを管理します。",
    code: `# ============================
# Application Load Balancer
# ============================
resource "aws_lb" "main" {
  name               = "\${var.project}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  tags = { Name = "\${var.project}-alb" }
}

# ターゲットグループ
resource "aws_lb_target_group" "app" {
  name        = "\${var.project}-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"   # Fargate は "ip" タイプ必須

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# リスナー（HTTP → ターゲットグループ）
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# ============================
# ECS サービス
# ============================
resource "aws_ecs_service" "app" {
  name            = "\${var.project}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = 3000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener.http]
}

# ============================
# Auto Scaling
# ============================
resource "aws_appautoscaling_target" "ecs" {
  max_capacity       = 10
  min_capacity       = 2
  resource_id        = "service/\${aws_ecs_cluster.main.name}/\${aws_ecs_service.app.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "\${var.project}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}

output "app_url" {
  value = "http://\${aws_lb.main.dns_name}"
}`,
    tips: [
      "target_type = 'ip' は Fargate 必須",
      "deployment_circuit_breaker でデプロイ失敗時に自動ロールバック",
      "Auto Scaling でCPU使用率70%をターゲットに自動スケーリング",
      "本番ではHTTPS（ACM証明書 + リスナー443）を必ず設定",
    ],
  },
];

const lambdaContainerSections: Section[] = [
  {
    title: "Step 1: Lambda用コンテナイメージの概要",
    description:
      "AWS Lambda はコンテナイメージ（最大10GB）からも実行できます。通常のZIPデプロイでは難しい大きな依存関係やカスタムランタイムが必要な場合に最適です。",
    code: `# ============================
# Lambda コンテナイメージの利点
# ============================

# 1. 最大10GBのイメージサイズ（ZIPは50MB/解凍250MB制限）
# 2. 機械学習モデルなど大きな依存関係を含めることが可能
# 3. 既存のDockerワークフローをそのまま活用
# 4. ローカルでの動作確認がDockerで簡単に行える
# 5. カスタムランタイム（Rust, C++等）の利用が容易

# ============================
# Lambda コンテナ用 Dockerfile（Node.js）
# ============================
# FROM public.ecr.aws/lambda/nodejs:20
#
# # 依存関係のインストール
# COPY package*.json \${LAMBDA_TASK_ROOT}/
# RUN npm ci --production
#
# # アプリケーションコードのコピー
# COPY index.mjs \${LAMBDA_TASK_ROOT}/
#
# # Lambda ハンドラーの指定
# CMD ["index.handler"]

# ============================
# Lambda コンテナ用 Dockerfile（Python）
# ============================
# FROM public.ecr.aws/lambda/python:3.12
#
# COPY requirements.txt \${LAMBDA_TASK_ROOT}/
# RUN pip install -r requirements.txt
#
# COPY app.py \${LAMBDA_TASK_ROOT}/
#
# CMD ["app.handler"]`,
    tips: [
      "AWS公式ベースイメージ（public.ecr.aws/lambda/xxx）を使用すると簡単",
      "独自ベースイメージを使う場合は Lambda Runtime Interface Client が必要",
      "ローカルテスト: docker run -p 9000:8080 <image> でAPIテスト可能",
    ],
  },
  {
    title: "Step 2: Lambda用ECRリポジトリ & イメージ登録",
    description:
      "Lambda コンテナ用の専用ECRリポジトリを作成し、ビルドしたイメージをプッシュします。",
    code: `# ============================
# Lambda 用 ECR リポジトリ
# ============================
resource "aws_ecr_repository" "lambda_app" {
  name                 = "\${var.project}-lambda"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name    = "\${var.project}-lambda"
    Purpose = "lambda-container"
  }
}

# ライフサイクルポリシー
resource "aws_ecr_lifecycle_policy" "lambda_app" {
  repository = aws_ecr_repository.lambda_app.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "最新5イメージのみ保持"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = { type = "expire" }
    }]
  })
}

# ============================
# ビルド＆プッシュ手順
# ============================
# $ docker build -t my-lambda -f Dockerfile.lambda .
# $ docker tag my-lambda:latest \\
#     <ACCOUNT>.dkr.ecr.ap-northeast-1.amazonaws.com/my-app-lambda:latest
# $ docker push \\
#     <ACCOUNT>.dkr.ecr.ap-northeast-1.amazonaws.com/my-app-lambda:latest`,
    tips: [
      "Lambda用とECS用でECRリポジトリを分けると管理しやすい",
      "CI/CDでビルド→プッシュ→Lambda更新を自動化するのが理想",
    ],
  },
  {
    title: "Step 3: Lambda関数の定義（コンテナイメージ版）",
    description:
      "ECR に登録したコンテナイメージを使って Lambda 関数を作成します。VPC 内に配置することで、プライベートサブネット内のリソースにアクセスできます。",
    code: `# ============================
# Lambda 実行用 IAM ロール
# ============================
resource "aws_iam_role" "lambda_role" {
  name = "\${var.project}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# VPC アクセス用ポリシー
resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# 基本実行ポリシー
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ============================
# Lambda 用セキュリティグループ
# ============================
resource "aws_security_group" "lambda" {
  name        = "\${var.project}-lambda-sg"
  description = "Lambda function security group"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "\${var.project}-lambda-sg" }
}

# ============================
# Lambda 関数（コンテナイメージ）
# ============================
resource "aws_lambda_function" "app" {
  function_name = "\${var.project}-api"
  role          = aws_iam_role.lambda_role.arn

  # コンテナイメージを指定（ZIPの代わり）
  package_type = "Image"
  image_uri    = "\${aws_ecr_repository.lambda_app.repository_url}:latest"

  # タイムアウトとメモリ
  timeout     = 30
  memory_size = 512

  # VPC 内に配置
  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      APP_ENV      = var.environment
      TABLE_NAME   = "my-table"
    }
  }

  tags = {
    Name        = "\${var.project}-api"
    Environment = var.environment
  }
}

# CloudWatch ログ
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/\${aws_lambda_function.app.function_name}"
  retention_in_days = 14
}`,
    tips: [
      "package_type = 'Image' でコンテナイメージを指定",
      "VPC内配置で RDS / ElastiCache 等のプライベートリソースにアクセス可能",
      "VPC内Lambda は NAT Gateway 経由でインターネットアクセス",
      "コールドスタートが通常のLambdaより長くなる点に注意",
    ],
    warnings: [
      "VPC内Lambdaは初回起動（コールドスタート）が遅くなる場合がある",
      "Provisioned Concurrency を使うとコールドスタートを回避可能",
    ],
  },
  {
    title: "Step 4: API Gateway + Lambda の統合",
    description:
      "API Gateway を作成し、Lambda コンテナ関数と統合してREST APIを公開します。",
    code: `# ============================
# API Gateway (HTTP API v2)
# ============================
resource "aws_apigatewayv2_api" "main" {
  name          = "\${var.project}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["Content-Type", "Authorization"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_origins = ["*"]
    max_age       = 300
  }
}

# Lambda 統合
resource "aws_apigatewayv2_integration" "lambda" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.app.invoke_arn
  integration_method = "POST"
  payload_format_version = "2.0"
}

# ルーティング（全リクエストをLambdaに転送）
resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "\$default"
  target    = "integrations/\${aws_apigatewayv2_integration.lambda.id}"
}

# ステージ（自動デプロイ）
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "\$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw.arn
    format = jsonencode({
      requestId      = "\$context.requestId"
      ip             = "\$context.identity.sourceIp"
      requestTime    = "\$context.requestTime"
      httpMethod     = "\$context.httpMethod"
      routeKey       = "\$context.routeKey"
      status         = "\$context.status"
      protocol       = "\$context.protocol"
      responseLength = "\$context.responseLength"
    })
  }
}

# API Gateway → Lambda 呼び出し権限
resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.app.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "\${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# API GW ログ
resource "aws_cloudwatch_log_group" "api_gw" {
  name              = "/aws/apigateway/\${var.project}"
  retention_in_days = 14
}

output "api_endpoint" {
  value = aws_apigatewayv2_stage.default.invoke_url
}`,
    tips: [
      "HTTP API (v2) は REST API (v1) より安価で高速",
      "payload_format_version = '2.0' で新しいイベント形式を使用",
      "auto_deploy = true でルート変更時に自動デプロイ",
      "CORS設定は本番では allow_origins を制限すること",
    ],
  },
];

const webAppSections: Section[] = [
  {
    title: "Step 1: Webアプリ用タスク定義",
    description:
      "React / Next.js / Express 等のWebアプリケーションをECSタスクとして定義します。フロントエンドとAPIサーバーを1コンテナまたは複数コンテナで構成できます。",
    code: `# ============================
# Webアプリ用タスク定義（例: Next.js）
# ============================
resource "aws_ecs_task_definition" "web" {
  family                   = "\${var.project}-web"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"    # 0.5 vCPU
  memory                   = "1024"   # 1 GB
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "web"
      image = "\${aws_ecr_repository.app.repository_url}:latest"

      portMappings = [{
        containerPort = 3000
        hostPort      = 3000
        protocol      = "tcp"
      }]

      environment = [
        { name = "NODE_ENV",    value = "production" },
        { name = "PORT",        value = "3000" },
        { name = "API_URL",     value = "https://api.example.com" },
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = aws_ssm_parameter.db_url.arn
        },
        {
          name      = "SESSION_SECRET"
          valueFrom = aws_ssm_parameter.session_secret.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/\${var.project}-web"
          "awslogs-region"        = "ap-northeast-1"
          "awslogs-stream-prefix" = "web"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3000/ || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])
}

# SSM パラメーター（機密情報の管理）
resource "aws_ssm_parameter" "db_url" {
  name  = "/\${var.project}/\${var.environment}/db-url"
  type  = "SecureString"
  value = "postgresql://user:pass@db-host:5432/mydb"
}

resource "aws_ssm_parameter" "session_secret" {
  name  = "/\${var.project}/\${var.environment}/session-secret"
  type  = "SecureString"
  value = "change-me-in-production"
}`,
    tips: [
      "SSM Parameter Store (SecureString) で機密情報を安全に管理",
      "Next.jsの場合、standalone出力モードを使うとイメージサイズを削減",
      "静的アセットはS3 + CloudFrontで配信するとパフォーマンス向上",
    ],
  },
  {
    title: "Step 2: 複数コンテナ構成（サイドカーパターン）",
    description:
      "1つのタスクに複数のコンテナを配置するサイドカーパターンです。例えば、Nginx（リバースプロキシ）+ アプリケーションの構成です。",
    code: `# ============================
# サイドカーパターン: Nginx + App
# ============================
resource "aws_ecs_task_definition" "web_with_proxy" {
  family                   = "\${var.project}-web-proxy"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([
    # === Nginx リバースプロキシ ===
    {
      name      = "nginx"
      image     = "nginx:alpine"
      essential = true

      portMappings = [{
        containerPort = 80
        hostPort      = 80
      }]

      dependsOn = [{
        containerName = "app"
        condition     = "HEALTHY"
      }]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/\${var.project}-nginx"
          "awslogs-region"        = "ap-northeast-1"
          "awslogs-stream-prefix" = "nginx"
        }
      }
    },
    # === アプリケーション ===
    {
      name      = "app"
      image     = "\${aws_ecr_repository.app.repository_url}:latest"
      essential = true

      portMappings = [{
        containerPort = 3000
      }]

      environment = [
        { name = "NODE_ENV", value = "production" },
      ]

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
        interval    = 15
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/\${var.project}-app"
          "awslogs-region"        = "ap-northeast-1"
          "awslogs-stream-prefix" = "app"
        }
      }
    }
  ])
}`,
    tips: [
      "essential = true のコンテナが停止するとタスク全体が停止",
      "dependsOn で起動順序を制御（nginx は app の HEALTHY 後に起動）",
      "同一タスク内のコンテナは localhost で通信可能",
      "サイドカーでログ収集（Fluentd/Fluent Bit）も一般的",
    ],
  },
  {
    title: "Step 3: ECSサービスの作成 & デプロイ",
    description:
      "Webアプリ用のECSサービスを作成し、Blue/Greenデプロイやローリングアップデートを設定します。",
    code: `# ============================
# Web アプリ用 ECS サービス
# ============================
resource "aws_ecs_service" "web" {
  name            = "\${var.project}-web-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "web"
    container_port   = 3000
  }

  # ローリングアップデート設定
  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  # タスクのスケジューリング戦略
  force_new_deployment = true

  lifecycle {
    ignore_changes = [task_definition]  # CI/CDで更新する場合
  }

  depends_on = [aws_lb_listener.http]
}

# ============================
# デプロイの更新手順（CI/CDから実行）
# ============================
# 1. Docker イメージをビルド & ECRにプッシュ
# $ docker build -t my-app:v2 .
# $ docker push <ECR_URL>:v2
#
# 2. 新しいタスク定義を登録
# $ aws ecs register-task-definition --cli-input-json file://task-def.json
#
# 3. サービスを更新（新タスク定義でローリングアップデート）
# $ aws ecs update-service \\
#     --cluster my-app-cluster \\
#     --service my-app-web-service \\
#     --task-definition my-app-web:2 \\
#     --force-new-deployment

output "web_app_url" {
  value = "http://\${aws_lb.main.dns_name}"
}`,
    tips: [
      "deployment_maximum_percent = 200 で新旧タスクが並行稼働（ダウンタイムゼロ）",
      "circuit_breaker でデプロイ失敗時に自動ロールバック",
      "ignore_changes = [task_definition] でCI/CDからの更新を許可",
      "force_new_deployment で次の apply 時に強制デプロイ",
    ],
  },
];

const fullstackSections: Section[] = [
  {
    title: "統合アーキテクチャ: VPC + ECS + Lambda + API Gateway",
    description:
      "VPC構築からコンテナ・Lambda・API Gatewayまでの全体構成をモジュール化して管理する構成です。",
    code: `# ============================
# プロジェクト全体構成
# ============================
#
# project/
# ├── main.tf              # エントリーポイント
# ├── variables.tf         # グローバル変数
# ├── outputs.tf           # 出力値
# ├── terraform.tfvars     # 環境別変数値
# │
# ├── modules/
# │   ├── vpc/             # VPC・サブネット・SG
# │   │   ├── main.tf
# │   │   ├── variables.tf
# │   │   └── outputs.tf
# │   │
# │   ├── ecr/             # コンテナレジストリ
# │   │   ├── main.tf
# │   │   ├── variables.tf
# │   │   └── outputs.tf
# │   │
# │   ├── ecs/             # ECSクラスター・サービス
# │   │   ├── main.tf
# │   │   ├── iam.tf
# │   │   ├── variables.tf
# │   │   └── outputs.tf
# │   │
# │   ├── lambda/          # Lambda コンテナ関数
# │   │   ├── main.tf
# │   │   ├── iam.tf
# │   │   ├── variables.tf
# │   │   └── outputs.tf
# │   │
# │   └── api-gateway/     # API Gateway
# │       ├── main.tf
# │       ├── variables.tf
# │       └── outputs.tf
# │
# └── docker/              # Dockerfiles
#     ├── web/
#     │   └── Dockerfile
#     └── lambda/
#         └── Dockerfile`,
    tips: [
      "モジュール分割で各コンポーネントを独立して管理・テスト",
      "modules/ 配下の各モジュールは再利用可能な単位",
      "variables.tf でモジュール間の依存関係を明示",
    ],
  },
  {
    title: "main.tf: モジュールの組み立て",
    description:
      "各モジュールを呼び出し、output で得た値を次のモジュールの input に渡して全体を構築します。",
    code: `# ============================
# main.tf - モジュールの組み立て
# ============================
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # リモートステート（チーム開発用）
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "app/terraform.tfstate"
    region         = "ap-northeast-1"
    encrypt        = true
    dynamodb_table = "terraform-lock"
  }
}

provider "aws" {
  region = var.region
}

# ============================
# 1. VPC モジュール
# ============================
module "vpc" {
  source = "./modules/vpc"

  project     = var.project
  environment = var.environment
  azs         = var.azs
}

# ============================
# 2. ECR モジュール
# ============================
module "ecr" {
  source = "./modules/ecr"

  project     = var.project
  environment = var.environment
}

# ============================
# 3. ECS モジュール（Webアプリ）
# ============================
module "ecs" {
  source = "./modules/ecs"

  project            = var.project
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  private_subnet_ids = module.vpc.private_subnet_ids
  alb_sg_id          = module.vpc.alb_sg_id
  ecs_sg_id          = module.vpc.ecs_sg_id
  ecr_repository_url = module.ecr.repository_url
  container_port     = 3000
  desired_count      = 2
}

# ============================
# 4. Lambda モジュール（APIバックエンド）
# ============================
module "lambda" {
  source = "./modules/lambda"

  project            = var.project
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  ecr_repository_url = module.ecr.lambda_repository_url
}

# ============================
# 5. API Gateway モジュール
# ============================
module "api_gateway" {
  source = "./modules/api-gateway"

  project           = var.project
  environment       = var.environment
  lambda_invoke_arn = module.lambda.invoke_arn
  lambda_function_name = module.lambda.function_name
}`,
    tips: [
      "module.vpc.vpc_id のようにモジュールの出力を次のモジュールに渡す",
      "依存関係は Terraform が自動解決（VPC → ECS の順で作成）",
      "backend 's3' でステートファイルをリモート管理（チーム開発必須）",
    ],
  },
  {
    title: "outputs.tf & terraform.tfvars",
    description:
      "全体の出力値と環境別の変数ファイルを定義して、デプロイ情報を確認しやすくします。",
    code: `# ============================
# outputs.tf
# ============================
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "web_app_url" {
  description = "WebアプリのURL（ALB DNS）"
  value       = module.ecs.app_url
}

output "api_endpoint" {
  description = "API Gatewayのエンドポイント"
  value       = module.api_gateway.api_endpoint
}

output "ecr_web_url" {
  description = "Web用ECRリポジトリURL"
  value       = module.ecr.repository_url
}

output "ecr_lambda_url" {
  description = "Lambda用ECRリポジトリURL"
  value       = module.ecr.lambda_repository_url
}

# ============================
# terraform.tfvars（dev環境）
# ============================
# project     = "my-app"
# environment = "dev"
# region      = "ap-northeast-1"
# azs         = ["ap-northeast-1a", "ap-northeast-1c"]

# ============================
# terraform.prod.tfvars（本番環境）
# ============================
# project     = "my-app"
# environment = "prod"
# region      = "ap-northeast-1"
# azs         = ["ap-northeast-1a", "ap-northeast-1c", "ap-northeast-1d"]

# ============================
# デプロイ手順
# ============================
# 1. terraform init
# 2. terraform plan -var-file="terraform.tfvars"
# 3. terraform apply -var-file="terraform.tfvars"
#
# 本番デプロイ:
# $ terraform plan -var-file="terraform.prod.tfvars"
# $ terraform apply -var-file="terraform.prod.tfvars"`,
    tips: [
      "環境ごとに .tfvars ファイルを分けて管理",
      "-var-file オプションで環境を切り替え",
      "terraform output でデプロイ後の情報を確認",
      "sensitive = true で機密情報の出力をマスク",
    ],
  },
];

const operationsSections: Section[] = [
  {
    title: "コンテナイメージの再利用（ECR クロスアカウント & マルチサービス）",
    description:
      "一度ECRに登録したコンテナイメージを、複数のECSサービスやLambda関数で再利用する方法、および別アカウントから参照する方法を解説します。",
    code: `# ============================
# 1. 同一アカウント内での再利用
# ============================

# 同じイメージを複数のECSサービスで使う
# → タスク定義の image に同じ ECR URL を指定するだけ

resource "aws_ecs_task_definition" "api_service" {
  family                   = "\${var.project}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name  = "api"
    image = "\${aws_ecr_repository.app.repository_url}:latest"
    # ↑ 同じイメージを別サービスで再利用
    portMappings = [{ containerPort = 3000 }]
    environment  = [
      { name = "SERVICE_TYPE", value = "api" }
    ]
  }])
}

resource "aws_ecs_task_definition" "worker_service" {
  family                   = "\${var.project}-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name  = "worker"
    image = "\${aws_ecr_repository.app.repository_url}:latest"
    # ↑ 同じイメージだが環境変数で役割を切り替え
    environment = [
      { name = "SERVICE_TYPE", value = "worker" }
    ]
  }])
}

# Lambda でも同じ ECR イメージを使える
resource "aws_lambda_function" "batch" {
  function_name = "\${var.project}-batch"
  role          = aws_iam_role.lambda_role.arn
  package_type  = "Image"
  image_uri     = "\${aws_ecr_repository.app.repository_url}:latest"
  # ↑ ECS と同じイメージを Lambda でも利用

  image_config {
    command = ["batch.handler"]
    # ↑ CMD を上書きして別のハンドラーを実行
  }
}

# ============================
# 2. タグ戦略でイメージのバージョンを管理
# ============================
# - latest        : 最新の開発版
# - v1.2.3        : セマンティックバージョニング
# - git-abc1234   : Gitコミットハッシュ
# - staging       : ステージング環境用
# - production    : 本番環境用
#
# 本番では latest を避け、明示的なタグを使う:
#   image = "\${ecr_url}:v1.2.3"`,
    tips: [
      "同じイメージを環境変数や CMD の上書きで複数の用途に使い回せる",
      "Lambda の image_config.command で CMD を上書きして別ハンドラーを実行",
      "本番では latest タグを避け、コミットハッシュやバージョンタグを使用",
      "ECR のイメージは同一リージョン・同一アカウントなら追加設定不要で参照可能",
    ],
  },
  {
    title: "クロスアカウントでのECRイメージ共有",
    description:
      "開発アカウントのECRイメージを本番アカウントのECS/Lambdaから参照する方法です。ECRリポジトリポリシーでアクセスを許可します。",
    code: `# ============================
# 開発アカウント側: ECR リポジトリポリシー
# ============================
# 開発アカウント (111111111111) の ECR から
# 本番アカウント (222222222222) にプルを許可

resource "aws_ecr_repository_policy" "cross_account" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCrossAccountPull"
        Effect    = "Allow"
        Principal = {
          AWS = [
            "arn:aws:iam::222222222222:root",
            # 特定ロールに限定する場合:
            # "arn:aws:iam::222222222222:role/ecs-task-execution-role"
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
# 本番アカウント側: 別アカウントのイメージを参照
# ============================
# 本番アカウントの ECS タスク定義で
# 開発アカウントの ECR URL を直接指定

resource "aws_ecs_task_definition" "app_prod" {
  family                   = "\${var.project}-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name  = "app"
    # 開発アカウントの ECR リポジトリを直接参照
    image = "111111111111.dkr.ecr.ap-northeast-1.amazonaws.com/my-app:v1.2.3"
    portMappings = [{ containerPort = 3000 }]
  }])
}

# ============================
# ECR レプリケーション（推奨パターン）
# ============================
# 別アカウント/リージョンに自動複製する設定

resource "aws_ecr_replication_configuration" "replication" {
  replication_configuration {
    rule {
      destination {
        region      = "ap-northeast-1"
        registry_id = "222222222222"  # 本番アカウントID
      }

      # 対象リポジトリをフィルタ
      repository_filter {
        filter      = "my-app"
        filter_type = "PREFIX_MATCH"
      }
    }
  }
}`,
    tips: [
      "クロスアカウント参照よりもECRレプリケーションの方が安全で高速",
      "レプリケーションならアカウント間の依存関係を減らせる",
      "本番アカウントのタスク実行ロールに ecr:GetAuthorizationToken 権限も必要",
      "Organizations を使っている場合は条件キーで組織内に限定可能",
    ],
  },
  {
    title: "リージョンを変更してデプロイする",
    description:
      "同じTerraformコードを別リージョン（例: 東京→大阪、東京→バージニア）にデプロイする方法です。変数やプロバイダーエイリアスを活用します。",
    code: `# ============================
# 方法1: 変数でリージョンを切り替え
# ============================
variable "region" {
  description = "デプロイ先リージョン"
  type        = string
  default     = "ap-northeast-1"  # 東京
}

variable "azs" {
  description = "使用する AZ"
  type        = list(string)
  default     = ["ap-northeast-1a", "ap-northeast-1c"]
}

provider "aws" {
  region = var.region
}

# terraform.tokyo.tfvars
# region = "ap-northeast-1"
# azs    = ["ap-northeast-1a", "ap-northeast-1c"]

# terraform.osaka.tfvars
# region = "ap-northeast-3"
# azs    = ["ap-northeast-3a", "ap-northeast-3b"]

# terraform.virginia.tfvars
# region = "us-east-1"
# azs    = ["us-east-1a", "us-east-1b"]

# 使い方:
# $ terraform apply -var-file="terraform.osaka.tfvars"

# ============================
# 方法2: プロバイダーエイリアス（マルチリージョン同時デプロイ）
# ============================
provider "aws" {
  region = "ap-northeast-1"
  alias  = "tokyo"
}

provider "aws" {
  region = "ap-northeast-3"
  alias  = "osaka"
}

# 東京リージョンの VPC
module "vpc_tokyo" {
  source = "./modules/vpc"
  providers = {
    aws = aws.tokyo
  }
  project     = var.project
  environment = var.environment
  azs         = ["ap-northeast-1a", "ap-northeast-1c"]
}

# 大阪リージョンの VPC
module "vpc_osaka" {
  source = "./modules/vpc"
  providers = {
    aws = aws.osaka
  }
  project     = var.project
  environment = "\${var.environment}-dr"
  azs         = ["ap-northeast-3a", "ap-northeast-3b"]
}

# 東京の ECS クラスター
module "ecs_tokyo" {
  source = "./modules/ecs"
  providers = {
    aws = aws.tokyo
  }
  vpc_id             = module.vpc_tokyo.vpc_id
  private_subnet_ids = module.vpc_tokyo.private_subnet_ids
  # ...
}

# 大阪の ECS クラスター（DR用）
module "ecs_osaka" {
  source = "./modules/ecs"
  providers = {
    aws = aws.osaka
  }
  vpc_id             = module.vpc_osaka.vpc_id
  private_subnet_ids = module.vpc_osaka.private_subnet_ids
  # ...
}

# ============================
# 方法3: Workspace でリージョンを分離
# ============================
# $ terraform workspace new tokyo
# $ terraform workspace new osaka
#
# main.tf:
# locals {
#   region_config = {
#     tokyo = {
#       region = "ap-northeast-1"
#       azs    = ["ap-northeast-1a", "ap-northeast-1c"]
#     }
#     osaka = {
#       region = "ap-northeast-3"
#       azs    = ["ap-northeast-3a", "ap-northeast-3b"]
#     }
#   }
#   config = local.region_config[terraform.workspace]
# }
#
# provider "aws" {
#   region = local.config.region
# }`,
    tips: [
      "方法1（tfvars）: 最もシンプル。別ディレクトリ/ステートで完全分離",
      "方法2（エイリアス）: マルチリージョン同時管理。DR構成に最適",
      "方法3（Workspace）: 同一コードで複数環境。小規模向け",
      "ECRイメージはリージョンごとに存在するため、クロスリージョンレプリケーションを設定",
    ],
    warnings: [
      "リージョン変更時はAZの名前も変わるため、azs変数を必ず更新すること",
      "ECRイメージは別リージョンに自動コピーされない。レプリケーションか再プッシュが必要",
    ],
  },
  {
    title: "AWSアカウントを切り替えてデプロイする",
    description:
      "開発/ステージング/本番で異なるAWSアカウントを使い分ける方法です。プロファイルやAssumeRoleで安全にアカウントを切り替えます。",
    code: `# ============================
# 方法1: AWS CLI プロファイルで切り替え
# ============================

# ~/.aws/credentials
# [dev]
# aws_access_key_id     = AKIA...
# aws_secret_access_key = xxx...
#
# [staging]
# aws_access_key_id     = AKIA...
# aws_secret_access_key = xxx...
#
# [prod]
# aws_access_key_id     = AKIA...
# aws_secret_access_key = xxx...

variable "aws_profile" {
  description = "AWS CLI プロファイル名"
  type        = string
  default     = "dev"
}

provider "aws" {
  region  = var.region
  profile = var.aws_profile
}

# 使い方:
# $ terraform apply -var="aws_profile=dev"
# $ terraform apply -var="aws_profile=prod"

# ============================
# 方法2: AssumeRole（推奨: クロスアカウント）
# ============================

variable "target_account_id" {
  description = "デプロイ先の AWS アカウント ID"
  type        = string
}

provider "aws" {
  region = var.region

  assume_role {
    role_arn     = "arn:aws:iam::\${var.target_account_id}:role/TerraformDeployRole"
    session_name = "terraform-\${var.environment}"
    external_id  = "terraform-deploy"  # オプション: セキュリティ強化
  }
}

# terraform.dev.tfvars
# target_account_id = "111111111111"
# environment       = "dev"

# terraform.prod.tfvars
# target_account_id = "222222222222"
# environment       = "prod"

# ============================
# 本番アカウント側: Terraform 用 IAM ロール
# ============================
# デプロイ元アカウント (000000000000) からの AssumeRole を許可

resource "aws_iam_role" "terraform_deploy" {
  name = "TerraformDeployRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = {
        AWS = "arn:aws:iam::000000000000:root"
      }
      Action    = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "sts:ExternalId" = "terraform-deploy"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "terraform_deploy" {
  role       = aws_iam_role.terraform_deploy.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
  # 本番では最小権限のカスタムポリシーを推奨
}

# ============================
# 方法3: 環境変数で切り替え
# ============================
# 最もシンプルな方法

# $ export AWS_PROFILE=prod
# $ terraform apply

# または AWS SSO を使う場合:
# $ aws sso login --profile prod
# $ export AWS_PROFILE=prod
# $ terraform apply`,
    tips: [
      "AssumeRole が最も安全。監査ログ (CloudTrail) に誰が何をしたか記録される",
      "AWS SSO + AssumeRole の組み合わせが大規模チームのベストプラクティス",
      "各アカウントでステートファイルのバックエンド（S3）も分離すること",
      "外部IDでクロスアカウントアクセスのセキュリティを強化",
    ],
    warnings: [
      "本番アカウントに AdministratorAccess を付与するのは避け、最小権限ポリシーを作成",
      "認証情報（アクセスキー）を.tfファイルやGitにコミットしないこと",
    ],
  },
  {
    title: "既存VPCをTerraformに取り込む（import）",
    description:
      "手動で作成済みの既存VPCやサブネットをTerraformの管理下に取り込む方法です。terraform import コマンドと import ブロックの2つの方法があります。",
    code: `# ============================
# 方法1: terraform import コマンド（従来の方法）
# ============================

# 1. まずリソース定義を .tf ファイルに書く
resource "aws_vpc" "imported" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = { Name = "existing-vpc" }
}

# 2. terraform import で既存リソースを取り込み
# $ terraform import aws_vpc.imported vpc-0abc123def456

# 3. サブネットも同様に取り込み
resource "aws_subnet" "imported_public" {
  vpc_id     = aws_vpc.imported.id
  cidr_block = "10.0.1.0/24"
  # ...
}
# $ terraform import aws_subnet.imported_public subnet-0abc123

# ============================
# 方法2: import ブロック（Terraform 1.5+、推奨）
# ============================

# .tf ファイル内で import を宣言的に記述
import {
  to = aws_vpc.imported
  id = "vpc-0abc123def456"
}

import {
  to = aws_subnet.imported_public_a
  id = "subnet-0abc123"
}

import {
  to = aws_subnet.imported_public_c
  id = "subnet-0def456"
}

import {
  to = aws_subnet.imported_private_a
  id = "subnet-0ghi789"
}

import {
  to = aws_subnet.imported_private_c
  id = "subnet-0jkl012"
}

import {
  to = aws_internet_gateway.imported
  id = "igw-0abc123"
}

import {
  to = aws_nat_gateway.imported
  id = "nat-0abc123"
}

import {
  to = aws_security_group.imported_alb
  id = "sg-0abc123"
}

# terraform plan で差分を確認 → apply で State に取り込み
# $ terraform plan   # 変更内容を確認
# $ terraform apply  # State に登録

# ============================
# 方法3: terraform plan -generate-config-out
#         （自動でHCLコードを生成）
# ============================

# import ブロックだけ書いて、HCL定義は自動生成
# $ terraform plan -generate-config-out=generated.tf
#
# → generated.tf に既存リソースの設定が自動出力される
# → 内容を確認して main.tf に統合
# → import ブロックを削除して完了`,
    tips: [
      "import ブロック（方法2）はTerraform 1.5+ で利用可能。plan で事前確認できるため安全",
      "-generate-config-out で既存リソースのHCL定義を自動生成できる",
      "import 後は terraform plan で差分がないことを確認",
      "大量のリソースを取り込む場合は terraformer ツールも検討",
    ],
    warnings: [
      "import はリソースをStateに登録するだけ。.tfファイルのコード定義は手動で用意が必要",
      "import 後の plan で差分が出る場合、.tf の定義を実態に合わせて修正する",
    ],
  },
  {
    title: "既存VPCをData Sourceで参照する（importせずに利用）",
    description:
      "既存VPCをTerraform管理下に取り込まず、読み取り専用で参照する方法です。別チームが管理するVPCにECSを構築する場合などに最適です。",
    code: `# ============================
# 既存 VPC を Data Source で参照
# ============================

# タグ名で検索
data "aws_vpc" "existing" {
  tags = {
    Name = "production-vpc"
  }
}

# または VPC ID を直接指定
# data "aws_vpc" "existing" {
#   id = "vpc-0abc123def456"
# }

# ============================
# 既存サブネットを検索して取得
# ============================

# パブリックサブネット（タグでフィルタ）
data "aws_subnets" "public" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.existing.id]
  }
  tags = {
    Type = "Public"
  }
}

# プライベートサブネット
data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.existing.id]
  }
  tags = {
    Type = "Private"
  }
}

# 個別のサブネット情報が必要な場合
data "aws_subnet" "private_details" {
  for_each = toset(data.aws_subnets.private.ids)
  id       = each.value
}

# ============================
# 既存セキュリティグループを検索
# ============================
data "aws_security_group" "existing_alb_sg" {
  vpc_id = data.aws_vpc.existing.id
  tags = {
    Name = "alb-security-group"
  }
}

# ============================
# Data Source の値を ECS モジュールに渡す
# ============================
module "ecs" {
  source = "./modules/ecs"

  project            = var.project
  environment        = var.environment
  vpc_id             = data.aws_vpc.existing.id
  public_subnet_ids  = data.aws_subnets.public.ids
  private_subnet_ids = data.aws_subnets.private.ids
  alb_sg_id          = data.aws_security_group.existing_alb_sg.id
  ecr_repository_url = module.ecr.repository_url
  container_port     = 3000
}

# Lambda を既存 VPC に配置
module "lambda" {
  source = "./modules/lambda"

  project            = var.project
  environment        = var.environment
  vpc_id             = data.aws_vpc.existing.id
  private_subnet_ids = data.aws_subnets.private.ids
  ecr_repository_url = module.ecr.lambda_repository_url
}

# ============================
# 出力: 参照した既存リソースの情報
# ============================
output "existing_vpc_id" {
  value = data.aws_vpc.existing.id
}

output "existing_vpc_cidr" {
  value = data.aws_vpc.existing.cidr_block
}

output "existing_public_subnets" {
  value = data.aws_subnets.public.ids
}

output "existing_private_subnets" {
  value = data.aws_subnets.private.ids
}`,
    tips: [
      "Data Source は読み取り専用。既存リソースを変更・削除するリスクがない",
      "VPCのタグ付けルールをチーム間で統一しておくと検索しやすい",
      "aws_subnets（複数形）で一括取得、aws_subnet（単数形）で詳細取得",
      "for_each + toset() で動的にサブネット情報を展開できる",
      "別チーム管理のVPCを使う場合はData Sourceが最適。importは不要",
    ],
  },
  {
    title: "ECR クロスリージョンレプリケーション",
    description:
      "ECR イメージを複数リージョンに自動複製する設定です。リージョン切り替えデプロイやDR対策に必須です。",
    code: `# ============================
# ECR クロスリージョンレプリケーション
# ============================

# 東京リージョン → 大阪リージョンに自動複製
resource "aws_ecr_replication_configuration" "cross_region" {
  replication_configuration {
    rule {
      destination {
        region      = "ap-northeast-3"  # 大阪
        registry_id = data.aws_caller_identity.current.account_id
      }

      repository_filter {
        filter      = "\${var.project}"
        filter_type = "PREFIX_MATCH"
      }
    }

    # 複数リージョンへの同時レプリケーション
    rule {
      destination {
        region      = "us-east-1"  # バージニア
        registry_id = data.aws_caller_identity.current.account_id
      }

      repository_filter {
        filter      = "\${var.project}"
        filter_type = "PREFIX_MATCH"
      }
    }
  }
}

data "aws_caller_identity" "current" {}

# ============================
# 大阪リージョンの ECS で複製イメージを使用
# ============================
provider "aws" {
  alias  = "osaka"
  region = "ap-northeast-3"
}

# 大阪リージョンの ECR にレプリケーションされたイメージを参照
# → 東京と同じリポジトリ名・タグで自動的に利用可能

resource "aws_ecs_task_definition" "app_osaka" {
  provider = aws.osaka

  family                   = "\${var.project}-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution_osaka.arn

  container_definitions = jsonencode([{
    name  = "app"
    # レプリケーション先の ECR URL（アカウントIDは同じ、リージョンが異なる）
    image = "\${data.aws_caller_identity.current.account_id}.dkr.ecr.ap-northeast-3.amazonaws.com/\${var.project}-app:latest"
    portMappings = [{ containerPort = 3000 }]
  }])
}

# ============================
# プルスルーキャッシュ（パブリックイメージのキャッシュ）
# ============================
resource "aws_ecr_pull_through_cache_rule" "docker_hub" {
  ecr_repository_prefix = "docker-hub"
  upstream_registry_url = "registry-1.docker.io"
}

# 使い方: パブリックイメージもECR経由でプルできる
# image = "<account>.dkr.ecr.ap-northeast-1.amazonaws.com/docker-hub/library/nginx:alpine"`,
    tips: [
      "レプリケーションはプッシュ時に自動実行される",
      "フィルタで対象リポジトリを限定しコスト管理",
      "プルスルーキャッシュでDocker Hubのレート制限を回避",
      "レプリケーション先でも同じタグ・同じリポジトリ名で参照可能",
    ],
  },
  {
    title: "Git サブモジュールを使った Terraform モジュール管理",
    description:
      "共通の Terraform モジュール（VPC、ECS、ECR 等）を Git リポジトリとして切り出し、Git サブモジュールで複数プロジェクトから参照する方法です。チーム間でインフラ構成を統一できます。",
    code: `# ============================
# Git サブモジュールの全体像
# ============================
#
# 【リポジトリ構成】
#
# terraform-modules (共通モジュール用リポジトリ)
# ├── modules/
# │   ├── vpc/
# │   │   ├── main.tf
# │   │   ├── variables.tf
# │   │   └── outputs.tf
# │   ├── ecr/
# │   │   ├── main.tf
# │   │   ├── variables.tf
# │   │   └── outputs.tf
# │   ├── ecs-service/
# │   │   ├── main.tf
# │   │   ├── iam.tf
# │   │   ├── variables.tf
# │   │   └── outputs.tf
# │   └── lambda-container/
# │       ├── main.tf
# │       ├── iam.tf
# │       ├── variables.tf
# │       └── outputs.tf
# └── README.md
#
# app-project-a (プロジェクトAのリポジトリ)
# ├── infra/
# │   ├── main.tf            ← サブモジュール内のモジュールを参照
# │   ├── variables.tf
# │   └── terraform.tfvars
# ├── modules/               ← Git サブモジュール
# │   └── terraform-modules/  (↑ terraform-modules を参照)
# ├── docker/
# │   └── Dockerfile
# └── src/
#     └── ...

# ============================
# 1. サブモジュールの追加（初回セットアップ）
# ============================

# 共通モジュールリポジトリをサブモジュールとして追加
# $ git submodule add \\
#     https://github.com/your-org/terraform-modules.git \\
#     modules/terraform-modules

# 特定のタグ（バージョン）に固定
# $ cd modules/terraform-modules
# $ git checkout v1.2.0
# $ cd ../..
# $ git add modules/terraform-modules
# $ git commit -m "fix: pin terraform-modules to v1.2.0"

# ============================
# 2. .gitmodules の内容（自動生成される）
# ============================
# [submodule "modules/terraform-modules"]
#     path = modules/terraform-modules
#     url = https://github.com/your-org/terraform-modules.git
#     branch = main

# ============================
# 3. チームメンバーのクローン手順
# ============================
# $ git clone --recurse-submodules \\
#     https://github.com/your-org/app-project-a.git
#
# # または既にクローン済みの場合:
# $ git submodule init
# $ git submodule update`,
    tips: [
      "git submodule add で共通リポジトリをサブモジュールとして追加",
      "git checkout <tag> でバージョンを固定し、意図しない変更を防止",
      "--recurse-submodules をつけないとサブモジュールが空になるので注意",
      ".gitmodules ファイルがサブモジュールの参照先を管理",
    ],
  },
  {
    title: "サブモジュールの Terraform モジュールを参照する",
    description:
      "Git サブモジュールとして取り込んだ共通モジュールを main.tf から source で参照し、コンテナインフラを構築する具体的なコード例です。",
    code: `# ============================
# main.tf - サブモジュール内のモジュールを使用
# ============================
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
  region = var.region
}

# ============================
# VPC（サブモジュールのモジュールを参照）
# ============================
module "vpc" {
  # Git サブモジュールのパスを source に指定
  source = "../../modules/terraform-modules/modules/vpc"

  project     = var.project
  environment = var.environment
  azs         = var.azs
}

# ============================
# ECR（コンテナレジストリ）
# ============================
module "ecr" {
  source = "../../modules/terraform-modules/modules/ecr"

  project     = var.project
  environment = var.environment
  # Web用 + Lambda用の2リポジトリを作成
  repositories = ["web", "api-lambda"]
}

# ============================
# ECS サービス（Webアプリ）
# ============================
module "ecs_web" {
  source = "../../modules/terraform-modules/modules/ecs-service"

  project            = var.project
  environment        = var.environment
  service_name       = "web"
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  private_subnet_ids = module.vpc.private_subnet_ids
  ecr_repository_url = module.ecr.repository_urls["web"]
  container_port     = 3000
  desired_count      = 2
  cpu                = 512
  memory             = 1024
}

# ============================
# Lambda コンテナ（API）
# ============================
module "lambda_api" {
  source = "../../modules/terraform-modules/modules/lambda-container"

  project            = var.project
  environment        = var.environment
  function_name      = "api"
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  ecr_repository_url = module.ecr.repository_urls["api-lambda"]
  memory_size        = 512
  timeout            = 30
}

output "web_url" {
  value = module.ecs_web.app_url
}

output "api_endpoint" {
  value = module.lambda_api.function_url
}`,
    tips: [
      "source にはサブモジュールのローカルパスを指定（Git URL ではない）",
      "同じモジュールを別パラメータで複数回呼び出して複数サービスを構築",
      "モジュール側で variable / output を統一しておくと使い回しが楽",
    ],
  },
  {
    title: "サブモジュールのバージョン管理 & 更新フロー",
    description:
      "共通モジュールのバージョン固定・アップデート・CI/CD での自動取得など、チーム開発で必要な運用フローを解説します。",
    code: `# ============================
# バージョン管理の戦略
# ============================

# 方法1: Git タグでバージョン固定（推奨）
# $ cd modules/terraform-modules
# $ git fetch --tags
# $ git checkout v1.3.0      # 特定バージョンに固定
# $ cd ../..
# $ git add modules/terraform-modules
# $ git commit -m "chore: update terraform-modules to v1.3.0"

# 方法2: 特定のコミットハッシュで固定
# $ cd modules/terraform-modules
# $ git checkout abc1234
# $ cd ../..
# $ git add modules/terraform-modules
# $ git commit -m "chore: pin terraform-modules to abc1234"

# ============================
# サブモジュールの更新手順
# ============================

# 最新に更新
# $ git submodule update --remote modules/terraform-modules

# 全サブモジュールを一括更新
# $ git submodule update --remote --merge

# 更新後は差分を確認してコミット
# $ git diff modules/terraform-modules
# $ git add modules/terraform-modules
# $ git commit -m "chore: update terraform-modules to latest"

# ============================
# CI/CD パイプラインでの取得
# ============================

# GitHub Actions の例:
# jobs:
#   deploy:
#     steps:
#       - uses: actions/checkout@v4
#         with:
#           submodules: recursive  # ← これが重要！
#
#       - name: Setup Terraform
#         uses: hashicorp/setup-terraform@v3
#
#       - name: Terraform Init
#         working-directory: ./infra
#         run: terraform init
#
#       - name: Terraform Plan
#         working-directory: ./infra
#         run: terraform plan

# ============================
# サブモジュール vs Terraform Registry vs Git URL
# ============================

# 【サブモジュール】
# source = "../../modules/terraform-modules/modules/vpc"
# ✅ オフラインで動作、バージョン完全固定
# ✅ プライベートリポジトリでも認証不要（クローン済み）
# ⚠️ git submodule update を忘れると古いまま

# 【Terraform Registry】
# source  = "terraform-aws-modules/vpc/aws"
# version = "5.0.0"
# ✅ 公式・コミュニティモジュールが豊富
# ⚠️ プライベートモジュールには Terraform Cloud が必要

# 【Git URL 直接参照】
# source = "git::https://github.com/org/modules.git//vpc?ref=v1.0.0"
# ✅ サブモジュール管理が不要
# ⚠️ init 時に毎回ダウンロード、認証設定が必要`,
    tips: [
      "Git タグでバージョン固定し、意図しないモジュール変更を防止",
      "CI/CD では submodules: recursive オプションを忘れずに設定",
      "git submodule update --remote で最新版を取得後、plan で差分確認してからコミット",
      "サブモジュール・Registry・Git URL の使い分けはチーム規模と要件で判断",
    ],
    warnings: [
      "サブモジュールの更新を忘れると古いモジュールのままデプロイされるリスクがある",
      "CI/CD で submodules オプションを指定しないとサブモジュールが空のままになる",
    ],
  },
];

const architectureDiagram = `
┌─────────────────────────────────────────────────────────────┐
│                        VPC (10.0.0.0/16)                     │
│                                                               │
│  ┌──────────── Public Subnets ────────────┐                  │
│  │                                         │                  │
│  │  ┌─────────────┐  ┌────────────────┐   │                  │
│  │  │     ALB      │  │  NAT Gateway   │   │                  │
│  │  │  (port 80)   │  │                │   │                  │
│  │  └──────┬───────┘  └───────┬────────┘   │                  │
│  │         │                  │             │                  │
│  └─────────┼──────────────────┼─────────────┘                  │
│            │                  │                                │
│  ┌─────────┼──── Private Subnets ──────────┐                  │
│  │         │                  │              │                  │
│  │         ▼                  │              │                  │
│  │  ┌─────────────────┐      │              │                  │
│  │  │  ECS Service     │      │              │                  │
│  │  │  ┌─────┐┌─────┐ │      │              │                  │
│  │  │  │Task1││Task2│ │      │              │                  │
│  │  │  │ Web ││ Web │ │      │              │                  │
│  │  │  └─────┘└─────┘ │      │              │                  │
│  │  └─────────────────┘      │              │                  │
│  │                           │              │                  │
│  │  ┌─────────────────┐      │              │                  │
│  │  │  Lambda          │◄─────┘ (NAT経由)   │                  │
│  │  │  (Container)     │                    │                  │
│  │  └────────┬─────────┘                    │                  │
│  │           │                              │                  │
│  └───────────┼──────────────────────────────┘                  │
│              │                                                │
└──────────────┼────────────────────────────────────────────────┘
               │
               ▼
        ┌──────────────┐     ┌──────────────┐
        │ API Gateway   │     │     ECR      │
        │ (HTTP API)    │     │ (イメージ)   │
        └──────────────┘     └──────────────┘
`;

const deployFlow = [
  {
    step: "1",
    title: "VPC構築",
    desc: "ネットワーク基盤を terraform apply で作成",
    color: "bg-blue-600",
  },
  {
    step: "2",
    title: "ECR作成",
    desc: "コンテナレジストリを作成",
    color: "bg-orange-500",
  },
  {
    step: "3",
    title: "イメージ登録",
    desc: "docker build & push でECRにイメージを登録",
    color: "bg-amber-600",
  },
  {
    step: "4",
    title: "ECSクラスター構築",
    desc: "クラスター・タスク定義・サービスを作成",
    color: "bg-cyan-600",
  },
  {
    step: "5",
    title: "Lambda登録",
    desc: "コンテナイメージからLambda関数を作成",
    color: "bg-green-600",
  },
  {
    step: "6",
    title: "API Gateway接続",
    desc: "LambdaをAPI Gatewayで公開",
    color: "bg-purple-600",
  },
  {
    step: "7",
    title: "動作確認",
    desc: "ALB URL & API エンドポイントで動作確認",
    color: "bg-rose-600",
  },
];

function SectionList({
  sections,
  color,
  expandedStep,
  setExpandedStep,
}: {
  sections: Section[];
  color: string;
  expandedStep: number | null;
  setExpandedStep: (i: number | null) => void;
}) {
  return (
    <div className="space-y-4">
      {sections.map((section, i) => {
        const isOpen = expandedStep === i;
        return (
          <div
            key={section.title}
            className="bg-card border border-border rounded-xl overflow-hidden"
          >
            <button
              className="w-full flex items-center gap-4 p-5 text-left"
              onClick={() => setExpandedStep(isOpen ? null : i)}
            >
              <div
                className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center shrink-0`}
              >
                <span className="text-white text-[14px]">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px]">{section.title}</p>
                <p className="text-[13px] text-muted-foreground">
                  {section.description}
                </p>
              </div>
              {isOpen ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
              )}
            </button>
            {isOpen && (
              <div className="px-5 pb-5 space-y-4">
                <div>
                  <pre className="bg-[#1e1e2e] text-[#cdd6f4] text-[13px] p-4 rounded-lg overflow-x-auto">
                    <code>{section.code}</code>
                  </pre>
                  <div className="flex justify-end mt-2">
                    <DownloadCodeButton
                      code={section.code}
                      filename={`${section.title.replace(/[^a-zA-Z0-9\u3040-\u9fff]/g, "_").toLowerCase()}.tf`}
                    />
                  </div>
                </div>
                {section.tips && section.tips.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-[13px] text-blue-700 mb-2">Tips</p>
                    <ul className="space-y-1.5">
                      {section.tips.map((tip) => (
                        <li
                          key={tip}
                          className="text-[13px] text-blue-800 flex items-start gap-2"
                        >
                          <span className="text-blue-500 mt-0.5">*</span> {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {section.warnings && section.warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <p className="text-[13px] text-amber-700">注意</p>
                    </div>
                    <ul className="space-y-1.5">
                      {section.warnings.map((w) => (
                        <li
                          key={w}
                          className="text-[13px] text-amber-800 flex items-start gap-2"
                        >
                          <span className="text-amber-500 mt-0.5">!</span> {w}
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

export function VpcContainerPractice() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [expandedStep, setExpandedStep] = useState<number | null>(0);

  const sectionMap: Record<Tab, { sections: Section[]; color: string } | null> =
    {
      overview: null,
      vpc: { sections: vpcSections, color: "bg-blue-600" },
      ecr: { sections: ecrSections, color: "bg-orange-500" },
      ecs: { sections: ecsSections, color: "bg-cyan-600" },
      "lambda-container": {
        sections: lambdaContainerSections,
        color: "bg-amber-600",
      },
      "web-app": { sections: webAppSections, color: "bg-green-600" },
      fullstack: { sections: fullstackSections, color: "bg-rose-600" },
      operations: { sections: operationsSections, color: "bg-violet-600" },
    };

  const activeSection = sectionMap[activeTab];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1>VPC & コンテナ実践ガイド</h1>
        <p className="text-muted-foreground mt-1">
          VPC構築 → コンテナ登録 → Lambda / Webアプリ配置まで、フルスタック構成を学ぶ
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 flex-wrap">
        {tabItems.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setExpandedStep(0);
            }}
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

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Architecture diagram */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="mb-4">全体アーキテクチャ</h2>
            <pre className="bg-[#1e1e2e] text-[#cdd6f4] text-[12px] p-4 rounded-lg overflow-x-auto leading-relaxed">
              <code>{architectureDiagram}</code>
            </pre>
          </div>

          {/* Deploy flow */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="mb-4">構築フロー</h2>
            <div className="space-y-0">
              {deployFlow.map((item, i) => (
                <div
                  key={item.step}
                  className="flex items-start gap-4 p-3 rounded-lg"
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full ${item.color} text-white flex items-center justify-center text-[13px]`}
                    >
                      {item.step}
                    </div>
                    {i < deployFlow.length - 1 && (
                      <div className="w-0.5 h-8 bg-purple-200 mt-1" />
                    )}
                  </div>
                  <div className="pt-1">
                    <p className="text-[14px]">{item.title}</p>
                    <p className="text-[13px] text-muted-foreground">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Key concepts */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="mb-4">各コンポーネントの役割</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  icon: Network,
                  color: "bg-blue-600",
                  title: "VPC",
                  desc: "仮想ネットワーク。サブネット、ルートテーブル、セキュリティグループを含む",
                },
                {
                  icon: Package,
                  color: "bg-orange-500",
                  title: "ECR",
                  desc: "Dockerイメージを保存するプライベートレジストリ。脆弱性スキャン対応",
                },
                {
                  icon: Container,
                  color: "bg-cyan-600",
                  title: "ECS (Fargate)",
                  desc: "サーバーレスコンテナ実行環境。Webアプリやマイクロサービスを稼働",
                },
                {
                  icon: Zap,
                  color: "bg-amber-600",
                  title: "Lambda (Container)",
                  desc: "コンテナイメージからLambda関数を実行。10GBまでのイメージに対応",
                },
                {
                  icon: Globe,
                  color: "bg-green-600",
                  title: "API Gateway",
                  desc: "Lambda関数をHTTP APIとして公開。認証・レート制限・CORS対応",
                },
                {
                  icon: Monitor,
                  color: "bg-purple-600",
                  title: "ALB",
                  desc: "ECSサービスへのトラフィック分散。ヘルスチェック・SSL終端",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-3 p-3 bg-accent/30 rounded-lg"
                >
                  <div
                    className={`w-9 h-9 rounded-lg ${item.color} flex items-center justify-center shrink-0`}
                  >
                    <item.icon className="w-[18px] h-[18px] text-white" />
                  </div>
                  <div>
                    <p className="text-[14px]">{item.title}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Prerequisites */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="mb-4">前提条件</h2>
            <div className="space-y-2">
              {[
                "AWSアカウントと管理者権限のIAMユーザー/ロール",
                "Terraform CLI（v1.5以上）がインストール済み",
                "AWS CLI がインストール・設定済み（aws configure）",
                "Docker がインストール済み",
                "基本的なTerraformの知識（init / plan / apply）",
              ].map((prereq) => (
                <div
                  key={prereq}
                  className="flex items-center gap-2 text-[13px]"
                >
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-muted-foreground">{prereq}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cost warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <p className="text-[14px] text-amber-700">コストに関する注意</p>
            </div>
            <p className="text-[13px] text-amber-800 ml-7">
              NAT Gateway、ALB、ECS Fargate タスクは時間課金です。学習後は必ず
              terraform destroy で全リソースを削除してください。
            </p>
            <p className="text-[13px] text-amber-800 ml-7">
              Lambda + API Gateway はリクエストベース課金のため、使わなければほぼ無料です。
            </p>
          </div>
        </div>
      )}

      {/* Section content */}
      {activeSection && (
        <SectionList
          sections={activeSection.sections}
          color={activeSection.color}
          expandedStep={expandedStep}
          setExpandedStep={setExpandedStep}
        />
      )}
    </div>
  );
}
