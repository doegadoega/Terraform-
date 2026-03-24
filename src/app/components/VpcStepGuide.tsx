import { useState } from "react";
import {
  Network,
  Layers,
  Globe,
  ArrowRight,
  ArrowDown,
  Shield,
  Route,
  Server,
  Lock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Lightbulb,
  Link2,
  Workflow,
} from "lucide-react";
import { DownloadCodeButton } from "./DownloadCodeButton";

// ─── Types ───────────────────────────────────────────────────────────────────

interface VpcStep {
  readonly id: number;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: React.ElementType;
  readonly color: string;
  readonly bgColor: string;
  readonly dependsOn: readonly number[];
  readonly description: string;
  readonly whyNeeded: string;
  readonly keySettings: readonly KeySetting[];
  readonly code: string;
  readonly tips: readonly string[];
  readonly warnings: readonly string[];
  readonly filename: string;
}

interface KeySetting {
  readonly name: string;
  readonly description: string;
  readonly example: string;
  readonly required: boolean;
}

// ─── Step Data ───────────────────────────────────────────────────────────────

const VPC_STEPS: readonly VpcStep[] = [
  {
    id: 1,
    title: "VPC の作成",
    subtitle: "ネットワークの土台",
    icon: Network,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    dependsOn: [],
    description:
      "VPC（Virtual Private Cloud）は AWS 上に作る仮想ネットワークの基盤です。全てのリソースはこの VPC の中に配置されます。最初に CIDR ブロック（IPアドレス範囲）を決めることが最も重要です。",
    whyNeeded:
      "AWS のリソース（EC2、RDS、ECS など）を配置するための独立したネットワーク空間が必要です。VPC なしではリソースを作成できません。",
    keySettings: [
      {
        name: "cidr_block",
        description: "VPC の IP アドレス範囲",
        example: '"10.0.0.0/16"（65,536 個の IP）',
        required: true,
      },
      {
        name: "enable_dns_support",
        description: "DNS 解決を有効化",
        example: "true（ほぼ必須）",
        required: true,
      },
      {
        name: "enable_dns_hostnames",
        description: "DNS ホスト名を有効化",
        example: "true（ECS/RDS 利用時は必須）",
        required: true,
      },
      {
        name: "tags.Name",
        description: "VPC の識別名",
        example: '"my-project-vpc"',
        required: true,
      },
    ],
    code: `# =============================================
# Step 1: VPC の作成
# =============================================
# VPC は全てのネットワークリソースの土台です
# CIDR ブロックは後から変更できないため慎重に決めましょう

variable "project_name" {
  description = "プロジェクト名（リソース命名に使用）"
  type        = string
  default     = "my-project"
}

variable "vpc_cidr" {
  description = "VPC の CIDR ブロック"
  type        = string
  default     = "10.0.0.0/16"
}

resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr

  # DNS 設定（ECS, RDS, ElastiCache 等を使う場合は必須）
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name        = "\${var.project_name}-vpc"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

# 確認用の出力
output "vpc_id" {
  description = "作成した VPC の ID"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "VPC の CIDR ブロック"
  value       = aws_vpc.main.cidr_block
}`,
    tips: [
      "/16 は 65,536 IP で一般的。小規模なら /20（4,096 IP）でも可",
      "CIDR は後から変更不可。将来の拡張を見越して余裕を持つ",
      "他 VPC やオンプレとの接続時は CIDR の重複に注意",
      "10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 のプライベート範囲から選択",
    ],
    warnings: [
      "CIDR ブロックは VPC 作成後に変更できません",
      "既存 VPC や VPN 接続先と CIDR が重複すると通信できません",
    ],
    filename: "01_vpc.tf",
  },
  {
    id: 2,
    title: "サブネットの作成",
    subtitle: "ネットワークの区画分け",
    icon: Layers,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    dependsOn: [1],
    description:
      "VPC を小さなネットワーク区画（サブネット）に分割します。パブリックサブネット（インターネット直接接続）とプライベートサブネット（インターネット非公開）を作成し、高可用性のために複数の AZ に配置します。",
    whyNeeded:
      "ALB はパブリックサブネット、ECS/RDS はプライベートサブネットに配置するなど、セキュリティレベルに応じた分離が必要です。また、AZ 障害に備えて最低2つの AZ にサブネットを配置します。",
    keySettings: [
      {
        name: "vpc_id",
        description: "所属する VPC",
        example: "aws_vpc.main.id",
        required: true,
      },
      {
        name: "cidr_block",
        description: "サブネットの IP 範囲（VPC の範囲内）",
        example: '"10.0.1.0/24"（256 個の IP）',
        required: true,
      },
      {
        name: "availability_zone",
        description: "配置する AZ",
        example: '"ap-northeast-1a"',
        required: true,
      },
      {
        name: "map_public_ip_on_launch",
        description: "パブリック IP の自動割当",
        example: "true（パブリックサブネットのみ）",
        required: false,
      },
    ],
    code: `# =============================================
# Step 2: サブネットの作成
# =============================================
# パブリック: ALB, NAT Gateway 等を配置
# プライベート: ECS, RDS, Lambda 等を配置
# 最低 2 AZ に配置して高可用性を確保

# 利用可能な AZ を取得
data "aws_availability_zones" "available" {
  state = "available"
}

variable "public_subnet_cidrs" {
  description = "パブリックサブネットの CIDR リスト"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "プライベートサブネットの CIDR リスト"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24"]
}

# --- パブリックサブネット ---
resource "aws_subnet" "public" {
  count = length(var.public_subnet_cidrs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.public_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  # パブリックサブネットでは自動的にパブリック IP を付与
  map_public_ip_on_launch = true

  tags = {
    Name = "\${var.project_name}-public-\${count.index + 1}"
    Tier = "public"
  }
}

# --- プライベートサブネット ---
resource "aws_subnet" "private" {
  count = length(var.private_subnet_cidrs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  # プライベートサブネットではパブリック IP は不要
  map_public_ip_on_launch = false

  tags = {
    Name = "\${var.project_name}-private-\${count.index + 1}"
    Tier = "private"
  }
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}`,
    tips: [
      "パブリック・プライベート各2つ以上（マルチAZ）が推奨",
      "サブネット CIDR は VPC CIDR の範囲内で重複不可",
      "/24 で 256 IP（実質 251 利用可能、AWS が 5 つ予約）",
      "count ではなく for_each を使うとリソースの追加/削除が安全",
    ],
    warnings: [
      "ALB は最低2つの AZ のサブネットが必要です",
      "サブネットの CIDR は後から変更できません（再作成が必要）",
    ],
    filename: "02_subnets.tf",
  },
  {
    id: 3,
    title: "インターネットゲートウェイ（IGW）",
    subtitle: "VPC とインターネットの接続口",
    icon: Globe,
    color: "text-green-600",
    bgColor: "bg-green-100",
    dependsOn: [1],
    description:
      "VPC からインターネットへ接続するためのゲートウェイです。VPC に1つだけアタッチできます。パブリックサブネットのリソースがインターネットと通信するために必須です。",
    whyNeeded:
      "IGW がないと VPC 内のリソースはインターネットに一切アクセスできません。パブリックサブネットの ALB や EC2 がインターネットからアクセスされるために必要です。",
    keySettings: [
      {
        name: "vpc_id",
        description: "アタッチする VPC",
        example: "aws_vpc.main.id",
        required: true,
      },
    ],
    code: `# =============================================
# Step 3: インターネットゲートウェイ（IGW）
# =============================================
# VPC に 1 つだけアタッチ可能
# パブリックサブネットのインターネット接続に必須

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "\${var.project_name}-igw"
  }
}

output "igw_id" {
  description = "インターネットゲートウェイの ID"
  value       = aws_internet_gateway.main.id
}`,
    tips: [
      "VPC あたり 1 つのみ。設定はシンプル",
      "IGW 自体には料金は発生しない（通信量で課金）",
      "IGW を作っただけでは通信できない → ルートテーブルの設定が必要",
    ],
    warnings: [
      "IGW を削除するとパブリックサブネット全体がインターネットから切断されます",
    ],
    filename: "03_internet_gateway.tf",
  },
  {
    id: 4,
    title: "NAT Gateway",
    subtitle: "プライベートサブネットの外部通信",
    icon: ArrowRight,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    dependsOn: [2, 3],
    description:
      "プライベートサブネットのリソースがインターネットへ「出ていく」ための仕組みです。パブリックサブネットに配置し、Elastic IP を紐付けます。外部からの着信は許可しません（片方向通信）。",
    whyNeeded:
      "プライベートサブネットの ECS タスクが Docker イメージを ECR からプルしたり、外部 API を呼んだりするのに必要です。NAT Gateway がないとプライベートサブネットから外部に一切通信できません。",
    keySettings: [
      {
        name: "allocation_id",
        description: "紐付ける Elastic IP",
        example: "aws_eip.nat.id",
        required: true,
      },
      {
        name: "subnet_id",
        description: "配置するパブリックサブネット",
        example: "aws_subnet.public[0].id",
        required: true,
      },
    ],
    code: `# =============================================
# Step 4: NAT Gateway
# =============================================
# プライベートサブネットからインターネットへの
# アウトバウンド通信を可能にする（インバウンドは不可）
#
# 注意: NAT Gateway は時間課金 + データ転送量課金

# NAT Gateway 用の Elastic IP
resource "aws_eip" "nat" {
  count  = length(var.public_subnet_cidrs)
  domain = "vpc"

  tags = {
    Name = "\${var.project_name}-nat-eip-\${count.index + 1}"
  }

  # IGW が先に存在する必要がある
  depends_on = [aws_internet_gateway.main]
}

# NAT Gateway（各 AZ に 1 つ = 高可用性構成）
resource "aws_nat_gateway" "main" {
  count = length(var.public_subnet_cidrs)

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "\${var.project_name}-nat-\${count.index + 1}"
  }
}

# --- コスト削減版: NAT Gateway を 1 つだけ作る場合 ---
# resource "aws_eip" "nat_single" {
#   domain = "vpc"
#   tags   = { Name = "\${var.project_name}-nat-eip" }
#   depends_on = [aws_internet_gateway.main]
# }
#
# resource "aws_nat_gateway" "single" {
#   allocation_id = aws_eip.nat_single.id
#   subnet_id     = aws_subnet.public[0].id
#   tags          = { Name = "\${var.project_name}-nat" }
# }`,
    tips: [
      "本番環境では AZ ごとに 1 つ（高可用性）推奨",
      "開発環境では 1 つに集約してコスト削減可能",
      "NAT Gateway は約 $32/月 + データ転送料が発生",
      "VPC エンドポイントを併用すると NAT の通信量を削減可能",
    ],
    warnings: [
      "NAT Gateway は常時課金されます（停止不可）。開発環境では注意",
      "AZ に 1 つの NAT のみだと、その AZ 障害時にプライベートサブネット全体が外部通信不可に",
    ],
    filename: "04_nat_gateway.tf",
  },
  {
    id: 5,
    title: "ルートテーブル",
    subtitle: "通信経路の設定",
    icon: Route,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100",
    dependsOn: [2, 3, 4],
    description:
      "サブネット内のリソースがどこに通信を送るかを決めるルーティング規則です。パブリックサブネットは IGW へ、プライベートサブネットは NAT Gateway へルーティングします。",
    whyNeeded:
      "ルートテーブルがないとサブネット内のリソースは VPC 内部でしか通信できません。IGW や NAT Gateway を作っても、ルートテーブルで経路を設定しなければ使われません。",
    keySettings: [
      {
        name: "vpc_id",
        description: "所属する VPC",
        example: "aws_vpc.main.id",
        required: true,
      },
      {
        name: "route.cidr_block",
        description: "宛先の IP 範囲",
        example: '"0.0.0.0/0"（全てのインターネット通信）',
        required: true,
      },
      {
        name: "route.gateway_id / nat_gateway_id",
        description: "通信先のゲートウェイ",
        example: "aws_internet_gateway.main.id",
        required: true,
      },
    ],
    code: `# =============================================
# Step 5: ルートテーブル
# =============================================
# パブリック: 0.0.0.0/0 → IGW（インターネットへ直接）
# プライベート: 0.0.0.0/0 → NAT Gateway（NAT 経由で外部へ）

# --- パブリックルートテーブル ---
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  # インターネット宛の通信を IGW に送る
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "\${var.project_name}-public-rt"
  }
}

# パブリックサブネットにルートテーブルを関連付け
resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# --- プライベートルートテーブル（AZ ごと）---
resource "aws_route_table" "private" {
  count  = length(aws_subnet.private)
  vpc_id = aws_vpc.main.id

  # インターネット宛の通信を NAT Gateway に送る
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = {
    Name = "\${var.project_name}-private-rt-\${count.index + 1}"
  }
}

# プライベートサブネットにルートテーブルを関連付け
resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}`,
    tips: [
      "パブリックルートテーブルは全パブリックサブネットで共有可能",
      "プライベートは AZ ごとに分けて対応する NAT を指定",
      "VPC 内通信（local ルート）は自動で追加される",
      "0.0.0.0/0 はデフォルトルート（マッチしない通信全て）",
    ],
    warnings: [
      "ルートテーブルの関連付けを忘れるとサブネットはメインルートテーブルを使います",
      "パブリックサブネットに NAT を、プライベートに IGW を設定しないように注意",
    ],
    filename: "05_route_tables.tf",
  },
  {
    id: 6,
    title: "セキュリティグループ",
    subtitle: "ファイアウォールの設定",
    icon: Shield,
    color: "text-red-600",
    bgColor: "bg-red-100",
    dependsOn: [1],
    description:
      "リソースに対するインバウンド（受信）・アウトバウンド（送信）のトラフィックを制御するファイアウォールです。ステートフル（戻りの通信は自動許可）で、許可ルールのみ設定します。",
    whyNeeded:
      "ALB は 80/443 ポートを公開、ECS は ALB からのみ受信、RDS は ECS からのみ受信、のように各リソースに適切なアクセス制御を設定するために必要です。",
    keySettings: [
      {
        name: "vpc_id",
        description: "所属する VPC",
        example: "aws_vpc.main.id",
        required: true,
      },
      {
        name: "ingress",
        description: "インバウンドルール（受信許可）",
        example: "port 443, source: 0.0.0.0/0",
        required: false,
      },
      {
        name: "egress",
        description: "アウトバウンドルール（送信許可）",
        example: "port 0（全て）, destination: 0.0.0.0/0",
        required: false,
      },
    ],
    code: `# =============================================
# Step 6: セキュリティグループ
# =============================================
# 各リソース用に専用の SG を作成し、最小権限の原則を適用

# --- ALB 用セキュリティグループ ---
resource "aws_security_group" "alb" {
  name_prefix = "\${var.project_name}-alb-"
  description = "ALB のセキュリティグループ"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "\${var.project_name}-alb-sg"
  }

  # name_prefix 使用時は create_before_destroy が推奨
  lifecycle {
    create_before_destroy = true
  }
}

# ALB: HTTPS (443) を全世界から受信許可
resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from Internet"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
}

# ALB: HTTP (80) を全世界から受信許可（HTTPS リダイレクト用）
resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from Internet (redirect to HTTPS)"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
}

# ALB: 全アウトバウンドを許可
resource "aws_vpc_security_group_egress_rule" "alb_all" {
  security_group_id = aws_security_group.alb.id
  description       = "Allow all outbound"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# --- ECS タスク用セキュリティグループ ---
resource "aws_security_group" "ecs" {
  name_prefix = "\${var.project_name}-ecs-"
  description = "ECS タスクのセキュリティグループ"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "\${var.project_name}-ecs-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ECS: ALB からのみアプリポートで受信許可
resource "aws_vpc_security_group_ingress_rule" "ecs_from_alb" {
  security_group_id            = aws_security_group.ecs.id
  description                  = "From ALB only"
  from_port                    = 8080
  to_port                      = 8080
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.alb.id
}

# ECS: 全アウトバウンドを許可（ECR pull, 外部 API 等）
resource "aws_vpc_security_group_egress_rule" "ecs_all" {
  security_group_id = aws_security_group.ecs.id
  description       = "Allow all outbound"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# --- RDS 用セキュリティグループ ---
resource "aws_security_group" "rds" {
  name_prefix = "\${var.project_name}-rds-"
  description = "RDS のセキュリティグループ"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "\${var.project_name}-rds-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# RDS: ECS からのみ PostgreSQL ポートで受信許可
resource "aws_vpc_security_group_ingress_rule" "rds_from_ecs" {
  security_group_id            = aws_security_group.rds.id
  description                  = "PostgreSQL from ECS only"
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.ecs.id
}`,
    tips: [
      "name ではなく name_prefix + create_before_destroy で安全に更新",
      "セキュリティグループ ID で参照すると IP 変更に強い",
      "アウトバウンドは通常全開放（制限する場合は VPC エンドポイント併用）",
      "各リソース用に専用 SG を作成し、最小権限の原則を適用",
    ],
    warnings: [
      "0.0.0.0/0 のインバウンドは ALB 以外では使わない",
      "セキュリティグループのルール変更は即座に反映されます",
    ],
    filename: "06_security_groups.tf",
  },
  {
    id: 7,
    title: "VPC エンドポイント",
    subtitle: "AWS サービスへの直接接続",
    icon: Link2,
    color: "text-teal-600",
    bgColor: "bg-teal-100",
    dependsOn: [1, 2, 5],
    description:
      "VPC 内から AWS サービス（S3, ECR, CloudWatch 等）にインターネットを経由せずプライベートに接続する仕組みです。Gateway 型（S3, DynamoDB）と Interface 型（その他）の2種類があります。",
    whyNeeded:
      "NAT Gateway 経由だと通信コストが発生し、インターネットを経由するためセキュリティリスクもあります。VPC エンドポイントを使うと、より安全でコスト効率の良い接続が可能です。",
    keySettings: [
      {
        name: "vpc_id",
        description: "所属する VPC",
        example: "aws_vpc.main.id",
        required: true,
      },
      {
        name: "service_name",
        description: "接続する AWS サービス",
        example: '"com.amazonaws.ap-northeast-1.s3"',
        required: true,
      },
      {
        name: "vpc_endpoint_type",
        description: "エンドポイントの種類",
        example: '"Gateway"（S3/DynamoDB）または "Interface"',
        required: true,
      },
    ],
    code: `# =============================================
# Step 7: VPC エンドポイント
# =============================================
# NAT Gateway を経由せず AWS サービスに直接接続
# Gateway 型: 無料（S3, DynamoDB）
# Interface 型: 有料（ECR, CloudWatch 等）

variable "aws_region" {
  description = "AWS リージョン"
  type        = string
  default     = "ap-northeast-1"
}

# --- Gateway 型: S3（無料）---
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.\${var.aws_region}.s3"

  vpc_endpoint_type = "Gateway"

  # プライベートルートテーブルに自動でルート追加
  route_table_ids = aws_route_table.private[*].id

  tags = {
    Name = "\${var.project_name}-s3-endpoint"
  }
}

# --- Gateway 型: DynamoDB（無料）---
resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.\${var.aws_region}.dynamodb"

  vpc_endpoint_type = "Gateway"
  route_table_ids   = aws_route_table.private[*].id

  tags = {
    Name = "\${var.project_name}-dynamodb-endpoint"
  }
}

# --- Interface 型: ECR API ---
resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.\${var.aws_region}.ecr.api"

  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name = "\${var.project_name}-ecr-api-endpoint"
  }
}

# --- Interface 型: ECR Docker ---
resource "aws_vpc_endpoint" "ecr_dkr" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.\${var.aws_region}.ecr.dkr"

  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name = "\${var.project_name}-ecr-dkr-endpoint"
  }
}

# --- Interface 型: CloudWatch Logs ---
resource "aws_vpc_endpoint" "logs" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.\${var.aws_region}.logs"

  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name = "\${var.project_name}-logs-endpoint"
  }
}

# --- VPC エンドポイント用セキュリティグループ ---
resource "aws_security_group" "vpc_endpoints" {
  name_prefix = "\${var.project_name}-vpce-"
  description = "VPC Endpoints のセキュリティグループ"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "\${var.project_name}-vpce-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "vpce_https" {
  security_group_id = aws_security_group.vpc_endpoints.id
  description       = "HTTPS from VPC"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  cidr_ipv4         = aws_vpc.main.cidr_block
}`,
    tips: [
      "S3 と DynamoDB の Gateway 型は無料なので常に設定推奨",
      "ECS Fargate を使う場合は ECR(api + dkr) + S3 + Logs が必要",
      "Interface 型は ENI 作成のため時間課金あり（約 $7/月/AZ）",
      "private_dns_enabled で既存コードの変更なしに利用可能",
    ],
    warnings: [
      "Interface 型エンドポイントは AZ ごとに課金されるため、不要な AZ には作らない",
      "private_dns_enabled は VPC 内の DNS 設定に影響するため、既存リソースに注意",
    ],
    filename: "07_vpc_endpoints.tf",
  },
  {
    id: 8,
    title: "ネットワーク ACL（NACL）",
    subtitle: "サブネット単位の追加防御",
    icon: Lock,
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    dependsOn: [2],
    description:
      "サブネット単位で適用するステートレスなファイアウォールです。セキュリティグループと異なり、拒否ルールも設定でき、戻りの通信も明示的に許可が必要です。通常はデフォルト NACL（全許可）で十分ですが、コンプライアンス要件がある場合に使用します。",
    whyNeeded:
      "セキュリティグループに加えた多層防御（Defense in Depth）として使用します。特定の IP レンジからのアクセスを完全にブロックしたい場合や、コンプライアンス要件がある場合に有効です。",
    keySettings: [
      {
        name: "vpc_id",
        description: "所属する VPC",
        example: "aws_vpc.main.id",
        required: true,
      },
      {
        name: "subnet_ids",
        description: "適用するサブネット",
        example: "aws_subnet.private[*].id",
        required: true,
      },
      {
        name: "ingress / egress",
        description: "許可/拒否ルール",
        example: "rule_no, protocol, action, cidr_block, from_port, to_port",
        required: true,
      },
    ],
    code: `# =============================================
# Step 8: ネットワーク ACL（オプション）
# =============================================
# 通常はデフォルト NACL で十分
# コンプライアンス要件がある場合にカスタム NACL を作成

# --- プライベートサブネット用 NACL ---
resource "aws_network_acl" "private" {
  vpc_id     = aws_vpc.main.id
  subnet_ids = aws_subnet.private[*].id

  # --- インバウンドルール ---

  # VPC 内からの全通信を許可
  ingress {
    rule_no    = 100
    protocol   = "-1"
    action     = "allow"
    cidr_block = var.vpc_cidr
    from_port  = 0
    to_port    = 0
  }

  # HTTPS レスポンス（エフェメラルポート）を許可
  ingress {
    rule_no    = 200
    protocol   = "tcp"
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 1024
    to_port    = 65535
  }

  # --- アウトバウンドルール ---

  # VPC 内への全通信を許可
  egress {
    rule_no    = 100
    protocol   = "-1"
    action     = "allow"
    cidr_block = var.vpc_cidr
    from_port  = 0
    to_port    = 0
  }

  # HTTPS アウトバウンドを許可
  egress {
    rule_no    = 200
    protocol   = "tcp"
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 443
    to_port    = 443
  }

  # エフェメラルポートのレスポンスを許可
  egress {
    rule_no    = 300
    protocol   = "tcp"
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 1024
    to_port    = 65535
  }

  tags = {
    Name = "\${var.project_name}-private-nacl"
  }
}`,
    tips: [
      "ほとんどの場合、デフォルト NACL（全許可）で十分",
      "NACL はステートレス → 戻りの通信（エフェメラルポート）も明示的に許可が必要",
      "ルール番号の小さいものが優先される（100, 200, 300...）",
      "セキュリティグループとの組み合わせで多層防御を実現",
    ],
    warnings: [
      "NACL の設定ミスは VPC 全体の通信障害につながります",
      "ステートレスのため、レスポンス用のエフェメラルポート許可を忘れないこと",
    ],
    filename: "08_network_acl.tf",
  },
] as const;

