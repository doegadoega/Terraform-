import { useState } from "react";
import {
  Globe,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Server,
  Map,
  Copy,
  Check,
  ArrowLeftRight,
  Shield,
  Database,
  Layers,
  Zap,
  Network,
} from "lucide-react";
import { DownloadCodeButton } from "./DownloadCodeButton";

type Tab = "overview" | "aws" | "azure" | "gcp" | "patterns" | "testing";

interface RegionGuide {
  id: Tab;
  label: string;
  icon: React.ElementType;
  color: string;
}

const tabs: RegionGuide[] = [
  { id: "overview", label: "概要", icon: Globe, color: "bg-purple-600" },
  { id: "aws", label: "AWS", icon: Cloud, color: "bg-[#FF9900]" },
  { id: "azure", label: "Azure", icon: Server, color: "bg-[#0078D4]" },
  { id: "gcp", label: "GCP", icon: Globe, color: "bg-[#4285F4]" },
  { id: "patterns", label: "設計パターン", icon: Layers, color: "bg-teal-500" },
  { id: "testing", label: "動作確認手順", icon: CheckCircle2, color: "bg-green-600" },
];

// ---- Overview ----
const whyMultiRegion = [
  {
    icon: Shield,
    title: "災害対策（DR）",
    desc: "リージョン障害時にトラフィックを別リージョンにフェイルオーバーし、サービスの継続性を確保",
  },
  {
    icon: Zap,
    title: "レイテンシ改善",
    desc: "ユーザーに近いリージョンからコンテンツを配信し、応答時間を短縮",
  },
  {
    icon: CheckCircle2,
    title: "動作確認・テスト",
    desc: "本番と同一構成を別リージョンに展開して、リージョン依存の問題を事前に検出",
  },
  {
    icon: Database,
    title: "データレジデンシー",
    desc: "法規制（GDPR等）に準拠するため、データを特定の地域内に保持",
  },
  {
    icon: Network,
    title: "コスト最適化",
    desc: "リージョンごとの料金差を活用し、開発/テスト環境を安価なリージョンに配置",
  },
];

const regionList = {
  aws: [
    { code: "ap-northeast-1", name: "東京", note: "日本向けメイン" },
    { code: "ap-northeast-3", name: "大阪", note: "DR用（東京のバックアップ）" },
    { code: "us-east-1", name: "バージニア北部", note: "最も安価・サービス最多" },
    { code: "us-west-2", name: "オレゴン", note: "米国向けバックアップ" },
    { code: "eu-west-1", name: "アイルランド", note: "欧州向けメイン" },
    { code: "ap-southeast-1", name: "シンガポール", note: "東南アジア向け" },
  ],
  azure: [
    { code: "japaneast", name: "東日本", note: "日本向けメイン" },
    { code: "japanwest", name: "西日本", note: "DR用" },
    { code: "eastus", name: "米国東部", note: "最も安価" },
    { code: "westeurope", name: "西ヨーロッパ", note: "欧州向け" },
  ],
  gcp: [
    { code: "asia-northeast1", name: "東京", note: "日本向けメイン" },
    { code: "asia-northeast2", name: "大阪", note: "DR用" },
    { code: "us-central1", name: "アイオワ", note: "最も安価" },
    { code: "europe-west1", name: "ベルギー", note: "欧州向け" },
  ],
};

// ---- Sections data ----
interface Section {
  title: string;
  description: string;
  code: string;
  tips?: string[];
  warnings?: string[];
}

