import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Layers,
  Shield,
  Server,
  Globe,
  Network,
  Key,
  Settings,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Monitor,
  Lock,
  Cloud,
} from "lucide-react";
import { DownloadCodeButton } from "./DownloadCodeButton";

type Tab =
  | "overview"
  | "provider"
  | "connector-group"
  | "app-connector"
  | "server-group"
  | "app-segment"
  | "policy"
  | "ec2-deploy"
  | "multi-az"
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
  { id: "provider", label: "プロバイダー設定", icon: Key, color: "bg-blue-600" },
  { id: "connector-group", label: "コネクタグループ", icon: Server, color: "bg-cyan-600" },
  { id: "app-connector", label: "App Connector", icon: Cloud, color: "bg-green-600" },
  { id: "server-group", label: "サーバーグループ", icon: Network, color: "bg-orange-500" },
  { id: "app-segment", label: "アプリセグメント", icon: Globe, color: "bg-amber-600" },
  { id: "policy", label: "アクセスポリシー", icon: Shield, color: "bg-red-600" },
  { id: "ec2-deploy", label: "EC2デプロイ", icon: Monitor, color: "bg-rose-600" },
  { id: "multi-az", label: "マルチAZ・HA", icon: RefreshCw, color: "bg-indigo-600" },
  { id: "operations", label: "運用・監視", icon: Settings, color: "bg-violet-600" },
];

// ─── プロバイダー設定 ───
const providerSections: Section[] = [
  {
    title: "Zscaler ZPA プロバイダー設定",
    description:
      "Zscaler Private Access (ZPA) の Terraform プロバイダーを設定します。API キーとクライアント認証情報を使用して ZPA テナントに接続します。",
    code: `# ============================
# Terraform 設定
# ============================
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    zpa = {
      source  = "zscaler/zpa"
      version = "~> 3.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "zscaler/terraform.tfstate"
    region         = "ap-northeast-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

# ============================
# ZPA プロバイダー
# ============================
provider "zpa" {
  zpa_client_id     = var.zpa_client_id
  zpa_client_secret = var.zpa_client_secret
  zpa_customer_id   = var.zpa_customer_id
  zpa_cloud         = var.zpa_cloud
}

# AWS プロバイダー
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ============================
# 変数定義
# ============================
variable "zpa_client_id" {
  description = "ZPA API クライアントID"
  type        = string
  sensitive   = true
}

variable "zpa_client_secret" {
  description = "ZPA API クライアントシークレット"
  type        = string
  sensitive   = true
}

variable "zpa_customer_id" {
  description = "ZPA カスタマーID"
  type        = string
  sensitive   = true
}

variable "zpa_cloud" {
  description = "ZPA クラウド環境 (PRODUCTION, BETA, GOV, GOVUS, PREVIEW)"
  type        = string
  default     = "PRODUCTION"

  validation {
    condition     = contains(["PRODUCTION", "BETA", "GOV", "GOVUS", "PREVIEW"], var.zpa_cloud)
    error_message = "zpa_cloud は PRODUCTION, BETA, GOV, GOVUS, PREVIEW のいずれかです。"
  }
}

variable "project" {
  description = "プロジェクト名"
  type        = string
}

variable "environment" {
  description = "環境名"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}`,
    tips: [
      "sensitive = true で terraform plan/apply の出力から認証情報を隠蔽",
      "zpa_cloud で接続先テナントの環境を切り替え可能",
      "認証情報は環境変数 (TF_VAR_zpa_client_id 等) で渡すのが安全",
      "S3 + DynamoDB バックエンドで State ファイルを安全に管理",
    ],
    warnings: [
      "ZPA API キーは管理ポータルの Administration > API Keys で発行",
      "クライアントシークレットは発行時にのみ表示される。紛失時は再発行が必要",
    ],
  },
  {
    title: "認証情報の安全な管理",
    description:
      "ZPA 認証情報を AWS Secrets Manager に保存し、CI/CD パイプラインから安全に参照する構成です。",
    code: `# ============================
# Secrets Manager で ZPA 認証情報を管理
# ============================
resource "aws_secretsmanager_secret" "zpa_credentials" {
  name        = "\${var.project}/zpa-credentials"
  description = "Zscaler ZPA API 認証情報"

  tags = {
    Name = "\${var.project}-zpa-creds"
  }
}

resource "aws_secretsmanager_secret_version" "zpa_credentials" {
  secret_id = aws_secretsmanager_secret.zpa_credentials.id

  secret_string = jsonencode({
    client_id     = var.zpa_client_id
    client_secret = var.zpa_client_secret
    customer_id   = var.zpa_customer_id
  })
}

# ============================
# CI/CD 用 IAM ロール
# ============================
resource "aws_iam_role" "terraform_ci" {
  name = "\${var.project}-terraform-ci"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "arn:aws:iam::\${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:\${var.github_org}/\${var.github_repo}:ref:refs/heads/main"
          }
        }
      }
    ]
  })

  tags = {
    Name = "\${var.project}-terraform-ci"
  }
}

resource "aws_iam_role_policy" "terraform_ci_secrets" {
  name = "\${var.project}-ci-secrets-access"
  role = aws_iam_role.terraform_ci.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.zpa_credentials.arn
      }
    ]
  })
}

data "aws_caller_identity" "current" {}

variable "github_org" {
  description = "GitHub Organization 名"
  type        = string
}

variable "github_repo" {
  description = "GitHub リポジトリ名"
  type        = string
}`,
    tips: [
      "Secrets Manager + OIDC で GitHub Actions から安全に認証",
      "IAM ロールの Condition でリポジトリ・ブランチを制限",
      "terraform.tfvars にシークレットを書かない（.gitignore 必須）",
    ],
  },
];