// ─── Dependency Map Component ────────────────────────────────────────────────

function DependencyMap({
  currentStep,
  onStepClick,
}: {
  readonly currentStep: number;
  readonly onStepClick: (id: number) => void;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-6 mb-8">
      <h3 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
        <Workflow className="w-5 h-5 text-purple-600" />
        VPC 構築の依存関係マップ
      </h3>
      <div className="flex flex-col items-center gap-2">
        {/* Row 1: VPC */}
        <div className="flex justify-center">
          <StepNode
            step={VPC_STEPS[0]}
            isActive={currentStep === 1}
            isCompleted={currentStep > 1}
            onClick={() => onStepClick(1)}
          />
        </div>
        <ArrowDown className="w-4 h-4 text-muted-foreground" />

        {/* Row 2: Subnets, IGW, SG (parallel from VPC) */}
        <div className="flex items-start gap-6 flex-wrap justify-center">
          <StepNode
            step={VPC_STEPS[1]}
            isActive={currentStep === 2}
            isCompleted={currentStep > 2}
            onClick={() => onStepClick(2)}
          />
          <StepNode
            step={VPC_STEPS[2]}
            isActive={currentStep === 3}
            isCompleted={currentStep > 3}
            onClick={() => onStepClick(3)}
          />
          <StepNode
            step={VPC_STEPS[5]}
            isActive={currentStep === 6}
            isCompleted={currentStep > 6}
            onClick={() => onStepClick(6)}
          />
        </div>
        <ArrowDown className="w-4 h-4 text-muted-foreground" />

        {/* Row 3: NAT GW (depends on Subnets + IGW) */}
        <div className="flex justify-center">
          <StepNode
            step={VPC_STEPS[3]}
            isActive={currentStep === 4}
            isCompleted={currentStep > 4}
            onClick={() => onStepClick(4)}
          />
        </div>
        <ArrowDown className="w-4 h-4 text-muted-foreground" />

        {/* Row 4: Route Tables, VPC Endpoints */}
        <div className="flex items-start gap-6 flex-wrap justify-center">
          <StepNode
            step={VPC_STEPS[4]}
            isActive={currentStep === 5}
            isCompleted={currentStep > 5}
            onClick={() => onStepClick(5)}
          />
          <StepNode
            step={VPC_STEPS[6]}
            isActive={currentStep === 7}
            isCompleted={currentStep > 7}
            onClick={() => onStepClick(7)}
          />
          <StepNode
            step={VPC_STEPS[7]}
            isActive={currentStep === 8}
            isCompleted={currentStep > 8}
            onClick={() => onStepClick(8)}
          />
        </div>
      </div>
    </div>
  );
}