const awsSections: Section[] = [
  {
    title: "Step 1: Provider Alias でマルチリージョン設定",
    description:
      "同一プロバイダーの alias を使い、複数のリージョンを同時に管理します。デフォルトプロバイダーと alias 付きプロバイダーを組み合わせるのが基本パターンです。",
    code: `# providers.tf
provider "aws" {
  region = "ap-northeast-1"  # 東京（メインリージョン）
  
  default_tags {
    tags = {
      ManagedBy   = "Terraform"
      Environment = var.environment
    }
  }
}

# 大阪リージョン（DR用）
provider "aws" {
  alias  = "osaka"
  region = "ap-northeast-3"
  
  default_tags {
    tags = {
      ManagedBy   = "Terraform"
      Environment = var.environment
      Role        = "DR"
    }
  }
}

# バージニア（CloudFront証明書用・テスト用）
provider "aws" {
  alias  = "virginia"
  region = "us-east-1"
}`,
    tips: [
      "alias なしのプロバイダーがデフォルトリージョンになる",
      "リソースで provider = aws.osaka のように指定して使い分ける",
      "モジュールに渡す場合は providers ブロックで指定",
    ],
  },
  {
    title: "Step 2: 変数でリージョンを切り替え可能にする",
    description:
      "環境変数や tfvars でリージョンを切り替えられるようにすることで、同じコードで異なるリージョンにデプロイできます。",
    code: `# variables.tf
variable "primary_region" {
  description = "プライマリリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "dr_region" {
  description = "DRリージョン"
  type        = string
  default     = "ap-northeast-3"
}

variable "environment" {
  description = "環境名"
  type        = string
  default     = "dev"
}

# リージョンごとの設定マップ
variable "region_config" {
  description = "リージョンごとの設定"
  type = map(object({
    instance_type    = string
    desired_capacity = number
    ami_id           = string
  }))
  default = {
    "ap-northeast-1" = {
      instance_type    = "t3.micro"
      desired_capacity = 2
      ami_id           = "ami-0abcdef1234567890"
    }
    "ap-northeast-3" = {
      instance_type    = "t3.micro"
      desired_capacity = 1
      ami_id           = "ami-0fedcba9876543210"
    }
    "us-east-1" = {
      instance_type    = "t3.micro"
      desired_capacity = 2
      ami_id           = "ami-0123456789abcdef0"
    }
  }
}

# terraform.tfvars（環境別）
# --- dev.tfvars ---
# primary_region = "us-east-1"
# environment    = "dev"
#
# --- prod.tfvars ---
# primary_region = "ap-northeast-1"
# dr_region      = "ap-northeast-3"
# environment    = "prod"`,
    tips: [
      "AMI IDはリージョンごとに異なるので注意",
      "data source で最新AMIを動的に取得するのが安全",
      "terraform plan -var-file=dev.tfvars で環境切り替え",
    ],
  },
  {
    title: "Step 3: リソースを別リージョンにデプロイ",
    description:
      "provider 引数を使って、特定のリソースを別リージョンに作成します。VPC、サブネット、EC2など基本的なリソースの例です。",
    code: `# 東京リージョン（デフォルト）
resource "aws_vpc" "tokyo" {
  cidr_block = "10.0.0.0/16"
  tags       = { Name = "tokyo-vpc" }
}

resource "aws_instance" "tokyo_web" {
  ami           = var.region_config["ap-northeast-1"].ami_id
  instance_type = var.region_config["ap-northeast-1"].instance_type
  subnet_id     = aws_subnet.tokyo_public.id
  tags          = { Name = "tokyo-web" }
}

# 大阪リージョン（DR）
resource "aws_vpc" "osaka" {
  provider   = aws.osaka  # ← alias指定
  cidr_block = "10.1.0.0/16"
  tags       = { Name = "osaka-vpc" }
}

resource "aws_instance" "osaka_web" {
  provider      = aws.osaka
  ami           = var.region_config["ap-northeast-3"].ami_id
  instance_type = var.region_config["ap-northeast-3"].instance_type
  subnet_id     = aws_subnet.osaka_public.id
  tags          = { Name = "osaka-web" }
}

# バージニア（CloudFront用ACM証明書）
resource "aws_acm_certificate" "cert" {
  provider          = aws.virginia  # CloudFrontはus-east-1必須
  domain_name       = "example.com"
  validation_method = "DNS"
}`,
    tips: [
      "provider を指定しないリソースはデフォルトプロバイダーを使用",
      "CloudFrontの証明書は必ず us-east-1 に作成する必要がある",
      "セキュリティグループはリージョンごとに別途作成が必要",
    ],
    warnings: [
      "リージョン間でVPC IDやサブネットIDは共有できない",
      "AMI IDはリージョンごとに異なるため、ハードコードに注意",
    ],
  },
  {
    title: "Step 4: モジュールでマルチリージョン対応",
    description:
      "同一モジュールを異なるプロバイダーで呼び出すことで、リージョンごとに同じ構成を展開できます。",
    code: `# modules/web-stack/variables.tf
variable "vpc_cidr" { type = string }
variable "environment" { type = string }
variable "instance_type" { type = string }

# modules/web-stack/main.tf
resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr
  tags       = { Name = "\${var.environment}-vpc" }
}
# ... 他のリソース定義 ...

# ルートモジュールでの呼び出し
# 東京リージョン
module "tokyo_stack" {
  source        = "./modules/web-stack"
  vpc_cidr      = "10.0.0.0/16"
  environment   = "prod-tokyo"
  instance_type = "t3.medium"
  
  # デフォルトプロバイダーを使用（東京）
}

# 大阪リージョン
module "osaka_stack" {
  source        = "./modules/web-stack"
  vpc_cidr      = "10.1.0.0/16"
  environment   = "prod-osaka"
  instance_type = "t3.small"

  providers = {
    aws = aws.osaka  # ← モジュール内のawsプロバイダーを差し替え
  }
}

# バージニアリージョン（テスト環境）
module "virginia_stack" {
  source        = "./modules/web-stack"
  vpc_cidr      = "10.2.0.0/16"
  environment   = "test-virginia"
  instance_type = "t3.micro"

  providers = {
    aws = aws.virginia
  }
}`,
    tips: [
      "providers ブロックでモジュール内のプロバイダーを差し替え",
      "モジュール内では provider 指定不要（ルートで切り替え）",
      "同じモジュールを使うことで環境間の構成差異を最小化",
    ],
  },
  {
    title: "Step 5: Route 53 によるリージョン間トラフィック管理",
    description:
      "Route 53のヘルスチェック＋フェイルオーバールーティングで、リージョン障害時に自動切り替えを実現します。",
    code: `# プライマリリージョンのヘルスチェック
resource "aws_route53_health_check" "tokyo" {
  fqdn              = module.tokyo_stack.alb_dns_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 30

  tags = { Name = "tokyo-health-check" }
}

# フェイルオーバーレコード（プライマリ）
resource "aws_route53_record" "primary" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "app.example.com"
  type    = "A"

  alias {
    name                   = module.tokyo_stack.alb_dns_name
    zone_id                = module.tokyo_stack.alb_zone_id
    evaluate_target_health = true
  }

  failover_routing_policy {
    type = "PRIMARY"
  }

  set_identifier  = "primary"
  health_check_id = aws_route53_health_check.tokyo.id
}

# フェイルオーバーレコード（セカンダリ）
resource "aws_route53_record" "secondary" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "app.example.com"
  type    = "A"

  alias {
    name                   = module.osaka_stack.alb_dns_name
    zone_id                = module.osaka_stack.alb_zone_id
    evaluate_target_health = true
  }

  failover_routing_policy {
    type = "SECONDARY"
  }

  set_identifier = "secondary"
}

# レイテンシベースルーティング（地理的に近いリージョンへ）
resource "aws_route53_record" "latency_tokyo" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "api.example.com"
  type    = "A"

  alias {
    name                   = module.tokyo_stack.alb_dns_name
    zone_id                = module.tokyo_stack.alb_zone_id
    evaluate_target_health = true
  }

  latency_routing_policy {
    region = "ap-northeast-1"
  }

  set_identifier = "tokyo"
}`,
    tips: [
      "フェイルオーバー: プライマリ障害時にセカンダリへ自動切替",
      "レイテンシベース: ユーザーに最も近いリージョンへルーティング",
      "加重ルーティング: トラフィックを割合で分散（カナリアデプロイ）",
    ],
  },
];