// ─── コネクタグループ ───
const connectorGroupSections: Section[] = [
  {
    title: "App Connector グループの作成",
    description:
      "App Connector を論理的にグループ化します。リージョンやデータセンター単位でグループを分け、コネクタの管理と冗長性を確保します。",
    code: `# ============================
# App Connector グループ（東京リージョン）
# ============================
resource "zpa_app_connector_group" "tokyo" {
  name                     = "\${var.project}-tokyo-connectors"
  description              = "東京リージョン App Connector グループ"
  enabled                  = true
  city_country             = "Tokyo, JP"
  country_code             = "JP"
  latitude                 = "35.6762"
  longitude                = "139.6503"
  location                 = "Tokyo, Japan"
  upgrade_day              = "SUNDAY"
  upgrade_time_in_secs     = "66600"
  override_version_profile = true
  version_profile_id       = "0"
  dns_query_type           = "IPV4_IPV6"
  tcp_quick_ack_app        = true
  tcp_quick_ack_assistant  = true
  tcp_quick_ack_read_assistant = true
}

# ============================
# App Connector グループ（大阪リージョン - DR用）
# ============================
resource "zpa_app_connector_group" "osaka" {
  name                     = "\${var.project}-osaka-connectors"
  description              = "大阪リージョン App Connector グループ（DR）"
  enabled                  = true
  city_country             = "Osaka, JP"
  country_code             = "JP"
  latitude                 = "34.6937"
  longitude                = "135.5023"
  location                 = "Osaka, Japan"
  upgrade_day              = "SUNDAY"
  upgrade_time_in_secs     = "66600"
  override_version_profile = true
  version_profile_id       = "0"
  dns_query_type           = "IPV4_IPV6"
  tcp_quick_ack_app        = true
  tcp_quick_ack_assistant  = true
  tcp_quick_ack_read_assistant = true
}

# ============================
# App Connector グループ（開発環境）
# ============================
resource "zpa_app_connector_group" "dev" {
  name                     = "\${var.project}-dev-connectors"
  description              = "開発環境用 App Connector グループ"
  enabled                  = true
  city_country             = "Tokyo, JP"
  country_code             = "JP"
  latitude                 = "35.6762"
  longitude                = "139.6503"
  location                 = "Tokyo, Japan"
  upgrade_day              = "SATURDAY"
  upgrade_time_in_secs     = "3600"
  override_version_profile = true
  version_profile_id       = "2"
  dns_query_type           = "IPV4"
}`,
    tips: [
      "upgrade_day / upgrade_time_in_secs でメンテナンスウィンドウを制御",
      "version_profile_id: 0=Default, 1=Previous, 2=New Release",
      "tcp_quick_ack を有効にするとパフォーマンスが向上する場合がある",
      "DR用に別リージョンのグループを作成して冗長性を確保",
    ],
    warnings: [
      "latitude / longitude は正確に指定しないと最寄り ZEN への接続に影響",
    ],
  },
];