function StepNode({
  step,
  isActive,
  isCompleted,
  onClick,
}: {
  readonly step: VpcStep;
  readonly isActive: boolean;
  readonly isCompleted: boolean;
  readonly onClick: () => void;
}) {
  const Icon = step.icon;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] transition-all cursor-pointer min-w-[140px] ${
        isActive
          ? "border-purple-400 bg-purple-50 shadow-md ring-2 ring-purple-200"
          : isCompleted
            ? "border-green-300 bg-green-50"
            : "border-border bg-card hover:border-purple-200"
      }`}
    >
      {isCompleted ? (
        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
      ) : (
        <Icon className={`w-4 h-4 shrink-0 ${step.color}`} />
      )}
      <span className="text-left leading-tight">{step.title}</span>
    </button>
  );
}

// ─── Step Detail Component ───────────────────────────────────────────────────

function StepDetail({
  step,
  isOpen,
  onToggle,
}: {
  readonly step: VpcStep;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
}) {
  const Icon = step.icon;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-4 p-5 text-left hover:bg-accent/50 transition-colors"
      >
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-lg ${step.bgColor} shrink-0`}
        >
          <Icon className={`w-5 h-5 ${step.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
              Step {step.id}
            </span>
            {step.dependsOn.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                前提: Step {step.dependsOn.join(", ")}
              </span>
            )}
          </div>
          <h3 className="text-[15px] font-semibold">{step.title}</h3>
          <p className="text-[12px] text-muted-foreground">{step.subtitle}</p>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0 mt-2" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0 mt-2" />
        )}
      </button>

      {isOpen && (
        <div className="px-5 pb-5 space-y-5 border-t border-border pt-5">
          {/* Description */}
          <div>
            <h4 className="text-[13px] font-semibold mb-2">概要</h4>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Why needed */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-[13px] font-semibold text-blue-800 mb-1 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4" />
              なぜ必要？
            </h4>
            <p className="text-[12px] text-blue-700 leading-relaxed">
              {step.whyNeeded}
            </p>
          </div>

          {/* Key Settings */}
          <div>
            <h4 className="text-[13px] font-semibold mb-3">
              主要な設定項目
            </h4>
            <div className="space-y-2">
              {step.keySettings.map((setting) => (
                <div
                  key={setting.name}
                  className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                >
                  <code className="text-[12px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded shrink-0 font-mono">
                    {setting.name}
                  </code>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px]">{setting.description}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      例: {setting.example}
                    </p>
                  </div>
                  {setting.required && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 shrink-0">
                      必須
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Code */}
          <div>
            <h4 className="text-[13px] font-semibold mb-2">
              Terraform コード
            </h4>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-[12px] leading-relaxed">
              <code>{step.code}</code>
            </pre>
            <div className="mt-2">
              <DownloadCodeButton
                code={step.code}
                filename={step.filename}
              />
            </div>
          </div>

          {/* Tips */}
          {step.tips.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="text-[13px] font-semibold text-green-800 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                ベストプラクティス
              </h4>
              <ul className="space-y-1">
                {step.tips.map((tip, i) => (
                  <li
                    key={i}
                    className="text-[12px] text-green-700 flex items-start gap-1.5"
                  >
                    <span className="text-green-500 mt-0.5">→</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {step.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="text-[13px] font-semibold text-yellow-800 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                注意点
              </h4>
              <ul className="space-y-1">
                {step.warnings.map((w, i) => (
                  <li
                    key={i}
                    className="text-[12px] text-yellow-700 flex items-start gap-1.5"
                  >
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
}

// ─── Quick Reference Card ────────────────────────────────────────────────────

function QuickReference() {
  return (
    <div className="bg-card rounded-xl border border-border p-6 mb-8">
      <h3 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
        <Server className="w-5 h-5 text-purple-600" />
        構成早見表：どのリソースをどこに配置？
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-[13px] font-semibold text-green-800 mb-2">
            パブリックサブネット
          </h4>
          <ul className="space-y-1.5 text-[12px] text-green-700">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              ALB（Application Load Balancer）
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              NAT Gateway
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Bastion Host（踏み台サーバー）
            </li>
          </ul>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-[13px] font-semibold text-blue-800 mb-2">
            プライベートサブネット
          </h4>
          <ul className="space-y-1.5 text-[12px] text-blue-700">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              ECS タスク / EC2 インスタンス
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              RDS / Aurora データベース
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              ElastiCache（Redis / Memcached）
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Lambda（VPC 内実行時）
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── CIDR Calculator ─────────────────────────────────────────────────────────

function CidrHelper() {
  const cidrExamples = [
    { cidr: "/16", ips: "65,536", use: "VPC 全体（推奨）" },
    { cidr: "/20", ips: "4,096", use: "小規模 VPC" },
    { cidr: "/24", ips: "256", use: "サブネット（推奨）" },
    { cidr: "/25", ips: "128", use: "小規模サブネット" },
    { cidr: "/26", ips: "64", use: "最小限のサブネット" },
    { cidr: "/28", ips: "16", use: "最小サブネット（AWS 最小）" },
  ] as const;

  const subnetPlan = [
    {
      name: "public-1a",
      cidr: "10.0.1.0/24",
      az: "ap-northeast-1a",
      type: "パブリック",
    },
    {
      name: "public-1c",
      cidr: "10.0.2.0/24",
      az: "ap-northeast-1c",
      type: "パブリック",
    },
    {
      name: "private-1a",
      cidr: "10.0.10.0/24",
      az: "ap-northeast-1a",
      type: "プライベート",
    },
    {
      name: "private-1c",
      cidr: "10.0.20.0/24",
      az: "ap-northeast-1c",
      type: "プライベート",
    },
    {
      name: "db-1a",
      cidr: "10.0.100.0/24",
      az: "ap-northeast-1a",
      type: "DB 専用",
    },
    {
      name: "db-1c",
      cidr: "10.0.110.0/24",
      az: "ap-northeast-1c",
      type: "DB 専用",
    },
  ] as const;

  return (
    <div className="bg-card rounded-xl border border-border p-6 mb-8">
      <h3 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
        <Network className="w-5 h-5 text-purple-600" />
        CIDR 早見表 & サブネット設計例
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CIDR Quick Reference */}
        <div>
          <h4 className="text-[13px] font-semibold mb-2">CIDR サイズ一覧</h4>
          <div className="space-y-1.5">
            {cidrExamples.map((item) => (
              <div
                key={item.cidr}
                className="flex items-center gap-3 text-[12px] p-2 bg-muted/50 rounded"
              >
                <code className="text-purple-600 font-mono w-8">
                  {item.cidr}
                </code>
                <span className="w-16 text-right">{item.ips} IP</span>
                <span className="text-muted-foreground">{item.use}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            ※ AWS は各サブネットで 5 IP を予約（先頭4つ + 最後1つ）
          </p>
        </div>

        {/* Subnet Plan Example */}
        <div>
          <h4 className="text-[13px] font-semibold mb-2">
            推奨サブネット設計（VPC: 10.0.0.0/16）
          </h4>
          <div className="space-y-1.5">
            {subnetPlan.map((s) => (
              <div
                key={s.name}
                className={`flex items-center gap-2 text-[12px] p-2 rounded ${
                  s.type === "パブリック"
                    ? "bg-green-50"
                    : s.type === "DB 専用"
                      ? "bg-orange-50"
                      : "bg-blue-50"
                }`}
              >
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    s.type === "パブリック"
                      ? "bg-green-200 text-green-800"
                      : s.type === "DB 専用"
                        ? "bg-orange-200 text-orange-800"
                        : "bg-blue-200 text-blue-800"
                  }`}
                >
                  {s.type}
                </span>
                <code className="text-[11px] font-mono">{s.cidr}</code>
                <span className="text-muted-foreground text-[11px]">
                  {s.az}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function VpcStepGuide() {
  const [openSteps, setOpenSteps] = useState<ReadonlySet<number>>(
    new Set([1])
  );
  const [currentStep, setCurrentStep] = useState(1);

  const handleToggle = (id: number) => {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleStepClick = (id: number) => {
    setCurrentStep(id);
    setOpenSteps((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleDownloadAll = () => {
    VPC_STEPS.forEach((step, i) => {
      setTimeout(() => {
        const blob = new Blob([step.code], {
          type: "text/plain;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = step.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, i * 200);
    });
  };

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[28px] font-bold mb-2">
            VPC 構築ステップバイステップ
          </h1>
          <p className="text-muted-foreground text-[14px]">
            Terraform で VPC を構築する際に、何を・どの順序で設定するかを
            依存関係マップと共にステップバイステップで解説します
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleDownloadAll}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 text-white text-[13px] hover:bg-purple-700 transition-colors"
            >
              <Server className="w-4 h-4" />
              全ステップを一括ダウンロード（{VPC_STEPS.length} ファイル）
            </button>
          </div>
        </div>

        {/* Quick Reference */}
        <QuickReference />

        {/* CIDR Helper */}
        <CidrHelper />

        {/* Dependency Map */}
        <DependencyMap
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />

        {/* Step Cards */}
        <div className="space-y-4">
          {VPC_STEPS.map((step) => (
            <StepDetail
              key={step.id}
              step={step}
              isOpen={openSteps.has(step.id)}
              onToggle={() => handleToggle(step.id)}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