const azureSections: Section[] = [
  {
    title: "Step 1: マルチリージョンプロバイダー設定",
    description: "Azureでは location パラメータでリージョンを指定します。リソースグループ単位でリージョンを分けるのが一般的です。",
    code: `provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

# リージョンごとのリソースグループ
resource "azurerm_resource_group" "japan_east" {
  name     = "rg-myapp-japaneast"
  location = "japaneast"
}

resource "azurerm_resource_group" "japan_west" {
  name     = "rg-myapp-japanwest"
  location = "japanwest"
}

# 東日本リージョン
resource "azurerm_app_service_plan" "japan_east" {
  name                = "asp-myapp-japaneast"
  location            = azurerm_resource_group.japan_east.location
  resource_group_name = azurerm_resource_group.japan_east.name
  
  sku {
    tier = "Standard"
    size = "S1"
  }
}

# 西日本リージョン（DR）
resource "azurerm_app_service_plan" "japan_west" {
  name                = "asp-myapp-japanwest"
  location            = azurerm_resource_group.japan_west.location
  resource_group_name = azurerm_resource_group.japan_west.name
  
  sku {
    tier = "Standard"
    size = "S1"
  }
}`,
    tips: [
      "Azureは provider alias より location パラメータで制御するのが一般的",
      "Traffic Manager でリージョン間のトラフィック管理が可能",
      "Azure Front Door でグローバル負荷分散も実現可能",
    ],
  },
  {
    title: "Step 2: Traffic Manager によるフェイルオーバー",
    description: "Azure Traffic Manager を使ってリージョン間のトラフィックルーティングとフェイルオーバーを設定します。",
    code: `# Traffic Manager プロファイル
resource "azurerm_traffic_manager_profile" "main" {
  name                = "tm-myapp"
  resource_group_name = azurerm_resource_group.japan_east.name

  traffic_routing_method = "Priority"  # Priority / Weighted / Performance

  dns_config {
    relative_name = "myapp"
    ttl           = 60
  }

  monitor_config {
    protocol                     = "HTTPS"
    port                         = 443
    path                         = "/health"
    interval_in_seconds          = 30
    timeout_in_seconds           = 10
    tolerated_number_of_failures = 3
  }
}

# プライマリエンドポイント（東日本）
resource "azurerm_traffic_manager_azure_endpoint" "primary" {
  name               = "primary-japaneast"
  profile_id         = azurerm_traffic_manager_profile.main.id
  target_resource_id = azurerm_app_service.japan_east.id
  priority           = 1
}

# セカンダリエンドポイント（西日本）
resource "azurerm_traffic_manager_azure_endpoint" "secondary" {
  name               = "secondary-japanwest"
  profile_id         = azurerm_traffic_manager_profile.main.id
  target_resource_id = azurerm_app_service.japan_west.id
  priority           = 2
}`,
    tips: [
      "Priority: 優先度ベースのフェイルオーバー",
      "Performance: レイテンシベースの��ーティング",
      "Weighted: 重み付けによるトラフィック分散",
    ],
  },
];