// ─── App Connector (Provisioning Key) ───
const appConnectorSections: Section[] = [
  {
    title: "App Connector プロビジョニングキー",
    description:
      "App Connector を自動登録するためのプロビジョニングキーを生成します。EC2 のユーザーデータで使用して自動セットアップします。",
    code: `# ============================
# Enrollment Certificate（データソース）
# ============================
data "zpa_enrollment_cert" "connector" {
  name = "Connector"
}

# ============================
# プロビジョニングキー（東京）
# ============================
resource "zpa_provisioning_key" "tokyo" {
  name             = "\${var.project}-tokyo-key"
  association_type = "CONNECTOR_GRP"
  max_usage        = "10"
  enrollment_cert_id = data.zpa_enrollment_cert.connector.id
  zcomponent_id      = zpa_app_connector_group.tokyo.id

  depends_on = [zpa_app_connector_group.tokyo]
}

# ============================
# プロビジョニングキー（大阪）
# ============================
resource "zpa_provisioning_key" "osaka" {
  name             = "\${var.project}-osaka-key"
  association_type = "CONNECTOR_GRP"
  max_usage        = "10"
  enrollment_cert_id = data.zpa_enrollment_cert.connector.id
  zcomponent_id      = zpa_app_connector_group.osaka.id

  depends_on = [zpa_app_connector_group.osaka]
}

# ============================
# Secrets Manager にキーを保存
# ============================
resource "aws_secretsmanager_secret" "provisioning_key_tokyo" {
  name        = "\${var.project}/zpa-provisioning-key-tokyo"
  description = "ZPA App Connector プロビジョニングキー（東京）"

  tags = {
    Name   = "\${var.project}-zpa-key-tokyo"
    Region = "ap-northeast-1"
  }
}

resource "aws_secretsmanager_secret_version" "provisioning_key_tokyo" {
  secret_id     = aws_secretsmanager_secret.provisioning_key_tokyo.id
  secret_string = zpa_provisioning_key.tokyo.provisioning_key
}

resource "aws_secretsmanager_secret" "provisioning_key_osaka" {
  name        = "\${var.project}/zpa-provisioning-key-osaka"
  description = "ZPA App Connector プロビジョニングキー（大阪）"

  tags = {
    Name   = "\${var.project}-zpa-key-osaka"
    Region = "ap-northeast-3"
  }
}

resource "aws_secretsmanager_secret_version" "provisioning_key_osaka" {
  secret_id     = aws_secretsmanager_secret.provisioning_key_osaka.id
  secret_string = zpa_provisioning_key.osaka.provisioning_key
}`,
    tips: [
      "max_usage でプロビジョニングキーの使用回数を制限",
      "プロビジョニングキーは Secrets Manager に保存して安全に管理",
      "association_type = CONNECTOR_GRP でコネクタグループに紐付け",
      "Enrollment Certificate は ZPA ポータルで事前に確認",
    ],
    warnings: [
      "プロビジョニングキーが漏洩すると不正なコネクタが登録される可能性がある",
      "max_usage を超えるとキーが無効化される。ASG のスケーリングを考慮した値を設定",
    ],
  },
];

// ─── サーバーグループ ───
const serverGroupSections: Section[] = [
  {
    title: "サーバーグループの作成",
    description:
      "App Connector 経由でアクセスする内部サーバーをグループ化します。アプリケーションサーバーやデータベースサーバーを論理的に整理します。",
    code: `# ============================
# サーバーグループ（Webアプリケーション）
# ============================
resource "zpa_server_group" "web_apps" {
  name              = "\${var.project}-web-servers"
  description       = "Webアプリケーションサーバーグループ"
  enabled           = true
  dynamic_discovery = false

  app_connector_groups {
    id = [zpa_app_connector_group.tokyo.id]
  }

  servers {
    id = [zpa_application_server.web1.id]
  }

  servers {
    id = [zpa_application_server.web2.id]
  }
}

# ============================
# サーバーグループ（データベース）
# ============================
resource "zpa_server_group" "databases" {
  name              = "\${var.project}-db-servers"
  description       = "データベースサーバーグループ"
  enabled           = true
  dynamic_discovery = false

  app_connector_groups {
    id = [zpa_app_connector_group.tokyo.id]
  }

  servers {
    id = [zpa_application_server.db1.id]
  }
}

# ============================
# サーバーグループ（動的検出 - DNS ベース）
# ============================
resource "zpa_server_group" "dynamic" {
  name              = "\${var.project}-dynamic-servers"
  description       = "DNS動的検出サーバーグループ"
  enabled           = true
  dynamic_discovery = true

  app_connector_groups {
    id = [
      zpa_app_connector_group.tokyo.id,
      zpa_app_connector_group.osaka.id
    ]
  }
}

# ============================
# アプリケーションサーバー定義
# ============================
resource "zpa_application_server" "web1" {
  name        = "\${var.project}-web-1"
  description = "Webサーバー 1"
  address     = "10.0.1.10"
  enabled     = true
}

resource "zpa_application_server" "web2" {
  name        = "\${var.project}-web-2"
  description = "Webサーバー 2"
  address     = "10.0.1.11"
  enabled     = true
}

resource "zpa_application_server" "db1" {
  name        = "\${var.project}-db-1"
  description = "データベースサーバー"
  address     = "10.0.2.10"
  enabled     = true
}`,
    tips: [
      "dynamic_discovery = true で DNS ベースの自動検出が可能",
      "複数の App Connector グループを紐付けて冗長性を確保",
      "サーバーグループを用途別（Web / DB / 管理系）に分割して管理",
      "address には IP アドレスまたは FQDN を指定可能",
    ],
  },
];

