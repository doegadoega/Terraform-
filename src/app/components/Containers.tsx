import { useState } from "react";
import {
  Container,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Globe,
  Server,
  Ship,
  Layers,
  Network,
  Shield,
  Settings,
} from "lucide-react";
import { DownloadCodeButton } from "./DownloadCodeButton";

type Tab = "overview" | "ecs" | "eks" | "gke" | "docker" | "cloudrun";

interface ServiceInfo {
  id: Tab;
  name: string;
  provider: string;
  icon: React.ElementType;
  color: string;
  description: string;
  steps: {
    title: string;
    description: string;
    code: string;
    tips?: string[];
  }[];
  architecture?: string;
  warnings?: string[];
  prerequisites?: string[];
}

const services: ServiceInfo[] = [
  {
    id: "ecs",
    name: "AWS ECS (Fargate)",
    provider: "AWS",
    icon: Cloud,
    color: "bg-[#FF9900]",
    description:
      "Amazon ECS + Fargate はサーバーレスコンテナ実行環境です。インフラ管理不要でコンテナを実行でき、最も手軽にコンテナを本番運用できます。",
    prerequisites: [
      "AWSアカウントと適切なIAM権限",
      "DockerイメージがECRまたはDocker Hubにプッシュ済み",
      "VPCとサブネットが構築済み（またはモジュールで同時作成）",
    ],
    steps: [
      {
        title: "Step 1: ECRリポジトリの作成",
        description: "Dockerイメージを保存するためのプライベートコンテナレジストリを作成します。",
        code: `# ECR リポジトリの作成
resource "aws_ecr_repository" "app" {
  name                 = "my-app"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true  # プッシュ時に脆弱性スキャン
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

# ライフサイクルポリシー（古いイメージの自動削除）
resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "最新10イメージのみ保持"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}`,
        tips: [
          "scan_on_push = true で脆弱性の自動スキャンが有効に",
          "ライフサイクルポリシーで不要なイメージを自動削除しコスト削減",
        ],
      },
      {
        title: "Step 2: ECSクラスターの作成",
        description: "コンテナを実行するためのECSクラスターを作成します。Fargateの場合、EC2インスタンスの管理は不要です。",
        code: `# ECS クラスターの作成
resource "aws_ecs_cluster" "main" {
  name = "my-app-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"  # CloudWatch Container Insights
  }
}

# クラスターのキャパシティプロバイダー設定
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
          "FARGATE_SPOT を使うと最大70%のコスト削減が可能（中断リスクあり）",
          "Container Insights でメトリクス・ログを一元管理",
        ],
      },
      {
        title: "Step 3: タスク定義の作成",
        description: "コンテナの設定（イメージ、CPU、メモリ、環境変数、ポート等）を定義します。Docker Composeのサービス定義に相当します。",
        code: `# タスク実行用IAMロール
resource "aws_iam_role" "ecs_task_execution" {
  name = "ecs-task-execution-role"
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

# CloudWatch ロググループ
resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/my-app"
  retention_in_days = 30
}

# タスク定義
resource "aws_ecs_task_definition" "app" {
  family                   = "my-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"   # 0.25 vCPU
  memory                   = "512"   # 512 MB
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name  = "app"
    image = "\${aws_ecr_repository.app.repository_url}:latest"
    
    portMappings = [{
      containerPort = 8080
      hostPort      = 8080
      protocol      = "tcp"
    }]
    
    environment = [
      { name = "APP_ENV", value = "production" },
      { name = "PORT",    value = "8080" },
    ]
    
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.app.name
        "awslogs-region"        = "ap-northeast-1"
        "awslogs-stream-prefix" = "ecs"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])
}`,
        tips: [
          "CPU/メモリの組み合わせには制約がある（AWS公式ドキュメント参照）",
          "Secrets Manager連携で機密情報を安全に注入可能",
          "ヘルスチェックを必ず設定し、異常コンテナの自動再起動を有効に",
        ],
      },
      {
        title: "Step 4: ALB + サービスの作成",
        description:
          "Application Load Balancerでトラフィックを受け付け、ECSサービスでコンテナの起動・管理を行います。",
        code: `# セキュリティグループ（ALB用）
resource "aws_security_group" "alb" {
  name   = "alb-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# セキュリティグループ（ECSタスク用）
resource "aws_security_group" "ecs_tasks" {
  name   = "ecs-tasks-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ALB
resource "aws_lb" "main" {
  name               = "my-app-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids
}

resource "aws_lb_target_group" "app" {
  name        = "my-app-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"  # Fargate は ip タイプ必須

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# ECS サービス
resource "aws_ecs_service" "app" {
  name            = "my-app-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = 8080
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true  # デプロイ失敗時に自動ロールバック
  }
}

output "app_url" {
  value = "http://\${aws_lb.main.dns_name}"
}`,
        tips: [
          "target_type = \"ip\" はFargate必須（EC2の場合は \"instance\"）",
          "deployment_circuit_breaker で失敗時の自動ロールバックを有効に",
          "本番ではHTTPS（ACM証明書 + リスナー443）を設定すること",
        ],
      },
    ],
    architecture: `[ユーザー] → [ALB (port 80/443)]
       ↓
  [Target Group]
       ↓
  [ECS Service (desired_count: 2)]
       ↓
  ┌─────────┐  ┌─────────┐
  │ Task 1  │  │ Task 2  │   ← Fargate (サーバーレス)
  │ Container│  │ Container│
  └─────────┘  └─────────┘
       ↓
  [ECR Repository] ← Docker イメージ保存先`,
    warnings: [
      "Fargateのコストはタスクの実行時間に比例するため、不要なタスクは停止すること",
      "ECRのイメージにはライフサイクルポリシーを設定してストレージコストを管理",
    ],
  },
  {
    id: "eks",
    name: "AWS EKS",
    provider: "AWS",
    icon: Cloud,
    color: "bg-[#FF9900]",
    description:
      "Amazon EKS はマネージドKubernetesサービスです。大規模なコンテナオーケストレーションが必要な場合や、Kubernetesエコシステムを活用したい場合に最適です。",
    prerequisites: [
      "AWSアカウントと適切なIAM権限",
      "kubectl がインストール済み",
      "VPCとサブネット（パブリック+プライベート）が構築済み",
    ],
    steps: [
      {
        title: "Step 1: EKSクラスターの作成",
        description: "Kubernetesコントロールプレーンを作成します。コミュニティモジュールを使うと効率的です。",
        code: `# 公式モジュールを使用した EKS クラスター作成
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "my-cluster"
  cluster_version = "1.29"

  vpc_id     = var.vpc_id
  subnet_ids = var.private_subnet_ids

  # クラスターエンドポイントのアクセス設定
  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  # マネージドノードグループ
  eks_managed_node_groups = {
    general = {
      instance_types = ["t3.medium"]
      min_size       = 2
      max_size       = 5
      desired_size   = 2
      
      labels = {
        role = "general"
      }
    }
    
    spot = {
      instance_types = ["t3.medium", "t3.large"]
      capacity_type  = "SPOT"  # スポットインスタンスでコスト削減
      min_size       = 0
      max_size       = 10
      desired_size   = 2
      
      labels = {
        role = "spot"
      }
      
      taints = [{
        key    = "spot"
        value  = "true"
        effect = "NO_SCHEDULE"
      }]
    }
  }

  # クラスターアドオン
  cluster_addons = {
    coredns    = { most_recent = true }
    kube-proxy = { most_recent = true }
    vpc-cni    = { most_recent = true }
  }
}

output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "cluster_name" {
  value = module.eks.cluster_name
}`,
        tips: [
          "terraform-aws-modules/eks/aws モジュールで大幅に簡素化",
          "Fargateプロファイルを使えばノード管理も不要に",
          "スポットインスタンスで最大90%のコスト削減が可能",
        ],
      },
      {
        title: "Step 2: kubeconfigの設定 & アプリデプロイ",
        description: "EKSクラスターに接続し、Kubernetesプロバイダーでアプリケーションをデプロイします。",
        code: `# kubeconfig 更新コマンド
# $ aws eks update-kubeconfig --name my-cluster --region ap-northeast-1

# Kubernetes プロバイダー設定
provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

# Deployment
resource "kubernetes_deployment_v1" "app" {
  metadata {
    name      = "my-app"
    namespace = "default"
  }

  spec {
    replicas = 3

    selector {
      match_labels = { app = "my-app" }
    }

    template {
      metadata {
        labels = { app = "my-app" }
      }

      spec {
        container {
          name  = "app"
          image = "\${aws_ecr_repository.app.repository_url}:latest"

          port {
            container_port = 8080
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }
        }
      }
    }
  }
}

# Service (LoadBalancer)
resource "kubernetes_service_v1" "app" {
  metadata {
    name      = "my-app"
    namespace = "default"
    annotations = {
      "service.beta.kubernetes.io/aws-load-balancer-type" = "nlb"
    }
  }

  spec {
    selector = { app = "my-app" }
    type     = "LoadBalancer"

    port {
      port        = 80
      target_port = 8080
    }
  }
}`,
        tips: [
          "Helm プロバイダーと併用してチャートのデプロイも可能",
          "AWS Load Balancer Controller を使うとALB/NLBの管理が容易",
        ],
      },
    ],
    warnings: [
      "EKSクラスターは時間あたりの課金（$0.10/h）があるため、不要なクラスターは削除すること",
      "ノードグループの最小サイズを0にすると完全にスケールインできる",
    ],
  },
  {
    id: "gke",
    name: "Google GKE",
    provider: "GCP",
    icon: Globe,
    color: "bg-[#4285F4]",
    description:
      "Google Kubernetes Engine はGCPのマネージドKubernetesサービスです。Autopilotモードではノード管理も完全に自動化されます。",
    prerequisites: [
      "GCPプロジェクトと適切なIAM権限",
      "Kubernetes Engine APIが有効化済み",
      "gcloud CLIがインストール済み",
    ],
    steps: [
      {
        title: "Step 1: GKEクラスターの作成",
        description: "GKEクラスターをAutopilotモードまたはStandardモードで作成します。",
        code: `# GKE Autopilot クラスター（推奨）
resource "google_container_cluster" "primary" {
  name     = "my-gke-cluster"
  location = "asia-northeast1"

  # Autopilot モード（ノード管理不要）
  enable_autopilot = true

  # ネットワーク設定
  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.subnet.name

  # プライベートクラスター設定
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  # リリースチャネル
  release_channel {
    channel = "REGULAR"
  }
}

# VPC
resource "google_compute_network" "vpc" {
  name                    = "gke-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = "gke-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = "asia-northeast1"
  network       = google_compute_network.vpc.id

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.1.0.0/16"
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.2.0.0/16"
  }
}

# kubeconfig 更新
# $ gcloud container clusters get-credentials my-gke-cluster \\
#     --region asia-northeast1

output "cluster_endpoint" {
  value = google_container_cluster.primary.endpoint
}`,
        tips: [
          "Autopilotモードではノードの管理が完全に自動化される",
          "StandardモードではNode Poolを細かくカスタマイズ可能",
          "リリースチャネルでK8sバージョンの自動アップグレードを管理",
        ],
      },
      {
        title: "Step 2: Cloud Run との比較（サーバーレス）",
        description: "シンプルなコンテナ実行であればCloud Runの方が手軽な場合もあります。",
        code: `# Cloud Run（よりシンプルなコンテナ実行）
resource "google_cloud_run_v2_service" "app" {
  name     = "my-app"
  location = "asia-northeast1"

  template {
    containers {
      image = "asia-northeast1-docker.pkg.dev/\${var.project_id}/my-repo/my-app:latest"

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "APP_ENV"
        value = "production"
      }
    }

    scaling {
      min_instance_count = 0  # ゼロスケール可能
      max_instance_count = 10
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# 公開アクセスを許可
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.app.name
  location = google_cloud_run_v2_service.app.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

output "service_url" {
  value = google_cloud_run_v2_service.app.uri
}`,
        tips: [
          "Cloud Runはリクエストベースの課金でアイドル時はコストゼロ",
          "GKEはより複雑なワークロードやステートフルアプリに適している",
          "Artifact Registryにイメージを保存するのが推奨",
        ],
      },
    ],
    warnings: [
      "GKE Autopilotはリソース要求に基づく課金のため、リソースの指定を最適化すること",
    ],
  },
  {
    id: "docker",
    name: "Docker (ローカル)",
    provider: "Docker",
    icon: Ship,
    color: "bg-[#2496ED]",
    description:
      "ローカル環境やテスト環境でDockerコンテナをTerraformで管理します。開発環境の自動構築やCI/CDでのテスト環境構築に活用できます。",
    prerequisites: [
      "Dockerがインストール済みで起動中",
      "docker.sock へのアクセス権限",
    ],
    steps: [
      {
        title: "Step 1: Docker プロバイダーの設定",
        description: "ローカルのDockerデーモンに接続し、コンテナ・ネットワーク・ボリュームを管理します。",
        code: `terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "docker" {
  host = "unix:///var/run/docker.sock"
}

# Docker ネットワーク
resource "docker_network" "app_network" {
  name = "app-network"
}

# Docker ボリューム
resource "docker_volume" "db_data" {
  name = "db-data"
}`,
      },
      {
        title: "Step 2: アプリ + DB のコンテナ構成",
        description: "Docker Compose のように、複数コンテナを定義してアプリケーション環境を構築します。",
        code: `# PostgreSQL コンテナ
resource "docker_image" "postgres" {
  name         = "postgres:16-alpine"
  keep_locally = false
}

resource "docker_container" "db" {
  name  = "app-db"
  image = docker_image.postgres.image_id

  networks_advanced {
    name = docker_network.app_network.name
  }

  volumes {
    volume_name    = docker_volume.db_data.name
    container_path = "/var/lib/postgresql/data"
  }

  env = [
    "POSTGRES_DB=myapp",
    "POSTGRES_USER=admin",
    "POSTGRES_PASSWORD=secret123",
  ]

  ports {
    internal = 5432
    external = 5432
  }

  healthcheck {
    test     = ["CMD-SHELL", "pg_isready -U admin"]
    interval = "10s"
    timeout  = "5s"
    retries  = 5
  }
}

# アプリケーションコンテナ
resource "docker_image" "app" {
  name         = "nginx:alpine"
  keep_locally = false
}

resource "docker_container" "app" {
  name  = "app-web"
  image = docker_image.app.image_id

  networks_advanced {
    name = docker_network.app_network.name
  }

  ports {
    internal = 80
    external = 8080
  }

  env = [
    "DATABASE_URL=postgresql://admin:secret123@app-db:5432/myapp",
  ]

  # DB コンテナが起動してから起動
  depends_on = [docker_container.db]
}

output "app_url" {
  value = "http://localhost:8080"
}

output "db_port" {
  value = "localhost:5432"
}`,
        tips: [
          "depends_on で起動順序を制御",
          "ボリュームでデータを永続化",
          "ネットワークでコンテナ間通信を実現",
          "開発環境のセットアップスクリプトの代替として活用",
        ],
      },
    ],
    warnings: ["パスワードのハードコードは開発環境のみ。本番では Secrets Manager 等を使用すること"],
  },
];

const overviewComparison = [
  {
    service: "AWS ECS (Fargate)",
    complexity: "中",
    cost: "中",
    scalability: "高",
    useCase: "AWS環境でシンプルにコンテナを運用したい",
    managed: "フルマネージド",
  },
  {
    service: "AWS EKS",
    complexity: "高",
    cost: "高",
    scalability: "非常に高",
    useCase: "K8sエコシステムを活用した大規模運用",
    managed: "コントロールプレーンのみ",
  },
  {
    service: "Google GKE",
    complexity: "中〜高",
    cost: "中〜高",
    scalability: "非常に高",
    useCase: "GCPでK8sを運用、Autopilotで簡素化",
    managed: "Autopilotはフルマネージド",
  },
  {
    service: "Google Cloud Run",
    complexity: "低",
    cost: "低",
    scalability: "高",
    useCase: "シンプルなHTTPコンテナをサーバーレスで",
    managed: "フルマネージド",
  },
  {
    service: "Docker (ローカル)",
    complexity: "低",
    cost: "無料",
    scalability: "低",
    useCase: "ローカル開発・テスト環境",
    managed: "セルフ管理",
  },
];

const containerWorkflow = [
  { step: "1. Dockerfile作成", desc: "アプリのコンテナイメージを定義" },
  { step: "2. イメージビルド", desc: "docker build でイメージを作成" },
  { step: "3. レジストリにプッシュ", desc: "ECR/GCR/Docker Hub にアップロード" },
  { step: "4. Terraformで定義", desc: "クラスター・サービス・タスクをHCLで記述" },
  { step: "5. terraform apply", desc: "インフラとコンテナをデプロイ" },
  { step: "6. 監視・スケーリング", desc: "オートスケーリングとログ監視を設定" },
];

export function Containers() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [expandedStep, setExpandedStep] = useState<number | null>(0);

  const activeService = services.find((s) => s.id === activeTab);

  const tabs: { id: Tab; label: string; icon: React.ElementType; color: string }[] = [
    { id: "overview", label: "概要", icon: Layers, color: "bg-purple-600" },
    { id: "ecs", label: "ECS (Fargate)", icon: Cloud, color: "bg-[#FF9900]" },
    { id: "eks", label: "EKS", icon: Cloud, color: "bg-[#FF9900]" },
    { id: "gke", label: "GKE / Cloud Run", icon: Globe, color: "bg-[#4285F4]" },
    { id: "docker", label: "Docker", icon: Ship, color: "bg-[#2496ED]" },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1>コンテナ構築手順</h1>
        <p className="text-muted-foreground mt-1">
          Terraformでコンテナサービスを構築するステップバイステップガイド
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
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

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Workflow */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="mb-4">コンテナデプロイの一般的な流れ</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {containerWorkflow.map((item, i) => (
                <div key={item.step} className="flex items-start gap-3 p-3 bg-accent/30 rounded-lg">
                  <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-[12px] shrink-0">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-[13px]">{item.step}</p>
                    <p className="text-[12px] text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comparison Table */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="mb-4">サービス比較</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2">サービス</th>
                    <th className="text-left py-3 px-2">複雑さ</th>
                    <th className="text-left py-3 px-2">コスト</th>
                    <th className="text-left py-3 px-2">拡張性</th>
                    <th className="text-left py-3 px-2">管理レベル</th>
                    <th className="text-left py-3 px-2">ユースケース</th>
                  </tr>
                </thead>
                <tbody>
                  {overviewComparison.map((row) => (
                    <tr key={row.service} className="border-b border-border last:border-0">
                      <td className="py-3 px-2 text-purple-600">{row.service}</td>
                      <td className="py-3 px-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] ${
                            row.complexity === "低"
                              ? "bg-green-100 text-green-700"
                              : row.complexity === "中" || row.complexity === "中〜高"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {row.complexity}
                        </span>
                      </td>
                      <td className="py-3 px-2">{row.cost}</td>
                      <td className="py-3 px-2">{row.scalability}</td>
                      <td className="py-3 px-2">{row.managed}</td>
                      <td className="py-3 px-2 text-muted-foreground">{row.useCase}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Decision Guide */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="mb-4">選び方ガイド</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] text-green-800">シンプルにコンテナを動かしたい → <strong>ECS Fargate</strong> or <strong>Cloud Run</strong></p>
                  <p className="text-[12px] text-green-700">サーバー管理不要、最小限の設定で本番運用可能</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Container className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] text-blue-800">K8sエコシステムを活用したい → <strong>EKS</strong> or <strong>GKE</strong></p>
                  <p className="text-[12px] text-blue-700">Helm, Istio, ArgoCD等のK8sツール群が使える</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <Settings className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] text-purple-800">ローカル開発・テスト → <strong>Docker プロバイダー</strong></p>
                  <p className="text-[12px] text-purple-700">チームで統一した開発環境を自動構築</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Service Detail Tabs */}
      {activeService && (
        <div className="space-y-6">
          {/* Service Header */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-11 h-11 rounded-xl ${activeService.color} flex items-center justify-center`}>
                <activeService.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2>{activeService.name}</h2>
                <span className="text-[12px] text-muted-foreground">{activeService.provider}</span>
              </div>
            </div>
            <p className="text-[14px] text-muted-foreground leading-relaxed">{activeService.description}</p>

            {activeService.prerequisites && (
              <div className="mt-4">
                <p className="text-[13px] mb-2">前提条件</p>
                <ul className="space-y-1">
                  {activeService.prerequisites.map((p) => (
                    <li key={p} className="text-[13px] text-muted-foreground flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Architecture Diagram */}
          {activeService.architecture && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="mb-3">アーキテクチャ</h3>
              <pre className="bg-[#1e1e2e] text-[#cdd6f4] text-[13px] p-4 rounded-lg overflow-x-auto">
                <code>{activeService.architecture}</code>
              </pre>
            </div>
          )}

          {/* Steps */}
          <div className="space-y-4">
            {activeService.steps.map((step, i) => {
              const isOpen = expandedStep === i;
              return (
                <div key={step.title} className="bg-card border border-border rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center gap-4 p-5 text-left"
                    onClick={() => setExpandedStep(isOpen ? null : i)}
                  >
                    <div className={`w-9 h-9 rounded-lg ${activeService.color} flex items-center justify-center shrink-0`}>
                      <span className="text-white text-[14px]">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px]">{step.title}</p>
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
                      <div>
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Warnings */}
          {activeService.warnings && activeService.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <p className="text-[14px] text-amber-700">注意事項</p>
              </div>
              {activeService.warnings.map((w) => (
                <p key={w} className="text-[13px] text-amber-800 ml-7">
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