const gcpSections: Section[] = [
  {
    title: "Step 1: マルチリージョン設定",
    description: "GCPでは provider の region/zone を切り替えるか、リソースごとに location を指定します。",
    code: `provider "google" {
  project = var.project_id
  region  = "asia-northeast1"  # 東京
  zone    = "asia-northeast1-a"
}

provider "google" {
  alias   = "osaka"
  project = var.project_id
  region  = "asia-northeast2"
  zone    = "asia-northeast2-a"
}

# 東京リージョン
resource "google_compute_instance" "tokyo" {
  name         = "web-tokyo"
  machine_type = "e2-medium"
  zone         = "asia-northeast1-a"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }

  network_interface {
    network = google_compute_network.vpc.id
  }
}

# 大阪リージョン
resource "google_compute_instance" "osaka" {
  provider     = google.osaka
  name         = "web-osaka"
  machine_type = "e2-medium"
  zone         = "asia-northeast2-a"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }

  network_interface {
    network = google_compute_network.vpc.id
  }
}`,
    tips: [
      "GCPのVPCはグローバルリソースのため、リージョン跨ぎが容易",
      "サブネットはリージョナルだ���、同一VPC内の別リージョンと自動通信可能",
    ],
  },
  {
    title: "Step 2: Cloud Load Balancing でグローバル分散",
    description: "GCPのグローバルHTTPロードバランサーは自動的にユーザーに最も近いリージョンへルーティングします。",
    code: `# マネージドインスタンスグループ（東京）
resource "google_compute_region_instance_group_manager" "tokyo" {
  name               = "mig-tokyo"
  base_instance_name = "web"
  region             = "asia-northeast1"
  target_size        = 2

  version {
    instance_template = google_compute_instance_template.web.id
  }

  named_port {
    name = "http"
    port = 8080
  }
}

# マネージドインスタンスグループ（大阪）
resource "google_compute_region_instance_group_manager" "osaka" {
  provider           = google.osaka
  name               = "mig-osaka"
  base_instance_name = "web"
  region             = "asia-northeast2"
  target_size        = 2

  version {
    instance_template = google_compute_instance_template.web.id
  }

  named_port {
    name = "http"
    port = 8080
  }
}

# グローバル HTTP ロードバランサー
resource "google_compute_global_address" "default" {
  name = "lb-global-ip"
}

resource "google_compute_backend_service" "default" {
  name                  = "web-backend"
  protocol              = "HTTP"
  port_name             = "http"
  load_balancing_scheme = "EXTERNAL"
  health_checks         = [google_compute_health_check.default.id]

  backend {
    group           = google_compute_region_instance_group_manager.tokyo.instance_group
    balancing_mode  = "UTILIZATION"
    capacity_scaler = 1.0
  }

  backend {
    group           = google_compute_region_instance_group_manager.osaka.instance_group
    balancing_mode  = "UTILIZATION"
    capacity_scaler = 1.0
  }
}`,
    tips: [
      "GCPのグローバルLBはAnycastでユーザーに最も近いリージョンへ自動ルーティング",
      "Cloud CDNを有効にすると静的コンテンツがエッジでキャッシュされる",
    ],
  },
];