// ─── アプリセグメント ───
const appSegmentSections: Section[] = [
  {
    title: "アプリケーションセグメント（TCP）",
    description:
      "ZPA 経由でアクセスする内部アプリケーションを定義します。ドメイン名・ポート・プロトコルでアクセス範囲を制御します。",
    code: `# ============================
# アプリセグメント: 社内Webアプリケーション
# ============================
resource "zpa_application_segment" "web_app" {
  name             = "\${var.project}-web-app"
  description      = "社内Webアプリケーション"
  enabled          = true
  health_reporting = "ON_ACCESS"
  bypass_type      = "NEVER"
  is_cname_enabled = true
  tcp_keep_alive   = "1"

  ip_anchored = false

  domain_names = [
    "app.internal.example.com",
    "dashboard.internal.example.com"
  ]

  tcp_port_ranges = ["443", "443", "8080", "8080"]

  segment_group_id = zpa_segment_group.web.id

  server_groups {
    id = [zpa_server_group.web_apps.id]
  }
}

# ============================
# アプリセグメント: SSH アクセス
# ============================
resource "zpa_application_segment" "ssh" {
  name             = "\${var.project}-ssh-access"
  description      = "SSH リモートアクセス"
  enabled          = true
  health_reporting = "ON_ACCESS"
  bypass_type      = "NEVER"
  is_cname_enabled = false

  domain_names = [
    "bastion.internal.example.com",
    "*.servers.internal.example.com"
  ]

  tcp_port_ranges = ["22", "22"]

  segment_group_id = zpa_segment_group.infra.id

  server_groups {
    id = [zpa_server_group.web_apps.id]
  }
}

# ============================
# アプリセグメント: データベースアクセス
# ============================
resource "zpa_application_segment" "database" {
  name             = "\${var.project}-database"
  description      = "データベースアクセス（PostgreSQL / MySQL）"
  enabled          = true
  health_reporting = "ON_ACCESS"
  bypass_type      = "NEVER"
  is_cname_enabled = false

  domain_names = [
    "db-primary.internal.example.com",
    "db-replica.internal.example.com"
  ]

  tcp_port_ranges = ["5432", "5432", "3306", "3306"]

  segment_group_id = zpa_segment_group.data.id

  server_groups {
    id = [zpa_server_group.databases.id]
  }
}

# ============================
# アプリセグメント: RDP（リモートデスクトップ）
# ============================
resource "zpa_application_segment" "rdp" {
  name             = "\${var.project}-rdp-access"
  description      = "Windows リモートデスクトップ"
  enabled          = true
  health_reporting = "ON_ACCESS"
  bypass_type      = "NEVER"
  is_cname_enabled = false

  domain_names = [
    "*.windows.internal.example.com"
  ]

  tcp_port_ranges = ["3389", "3389"]

  segment_group_id = zpa_segment_group.infra.id

  server_groups {
    id = [zpa_server_group.web_apps.id]
  }
}

# ============================
# セグメントグループ
# ============================
resource "zpa_segment_group" "web" {
  name        = "\${var.project}-web-segments"
  description = "Webアプリケーションセグメントグループ"
  enabled     = true
}

resource "zpa_segment_group" "infra" {
  name        = "\${var.project}-infra-segments"
  description = "インフラ管理セグメントグループ"
  enabled     = true
}

resource "zpa_segment_group" "data" {
  name        = "\${var.project}-data-segments"
  description = "データアクセスセグメントグループ"
  enabled     = true
}`,
    tips: [
      "tcp_port_ranges は [開始, 終了] のペアで指定（単一ポートは同値2つ）",
      "health_reporting = ON_ACCESS でアクセス時にヘルスチェック実施",
      "bypass_type = NEVER で常にZPA経由を強制",
      "ワイルドカード (*.servers.internal) でサブドメイン一括定義が可能",
      "セグメントグループで論理的な分類（Web / インフラ / データ）を管理",
    ],
    warnings: [
      "domain_names は ZPA の DNS 解決に依存。内部 DNS が正しく設定されている必要がある",
    ],
  },
];

// ─── アクセスポリシー ───
const policySections: Section[] = [
  {
    title: "アクセスポリシー（条件付きアクセス）",
    description:
      "ユーザーグループ、デバイスポスチャー、時間帯などの条件に基づいてアプリケーションへのアクセスを制御するポリシーです。",
    code: `# ============================
# アクセスポリシールール: 管理者 → 全アプリ
# ============================
resource "zpa_policy_access_rule" "admin_access" {
  name        = "\${var.project}-admin-full-access"
  description = "管理者グループに全アプリへのアクセスを許可"
  action      = "ALLOW"
  rule_order  = "1"

  conditions {
    operator = "OR"

    operands {
      object_type = "APP_GROUP"
      lhs         = "id"
      rhs         = zpa_segment_group.web.id
    }

    operands {
      object_type = "APP_GROUP"
      lhs         = "id"
      rhs         = zpa_segment_group.infra.id
    }

    operands {
      object_type = "APP_GROUP"
      lhs         = "id"
      rhs         = zpa_segment_group.data.id
    }
  }

  conditions {
    operator = "OR"

    operands {
      object_type = "SCIM_GROUP"
      lhs         = data.zpa_idp_controller.main.id
      rhs         = data.zpa_scim_groups.admins.id
    }
  }
}

# ============================
# アクセスポリシールール: 開発者 → Web + DB
# ============================
resource "zpa_policy_access_rule" "dev_access" {
  name        = "\${var.project}-dev-access"
  description = "開発者グループにWebとDBアクセスを許可"
  action      = "ALLOW"
  rule_order  = "2"

  conditions {
    operator = "OR"

    operands {
      object_type = "APP_GROUP"
      lhs         = "id"
      rhs         = zpa_segment_group.web.id
    }

    operands {
      object_type = "APP_GROUP"
      lhs         = "id"
      rhs         = zpa_segment_group.data.id
    }
  }

  conditions {
    operator = "OR"

    operands {
      object_type = "SCIM_GROUP"
      lhs         = data.zpa_idp_controller.main.id
      rhs         = data.zpa_scim_groups.developers.id
    }
  }
}

# ============================
# アクセスポリシールール: 一般社員 → Webのみ
# ============================
resource "zpa_policy_access_rule" "user_access" {
  name        = "\${var.project}-user-web-only"
  description = "一般社員はWebアプリケーションのみアクセス可能"
  action      = "ALLOW"
  rule_order  = "3"

  conditions {
    operator = "OR"

    operands {
      object_type = "APP_GROUP"
      lhs         = "id"
      rhs         = zpa_segment_group.web.id
    }
  }

  conditions {
    operator = "OR"

    operands {
      object_type = "SCIM_GROUP"
      lhs         = data.zpa_idp_controller.main.id
      rhs         = data.zpa_scim_groups.all_users.id
    }
  }
}

# ============================
# デフォルト拒否ルール
# ============================
resource "zpa_policy_access_rule" "deny_all" {
  name        = "\${var.project}-deny-all"
  description = "マッチしないアクセスを全て拒否"
  action      = "DENY"
  rule_order  = "99"
}

# ============================
# IdP / SCIM データソース
# ============================
data "zpa_idp_controller" "main" {
  name = var.idp_name
}

data "zpa_scim_groups" "admins" {
  name     = "Admins"
  idp_name = var.idp_name
}

data "zpa_scim_groups" "developers" {
  name     = "Developers"
  idp_name = var.idp_name
}

data "zpa_scim_groups" "all_users" {
  name     = "All Users"
  idp_name = var.idp_name
}

variable "idp_name" {
  description = "Identity Provider 名 (Azure AD, Okta 等)"
  type        = string
}`,
    tips: [
      "rule_order で評価順序を明示的に制御（数値が小さいほど優先）",
      "最後に deny_all ルールを配置してホワイトリスト型を実現",
      "SCIM_GROUP で IdP のグループ情報に基づくアクセス制御",
      "conditions の AND/OR 組み合わせで複雑な条件を表現可能",
    ],
    warnings: [
      "ポリシー変更は即座に反映される。テスト環境で十分に検証してから適用",
    ],
  },
];