const patternsSections: Section[] = [
  {
    title: "パターン1: Workspace による環境・リージョン分離",
    description: "Terraform Workspace を使って同じコードを異なるリージョン・環境にデプロイします。シンプルな構成に向いています。",
    code: `# terraform workspace new tokyo-prod
# terraform workspace new osaka-dr
# terraform workspace new virginia-test

locals {
  workspace_config = {
    "tokyo-prod" = {
      region        = "ap-northeast-1"
      instance_type = "t3.large"
      replicas      = 3
    }
    "osaka-dr" = {
      region        = "ap-northeast-3"
      instance_type = "t3.medium"
      replicas      = 2
    }
    "virginia-test" = {
      region        = "us-east-1"
      instance_type = "t3.micro"
      replicas      = 1
    }
  }

  config = local.workspace_config[terraform.workspace]
}

provider "aws" {
  region = local.config.region
}

resource "aws_instance" "web" {
  count         = local.config.replicas
  instance_type = local.config.instance_type
  # ...
}`,
    tips: [
      "小規模でリージョン間の差異が少ない場合に適している",
      "各ワークスペースのStateは独立しているため安全",
      "terraform workspace select tokyo-prod で切り替え",
    ],
  },
  {
    title: "パターン2: ディレクトリ分離（推奨）",
    description: "環境・リージョンごとにディレクトリを分け、共通モジュールを参照する構成。大規模プロジェクトに推奨されるパターンです。",
    code: `# ディレクトリ構成
project/
├── modules/
│   ├── networking/     # VPC, Subnet, SG 等
│   ├── compute/        # EC2, ASG 等
│   ├── database/       # RDS, ElastiCache 等
│   └── dns/            # Route53 等
├── environments/
│   ├── prod/
│   │   ├── ap-northeast-1/   # 東京（プライマリ）
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   ├── terraform.tfvars
│   │   │   └── backend.tf
│   │   ├── ap-northeast-3/   # 大阪（DR）
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   ├── terraform.tfvars
│   │   │   └── backend.tf
│   │   └── global/           # Route53, CloudFront等
│   │       ├── main.tf
│   │       └── backend.tf
│   ├── staging/
│   │   └── us-east-1/       # バージニア（テスト）
│   └── dev/
│       └── us-east-1/
└── README.md

# environments/prod/ap-northeast-1/main.tf
module "networking" {
  source       = "../../../modules/networking"
  vpc_cidr     = "10.0.0.0/16"
  environment  = "prod"
  region_name  = "tokyo"
}

module "compute" {
  source        = "../../../modules/compute"
  vpc_id        = module.networking.vpc_id
  subnet_ids    = module.networking.private_subnet_ids
  instance_type = "t3.large"
  desired_count = 3
}

# environments/prod/ap-northeast-1/backend.tf
terraform {
  backend "s3" {
    bucket = "mycompany-terraform-state"
    key    = "prod/ap-northeast-1/terraform.tfstate"
    region = "ap-northeast-1"
  }
}`,
    tips: [
      "Stateが完全に分離されるため、blast radiusが最小化",
      "リージョンごとに独立して plan/apply できる",
      "global/ でRoute53等のグローバルリソースを管理",
      "terraform_remote_state で他リージョンの出力を参照可能",
    ],
  },
  {
    title: "パターン3: Terragrunt によるDRY構成",
    description: "Terragrunt（Terraformラッパーツール）を使うと、設定の重複を最小化しつつマルチリージョン管理が容易になります。",
    code: `# Terragrunt ディレクトリ構成
project/
├── terragrunt.hcl          # ルート設定
├── modules/                # Terraform モジュール
│   └── web-stack/
├── prod/
│   ├── terragrunt.hcl      # 環境共通設定
│   ├── ap-northeast-1/
│   │   └── web-stack/
│   │       └── terragrunt.hcl
│   └── ap-northeast-3/
│       └── web-stack/
│           └── terragrunt.hcl
└── dev/
    └── us-east-1/
        └── web-stack/
            └── terragrunt.hcl

# prod/ap-northeast-1/web-stack/terragrunt.hcl
terraform {
  source = "../../../modules/web-stack"
}

include "root" {
  path = find_in_parent_folders()
}

inputs = {
  region        = "ap-northeast-1"
  environment   = "prod"
  instance_type = "t3.large"
  desired_count = 3
}

# prod/ap-northeast-3/web-stack/terragrunt.hcl
terraform {
  source = "../../../modules/web-stack"
}

include "root" {
  path = find_in_parent_folders()
}

inputs = {
  region        = "ap-northeast-3"
  environment   = "prod-dr"
  instance_type = "t3.medium"
  desired_count = 2
}

# 全リージョン一括適用
# terragrunt run-all apply`,
    tips: [
      "terragrunt run-all で全リージョンを一括 plan/apply",
      "dependency ブロックでリージョン間の依存関係を定義可能",
      "バックエンド設定の自動生成で設定の重複を排除",
    ],
  },
];