// ─── EC2 デプロイ ───
const ec2DeploySections: Section[] = [
  {
    title: "EC2 への App Connector デプロイ",
    description:
      "AWS EC2 インスタンスに App Connector をユーザーデータで自動インストール・登録する構成です。AMI は Zscaler 公式のものを使用します。",
    code: `# ============================
# Zscaler App Connector AMI（データソース）
# ============================
data "aws_ami" "zscaler_connector" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ============================
# App Connector 用セキュリティグループ
# ============================
resource "aws_security_group" "connector" {
  name_prefix = "\${var.project}-zpa-connector-"
  vpc_id      = var.vpc_id
  description = "Zscaler App Connector セキュリティグループ"

  # ZPA Broker へのアウトバウンド
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "ZPA Cloud / Broker への HTTPS 接続"
  }

  # 内部アプリケーションへのアクセス
  egress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "VPC 内部へのアクセス"
  }

  # DNS
  egress {
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = [var.vpc_cidr]
    description = "DNS 解決"
  }

  # NTP
  egress {
    from_port   = 123
    to_port     = 123
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "NTP 時刻同期"
  }

  tags = {
    Name = "\${var.project}-zpa-connector-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ============================
# App Connector EC2 インスタンス
# ============================
resource "aws_instance" "connector" {
  count = var.connector_count

  ami                    = data.aws_ami.zscaler_connector.id
  instance_type          = var.connector_instance_type
  subnet_id              = var.private_subnet_ids[count.index % length(var.private_subnet_ids)]
  vpc_security_group_ids = [aws_security_group.connector.id]
  iam_instance_profile   = aws_iam_instance_profile.connector.name

  user_data = base64encode(templatefile("\${path.module}/templates/connector-userdata.sh.tpl", {
    provisioning_key = zpa_provisioning_key.tokyo.provisioning_key
  }))

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  tags = {
    Name        = "\${var.project}-zpa-connector-\${count.index + 1}"
    Environment = var.environment
    Role        = "zpa-connector"
  }
}

# ============================
# IAM ロール（Secrets Manager アクセス用）
# ============================
resource "aws_iam_role" "connector" {
  name = "\${var.project}-zpa-connector-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "\${var.project}-connector-role"
  }
}

resource "aws_iam_role_policy" "connector_ssm" {
  name = "\${var.project}-connector-ssm"
  role = aws_iam_role.connector.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:DescribeInstanceInformation",
          "ssm:UpdateInstanceInformation",
          "ssmmessages:*",
          "ec2messages:*"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "\${aws_cloudwatch_log_group.connector.arn}:*"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "connector" {
  name = "\${var.project}-zpa-connector"
  role = aws_iam_role.connector.name
}

resource "aws_cloudwatch_log_group" "connector" {
  name              = "/zscaler/\${var.project}/app-connector"
  retention_in_days = 30

  tags = {
    Name = "\${var.project}-connector-logs"
  }
}

variable "vpc_id" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "connector_count" {
  description = "App Connector の台数"
  type        = number
  default     = 2
}

variable "connector_instance_type" {
  description = "EC2 インスタンスタイプ"
  type        = string
  default     = "m5.large"
}`,
    tips: [
      "m5.large 以上を推奨（ネットワークスループット確保）",
      "http_tokens = required で IMDSv2 を強制（セキュリティ強化）",
      "SSM Agent でリモート管理が可能（SSHポート不要）",
      "count.index % length(subnets) で AZ を分散配置",
    ],
    warnings: [
      "App Connector はプライベートサブネットに配置し、インターネットへの HTTPS アウトバウンドは NAT Gateway 経由",
      "セキュリティグループのインバウンドルールは不要（コネクタからアウトバウンド接続のみ）",
    ],
  },
  {
    title: "ユーザーデータテンプレート",
    description:
      "EC2 起動時に App Connector を自動インストール・登録するシェルスクリプトテンプレートです。",
    code: `# ============================
# templates/connector-userdata.sh.tpl
# ============================
#!/bin/bash
set -euo pipefail

# ログ出力
exec > >(tee /var/log/zpa-connector-setup.log) 2>&1
echo "=== ZPA App Connector Setup Start: $(date) ==="

# システム更新
yum update -y

# Zscaler リポジトリ追加
cat > /etc/yum.repos.d/zscaler.repo << 'REPO'
[zscaler]
name=Zscaler Private Access
baseurl=https://yum.private.zscaler.com/yum/el9
enabled=1
gpgcheck=1
gpgkey=https://yum.private.zscaler.com/yum/el9/gpg
REPO

# App Connector インストール
yum install -y zpa-connector

# プロビジョニングキー設定
echo "\${provisioning_key}" > /opt/zscaler/var/provision_key
chmod 644 /opt/zscaler/var/provision_key

# App Connector 起動
systemctl enable zpa-connector
systemctl start zpa-connector

# ヘルスチェック待機
sleep 30
systemctl status zpa-connector

echo "=== ZPA App Connector Setup Complete: $(date) ==="`,
    tips: [
      "set -euo pipefail でエラー時にスクリプトを即座に停止",
      "exec > >(tee ...) でセットアップログをファイルに保存",
      "provision_key ファイルのパーミッションは 644 に設定",
      "systemctl enable で OS 再起動後も自動起動",
    ],
  },
];

// ─── マルチAZ・HA ───
const multiAzSections: Section[] = [
  {
    title: "Auto Scaling Group によるHA構成",
    description:
      "App Connector を Auto Scaling Group で管理し、障害時の自動復旧と負荷分散を実現します。",
    code: `# ============================
# 起動テンプレート
# ============================
resource "aws_launch_template" "connector" {
  name_prefix   = "\${var.project}-zpa-connector-"
  image_id      = data.aws_ami.zscaler_connector.id
  instance_type = var.connector_instance_type

  vpc_security_group_ids = [aws_security_group.connector.id]

  iam_instance_profile {
    arn = aws_iam_instance_profile.connector.arn
  }

  user_data = base64encode(templatefile("\${path.module}/templates/connector-userdata.sh.tpl", {
    provisioning_key = zpa_provisioning_key.tokyo.provisioning_key
  }))

  block_device_mappings {
    device_name = "/dev/xvda"

    ebs {
      volume_type = "gp3"
      volume_size = 20
      encrypted   = true
    }
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  tag_specifications {
    resource_type = "instance"

    tags = {
      Name        = "\${var.project}-zpa-connector"
      Environment = var.environment
      Role        = "zpa-connector"
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ============================
# Auto Scaling Group
# ============================
resource "aws_autoscaling_group" "connector" {
  name_prefix         = "\${var.project}-zpa-connector-"
  desired_capacity    = var.connector_desired
  min_size            = var.connector_min
  max_size            = var.connector_max
  vpc_zone_identifier = var.private_subnet_ids
  health_check_type   = "EC2"
  health_check_grace_period = 300

  launch_template {
    id      = aws_launch_template.connector.id
    version = "$Latest"
  }

  instance_refresh {
    strategy = "Rolling"

    preferences {
      min_healthy_percentage = 50
      instance_warmup        = 300
    }
  }

  tag {
    key                 = "Name"
    value               = "\${var.project}-zpa-connector"
    propagate_at_launch = true
  }

  tag {
    key                 = "Environment"
    value               = var.environment
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ============================
# スケーリングポリシー（CPU使用率）
# ============================
resource "aws_autoscaling_policy" "connector_cpu" {
  name                   = "\${var.project}-connector-cpu-scaling"
  autoscaling_group_name = aws_autoscaling_group.connector.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 60.0
  }
}

# ============================
# CloudWatch アラーム
# ============================
resource "aws_cloudwatch_metric_alarm" "connector_health" {
  alarm_name          = "\${var.project}-zpa-connector-health"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  metric_name         = "GroupInServiceInstances"
  namespace           = "AWS/AutoScaling"
  period              = 60
  statistic           = "Average"
  threshold           = var.connector_min
  alarm_description   = "App Connector のインスタンス数が最小値を下回っています"

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.connector.name
  }

  alarm_actions = [var.sns_alert_topic_arn]

  tags = {
    Name = "\${var.project}-connector-health"
  }
}

variable "connector_desired" {
  type    = number
  default = 2
}

variable "connector_min" {
  type    = number
  default = 2
}

variable "connector_max" {
  type    = number
  default = 4
}

variable "sns_alert_topic_arn" {
  description = "アラート通知用 SNS トピック ARN"
  type        = string
}`,
    tips: [
      "min_size = 2 以上で常に冗長構成を維持",
      "instance_refresh でローリングアップデートが可能",
      "health_check_grace_period = 300 でコネクタの初期化時間を確保",
      "CPU 60% をターゲットにスケーリングで余裕を持った運用",
    ],
    warnings: [
      "ASG でスケールアウトする場合、provisioning_key の max_usage に注意",
    ],
  },
];

// ─── 運用・監視 ───
const operationsSections: Section[] = [
  {
    title: "監視とアラート設定",
    description:
      "App Connector の稼働状態を CloudWatch で監視し、障害時にアラートを発報する構成です。",
    code: `# ============================
# CloudWatch ダッシュボード
# ============================
resource "aws_cloudwatch_dashboard" "zpa" {
  dashboard_name = "\${var.project}-zpa-connectors"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Connector CPU Utilization"
          region = var.aws_region
          metrics = [
            ["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", aws_autoscaling_group.connector.name, { stat = "Average" }]
          ]
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Network In/Out"
          region = var.aws_region
          metrics = [
            ["AWS/EC2", "NetworkIn", "AutoScalingGroupName", aws_autoscaling_group.connector.name, { stat = "Sum" }],
            ["AWS/EC2", "NetworkOut", "AutoScalingGroupName", aws_autoscaling_group.connector.name, { stat = "Sum" }]
          ]
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "ASG Instance Count"
          region = var.aws_region
          metrics = [
            ["AWS/AutoScaling", "GroupInServiceInstances", "AutoScalingGroupName", aws_autoscaling_group.connector.name],
            ["AWS/AutoScaling", "GroupDesiredCapacity", "AutoScalingGroupName", aws_autoscaling_group.connector.name]
          ]
          period = 60
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "Status Check Failed"
          region = var.aws_region
          metrics = [
            ["AWS/EC2", "StatusCheckFailed", "AutoScalingGroupName", aws_autoscaling_group.connector.name, { stat = "Sum" }]
          ]
          period = 60
        }
      }
    ]
  })
}

# ============================
# ステータスチェックアラーム
# ============================
resource "aws_cloudwatch_metric_alarm" "status_check" {
  alarm_name          = "\${var.project}-connector-status-check"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "App Connector EC2 ステータスチェック失敗"

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.connector.name
  }

  alarm_actions = [var.sns_alert_topic_arn]

  tags = {
    Name = "\${var.project}-connector-status"
  }
}

# ============================
# ネットワークスループットアラーム
# ============================
resource "aws_cloudwatch_metric_alarm" "network_high" {
  alarm_name          = "\${var.project}-connector-network-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "NetworkOut"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 500000000
  alarm_description   = "App Connector のネットワーク送信が高い (>500MB/5min)"

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.connector.name
  }

  alarm_actions = [var.sns_alert_topic_arn]

  tags = {
    Name = "\${var.project}-connector-network"
  }
}

# ============================
# outputs.tf
# ============================
output "connector_group_ids" {
  description = "App Connector グループ ID"
  value = {
    tokyo = zpa_app_connector_group.tokyo.id
    osaka = zpa_app_connector_group.osaka.id
  }
}

output "segment_group_ids" {
  description = "セグメントグループ ID"
  value = {
    web   = zpa_segment_group.web.id
    infra = zpa_segment_group.infra.id
    data  = zpa_segment_group.data.id
  }
}

output "asg_name" {
  description = "Auto Scaling Group 名"
  value       = aws_autoscaling_group.connector.name
}`,
    tips: [
      "StatusCheckFailed でハードウェア・ネットワーク障害を即座に検知",
      "NetworkOut の閾値でトラフィック異常を検知",
      "ダッシュボードで CPU / ネットワーク / インスタンス数を一覧監視",
      "outputs で他モジュールからの参照を容易に",
    ],
  },
];