const testingSections: Section[] = [
  {
    title: "手順1: テスト用リージョンの環境準備",
    description: "まず、テスト対象のリージョンに環境を構築します。本番と同じモジュールを使い、スケールだけ下げるのがポイントです。",
    code: `# テスト環境用の tfvars
# test-virginia.tfvars
region        = "us-east-1"
environment   = "test"
instance_type = "t3.micro"   # 最小スペックでコスト節約
desired_count = 1            # 最小台数
enable_dr     = false        # DR機能は無効

# テスト環境の構築
$ cd environments/test/us-east-1
$ terraform init
$ terraform plan -var-file="test-virginia.tfvars"
$ terraform apply -var-file="test-virginia.tfvars"

# 出力値の確認
$ terraform output
alb_dns_name = "test-alb-123456.us-east-1.elb.amazonaws.com"
app_url      = "http://test-alb-123456.us-east-1.elb.amazonaws.com"
vpc_id       = "vpc-0abc123def456789"`,
    tips: [
      "t3.micro や t3.small を使ってコストを最小化",
      "desired_count = 1 で最小構成にする",
      "不要な機能（DR、マルチAZ等）は無効化してシンプルに",
    ],
  },
  {
    title: "手順2: リージョン固有の設定を確認",
    description: "各リージョンで利用可能なAMI、インスタンスタイプ、サービスが異なる場合があるため、事前確認が重要です。",
    code: `# AMI がリージョンで利用可能か確認
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

# 利用可能なAZを確認
data "aws_availability_zones" "available" {
  state = "available"
}

output "available_azs" {
  value = data.aws_availability_zones.available.names
}

# AWS CLI での事前確認コマンド
# インスタンスタイプの利用可能性
# $ aws ec2 describe-instance-type-offerings \\
#     --location-type availability-zone \\
#     --filters "Name=instance-type,Values=t3.micro" \\
#     --region us-east-1

# サービスのエンドポイント確認
# $ aws ec2 describe-vpc-endpoint-services \\
#     --region us-east-1 \\
#     --query "ServiceNames"

# リージョンで有効なサービス確認
# $ aws account list-regions --region-opt-status-contains ENABLED`,
    tips: [
      "一部リージョンは手動で有効化が必要（アフリカ、中東等）",
      "新しいインスタンスタイプは一部リージョンで未提供の場合がある",
      "data source でAMI IDを動的取得すればリージョン差異を吸収可能",
    ],
    warnings: [
      "ap-northeast-3（大阪）はサービスが限定的な場合がある",
      "一部のAWSサービスはグローバルリージョン（us-east-1）でのみ設定可能",
    ],
  },
  {
    title: "手順3: デプロイ後の動作確認",
    description: "リソースが正しく作成されたか、アプリケーションが正常に動作するかをチェックします。",
    code: `# 1. リソースの確認
$ terraform state list
aws_vpc.main
aws_subnet.public[0]
aws_instance.web[0]
aws_lb.main
aws_ecs_service.app

# 2. 出力値の取得
$ terraform output -json > outputs.json

# 3. ヘルスチェック
$ ALB_DNS=$(terraform output -raw alb_dns_name)
$ curl -s -o /dev/null -w "%{http_code}" http://$ALB_DNS/health
# 期待値: 200

# 4. レスポンスタイム確認
$ curl -w "\\n  DNS: %{time_namelookup}s\\n  Connect: %{time_connect}s\\n  Total: %{time_total}s\\n" \\
    -o /dev/null -s http://$ALB_DNS/
#   DNS: 0.012s
#   Connect: 0.150s
#   Total: 0.320s

# 5. エンドポイントごとの確認
$ curl http://$ALB_DNS/api/status
$ curl http://$ALB_DNS/api/version

# 6. DNS解決の確認（Route53設定後）
$ dig +short app.example.com
$ nslookup app.example.com`,
    tips: [
      "ヘルスチェックエンドポイント (/health) を必ず実装しておく",
      "レスポンスタイムがリージョンの期待値内か確認",
      "curl -w で詳細なタイミング情報を取得可能",
    ],
  },
  {
    title: "手順4: リージョン間の接続確認",
    description: "マルチリージョン構成では、リージョン間の通信（VPC Peering、データレプリケーション等）が正しく動作するか確認します。",
    code: `# VPC Peering の確認
$ aws ec2 describe-vpc-peering-connections \\
    --filters "Name=status-code,Values=active" \\
    --region ap-northeast-1

# リージョン間のレイテンシ測定
# 東京リージョンのインスタンスから大阪に ping
$ ssh ec2-user@<tokyo-instance-ip>
$ ping <osaka-instance-private-ip>
# 期待値: 5-10ms

# RDS リードレプリカのレプリケーション遅延確認
$ aws rds describe-db-instances \\
    --db-instance-identifier mydb-osaka-replica \\
    --region ap-northeast-3 \\
    --query "DBInstances[0].StatusInfos"

# S3 クロスリージョンレプリケーションの確認
$ aws s3api head-object \\
    --bucket my-bucket-osaka-replica \\
    --key test-file.txt \\
    --region ap-northeast-3`,
    tips: [
      "VPC Peering はリージョン間で設定可能（CIDRの重複不可）",
      "Transit Gatewayでより複雑なネットワーク構成も管理可能",
      "データレプリケーションの遅延は要件内か確認すること",
    ],
  },
  {
    title: "手順5: フェイルオーバーテスト",
    description: "DR構成では、実際にフェイルオーバーが正しく機能するかテストすることが重要です。",
    code: `# フェイルオーバーテストの手順

# 1. 現在のDNS解決先を確認
$ dig +short app.example.com
# → 東京リージョンのALB IPが返る

# 2. プライマリリージョンのヘルスチェックを意図的に失敗させる
# 方法A: ヘルスチェックエンドポイントを停止
$ aws ecs update-service \\
    --cluster my-app-cluster \\
    --service my-app-service \\
    --desired-count 0 \\
    --region ap-northeast-1

# 3. Route53のフェイルオーバーを確認（数分待つ）
$ watch -n 10 "dig +short app.example.com"
# → 大阪リージョンのALB IPに切り替わる

# 4. セカンダリリージョンでの動作確認
$ curl -s http://app.example.com/health
# → 200 OK（大阪リージョンから応答）

# 5. プライマリリージョンを復旧
$ aws ecs update-service \\
    --cluster my-app-cluster \\
    --service my-app-service \\
    --desired-count 2 \\
    --region ap-northeast-1

# 6. DNS が東京に戻ることを確認
$ watch -n 10 "dig +short app.example.com"
# → 東京リージョンのALB IPに戻る

# 7. テスト完了後、テスト環境を破棄（コスト節約）
$ cd environments/test/us-east-1
$ terraform destroy -auto-approve`,
    tips: [
      "フェイルオーバーテストは定期的に実施（月1回推奨）",
      "切り替え時間（RTO）を計測し、SLA要件を満たすか確認",
      "テスト後は必ず環境を元に戻す（またはdestroy）",
    ],
    warnings: [
      "本番環境でのフェイルオーバーテストはメンテナンスウィンドウ内で実施",
      "DNS TTLが長いとフェイルオーバーに時間がかかる（60秒推奨）",
    ],
  },
  {
    title: "手順6: テスト環境のクリーンアップ",
    description: "動作確認が完了したら、テスト環境を確実に削除してコストを抑えます。",
    code: `# テスト環境の削除
$ cd environments/test/us-east-1

# 削除対象の確認（重要！）
$ terraform plan -destroy

# Plan: 0 to add, 0 to change, 15 to destroy.
# 内容を確認して問題なければ削除

$ terraform destroy -auto-approve

# 全テスト環境の一括削除（Terragrunt使用時）
$ cd test/
$ terragrunt run-all destroy --terragrunt-non-interactive

# 後片付けチェックリスト
# □ EC2インスタンスが削除されたか
# □ EIPが解放されたか
# □ RDSスナップショットが不要なら削除
# □ S3バケットが空になっているか
# □ CloudWatch ロググループを確認
# □ NAT Gatewayが削除されたか（高額）
# □ ELBが削除されたか

# AWS CLI でリソース残存確認
$ aws resourcegroupstaggingapi get-resources \\
    --tag-filters Key=Environment,Values=test \\
    --region us-east-1 \\
    --query "ResourceTagMappingList[].ResourceARN"`,
    tips: [
      "NAT GatewayやELBは稼働時間課金のため、放置するとコストが膨らむ",
      "terraform destroy 後にタグベースでリソース残存を確認すると安心",
      "CI/CDで「テスト環境の自動削除」をスケジュール実行するのがベスト",
    ],
    warnings: ["destroyする前にStateのバックアップを取得しておくと安心"],
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1.5 rounded hover:bg-white/10 transition-colors" title="コピー">
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
            <button
              className="w-full flex items-center gap-4 p-5 text-left"
              onClick={() => setExpanded(isOpen ? null : i)}
            >
              <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center shrink-0`}>
                <span className="text-white text-[14px]">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px]">{section.title}</p>
                <p className="text-[13px] text-muted-foreground">{section.description}</p>
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
                    <CopyButton text={section.code} />
                  </div>
                  <pre className="bg-[#1e1e2e] text-[#cdd6f4] text-[13px] p-4 rounded-lg overflow-x-auto">
                    <code>{section.code}</code>
                  </pre>
                  <div className="flex justify-end mt-2">
                    <DownloadCodeButton
                      code={section.code}
                      filename={`${section.title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}.tf`}
                    />
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

export function MultiRegion() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1>マルチリージョン運用</h1>
        <p className="text-muted-foreground mt-1">
          別リージョンへのデプロイ・動作確認・フェイルオーバーの手順ガイド
        </p>
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

      {/* Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="mb-4">なぜマルチリージョンが必要？</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {whyMultiRegion.map((item) => (
                <div key={item.title} className="flex items-start gap-3 p-4 bg-accent/30 rounded-lg">
                  <item.icon className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[14px]">{item.title}</p>
                    <p className="text-[12px] text-muted-foreground mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="mb-4">主要リージョン一覧</h2>
            <div className="space-y-5">
              {(["aws", "azure", "gcp"] as const).map((provider) => (
                <div key={provider}>
                  <h3 className="mb-2 text-purple-600">
                    {provider === "aws" ? "AWS" : provider === "azure" ? "Azure" : "GCP"}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {regionList[provider].map((r) => (
                      <div key={r.code} className="flex items-center gap-2 text-[13px] p-2 bg-accent/20 rounded">
                        <code className="bg-muted px-2 py-0.5 rounded text-purple-600 shrink-0">{r.code}</code>
                        <span>{r.name}</span>
                        <span className="text-muted-foreground text-[11px]">— {r.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="mb-4">別リージョンでの動作確認フロー</h2>
            <div className="space-y-0">
              {[
                { step: "1", title: "テスト用 tfvars を作成", desc: "リージョン・スケールを変更した変数ファイルを準備" },
                { step: "2", title: "terraform init & plan", desc: "テストリージョンで初期化し、変更内容を確認" },
                { step: "3", title: "terraform apply", desc: "テスト環境をデプロイ" },
                { step: "4", title: "動作確認", desc: "ヘルスチェック、レスポンス、リージョン間通信を検証" },
                { step: "5", title: "フェイルオーバーテスト", desc: "DR構成の場合、切替が正常に動作するか検証" },
                { step: "6", title: "terraform destroy", desc: "テスト環境を確実に削除してコスト節約" },
              ].map((item, i) => (
                <div key={item.step} className="flex items-start gap-4 p-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-[13px]">
                      {item.step}
                    </div>
                    {i < 5 && <div className="w-0.5 h-6 bg-green-200 mt-1" />}
                  </div>
                  <div className="pt-1">
                    <p className="text-[14px]">{item.title}</p>
                    <p className="text-[12px] text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AWS */}
      {activeTab === "aws" && <SectionList sections={awsSections} color="bg-[#FF9900]" />}

      {/* Azure */}
      {activeTab === "azure" && <SectionList sections={azureSections} color="bg-[#0078D4]" />}

      {/* GCP */}
      {activeTab === "gcp" && <SectionList sections={gcpSections} color="bg-[#4285F4]" />}

      {/* Patterns */}
      {activeTab === "patterns" && <SectionList sections={patternsSections} color="bg-teal-500" />}

      {/* Testing */}
      {activeTab === "testing" && (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="text-[14px] text-green-800">動作確認のポイント</p>
            </div>
            <ul className="space-y-1 ml-7">
              <li className="text-[13px] text-green-800">本番と同じモジュール・コードを使い、スケールだけ縮小する</li>
              <li className="text-[13px] text-green-800">リージョン固有の値（AMI ID等）は data source で動的に取得する</li>
              <li className="text-[13px] text-green-800">テスト後は必ず destroy してコストを管理する</li>
              <li className="text-[13px] text-green-800">CI/CDでテスト環境の構築・検証・削除を自動化するのが理想</li>
            </ul>
          </div>
          <SectionList sections={testingSections} color="bg-green-600" />
        </div>
      )}
    </div>
  );
}