// ─── タブとセクションのマッピング ───
function getSectionsForTab(tab: Tab): Section[] {
  const mapping: Record<Tab, Section[]> = {
    overview: [],
    provider: providerSections,
    "connector-group": connectorGroupSections,
    "app-connector": appConnectorSections,
    "server-group": serverGroupSections,
    "app-segment": appSegmentSections,
    policy: policySections,
    "ec2-deploy": ec2DeploySections,
    "multi-az": multiAzSections,
    operations: operationsSections,
  };
  return mapping[tab];
}

// ─── 全体像タブ ───
function OverviewTab() {
  const architecture = [
    { icon: Key, name: "ZPA プロバイダー", desc: "API認証・テナント接続設定", color: "text-blue-600" },
    { icon: Server, name: "App Connector グループ", desc: "コネクタの論理グループ（リージョン/環境別）", color: "text-cyan-600" },
    { icon: Cloud, name: "App Connector", desc: "EC2上で動作するトンネルエージェント", color: "text-green-600" },
    { icon: Network, name: "サーバーグループ", desc: "内部サーバーの論理グループ", color: "text-orange-600" },
    { icon: Globe, name: "アプリセグメント", desc: "ZPA経由でアクセスするアプリ定義", color: "text-amber-600" },
    { icon: Shield, name: "アクセスポリシー", desc: "ユーザー/グループベースの認可ルール", color: "text-red-600" },
  ];

  const flows = [
    {
      title: "基本構成: EC2 App Connector",
      description: "EC2にApp Connectorをデプロイし、VPC内アプリにゼロトラストアクセス",
      steps: ["User + ZCC", "→ ZPA Cloud", "→ App Connector (EC2)", "→ Internal App"],
      color: "bg-blue-100 text-blue-800",
    },
    {
      title: "HA構成: ASG + マルチAZ",
      description: "Auto Scaling Groupで冗長性と自動復旧を実現",
      steps: ["ASG (min:2)", "→ AZ-a + AZ-c", "→ Rolling Update"],
      color: "bg-green-100 text-green-800",
    },
    {
      title: "DR構成: マルチリージョン",
      description: "東京・大阪の両リージョンにコネクタを配置",
      steps: ["Tokyo Group", "+ Osaka Group", "→ Failover"],
      color: "bg-amber-100 text-amber-800",
    },
    {
      title: "ポリシー制御: RBAC",
      description: "IdPグループに基づくロールベースアクセス制御",
      steps: ["IdP (Azure AD)", "→ SCIM Groups", "→ Policy Rules", "→ Segment Access"],
      color: "bg-purple-100 text-purple-800",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-[16px] font-medium mb-4">ZPA コンポーネント構成</h3>
        <div className="grid grid-cols-2 gap-3">
          {architecture.map((c) => (
            <div key={c.name} className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
              <c.icon className={`w-5 h-5 ${c.color} shrink-0 mt-0.5`} />
              <div>
                <span className="text-[13px] font-medium">{c.name}</span>
                <p className="text-[12px] text-muted-foreground mt-0.5">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-[16px] font-medium mb-4">デプロイパターン</h3>
        <div className="grid grid-cols-1 gap-4">
          {flows.map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-xl p-5">
              <h4 className="text-[14px] font-medium mb-1">{f.title}</h4>
              <p className="text-[13px] text-muted-foreground mb-3">{f.description}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {f.steps.map((step, i) => (
                  <span key={i} className={`text-[12px] px-2.5 py-1 rounded-full ${step.startsWith("→") || step.startsWith("+") ? "text-muted-foreground" : f.color}`}>
                    {step}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-amber-600" />
          <span className="text-[12px] font-medium text-amber-700">ゼロトラストの原則</span>
        </div>
        <ul className="space-y-1.5">
          {[
            "App Connector は内部ネットワークからアウトバウンド接続のみ（インバウンドポート不要）",
            "アプリケーション単位でアクセスを制御（ネットワーク全体ではなく）",
            "IdP 連携で常にユーザー認証・認可を実施",
            "全通信はTLSで暗号化されたトンネル経由",
          ].map((item, i) => (
            <li key={i} className="text-[12px] text-amber-700 flex items-start gap-2">
              <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
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
export function ZscalerConnector() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const sections = getSectionsForTab(activeTab);

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-[24px] font-bold mb-2">Zscaler App Connector</h1>
          <p className="text-[14px] text-muted-foreground">
            Zscaler Private Access (ZPA) の App Connector を Terraform で構築・管理するパターン集 — EC2デプロイ、HA構成、ポリシー設計、運用監視
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
