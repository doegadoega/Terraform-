import { useState } from "react";
import { Cloud, Server, Globe, Database, Container, Shield, GitBranch, Network } from "lucide-react";
import { DownloadCodeButton } from "./DownloadCodeButton";

interface ProviderInfo {
  name: string;
  icon: React.ElementType;
  color: string;
  description: string;
  features: string[];
  resources: { name: string; desc: string }[];
  configExample: string;
  authMethods: string[];
  useCases: string[];
}

const providers: ProviderInfo[] = [
  {
    name: "AWS",
    icon: Cloud,
    color: "bg-[#FF9900]",
    description:
      "Amazon Web Services - 世界最大のクラウドプロバイダー。200以上のサービスに対応し、Terraformプロバイダーとしても最も利用されている。1,000以上のリソースタイプをサポート。",
    features: ["最も豊富なリソースタイプ", "リージョン別の設定が容易", "IAMとの連携が強力", "CloudFormationからの移行が可能"],
    resources: [
      { name: "aws_instance", desc: "EC2インスタンス" },
      { name: "aws_s3_bucket", desc: "S3ストレージバケット" },
      { name: "aws_vpc", desc: "仮想プライベートクラウド" },
      { name: "aws_lambda_function", desc: "サーバーレス関数" },
      { name: "aws_rds_instance", desc: "リレーショナルDB" },
      { name: "aws_ecs_service", desc: "コンテナサービス" },
      { name: "aws_iam_role", desc: "IAMロール" },
      { name: "aws_cloudfront_distribution", desc: "CDN" },
    ],
    configExample: `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region  = "ap-northeast-1"
  profile = "default"
  
  default_tags {
    tags = {
      ManagedBy   = "Terraform"
      Environment = "production"
    }
  }
}

# マルチリージョン設定
provider "aws" {
  alias  = "us_east"
  region = "us-east-1"
}`,
    authMethods: [
      "AWS CLI プロファイル（~/.aws/credentials）",
      "環境変数（AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY）",
      "IAMロール（EC2インスタンスプロファイル）",
      "AWS SSO / Identity Center",
      "AssumeRole（クロスアカウント）",
    ],
    useCases: ["Webアプリのホスティング", "マイクロサービス基盤", "データレイク構築", "機械学習基盤"],
  },
  {
    name: "Azure",
    icon: Server,
    color: "bg-[#0078D4]",
    description:
      "Microsoft Azure - エンタープライズ向けクラウドサービス。Active Directory統合、ハイブリッドクラウド対応が強み。Microsoft製品との親和性が高い。",
    features: ["Azure AD統合が標準", "ハイブリッドクラウドに強い", "エンタープライズサポート", ".NET/Windows環境との親和性"],
    resources: [
      { name: "azurerm_resource_group", desc: "リソースグループ" },
      { name: "azurerm_virtual_machine", desc: "仮想マシン" },
      { name: "azurerm_storage_account", desc: "ストレージアカウント" },
      { name: "azurerm_app_service", desc: "App Service" },
      { name: "azurerm_kubernetes_cluster", desc: "AKSクラスター" },
      { name: "azurerm_sql_database", desc: "SQLデータベース" },
      { name: "azurerm_function_app", desc: "Azure Functions" },
    ],
    configExample: `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
  subscription_id = var.subscription_id
}

resource "azurerm_resource_group" "example" {
  name     = "rg-myapp-prod"
  location = "japaneast"
}`,
    authMethods: [
      "Azure CLI（az login）",
      "サービスプリンシパル（Client ID/Secret）",
      "マネージドID（Managed Identity）",
      "環境変数（ARM_*）",
    ],
    useCases: ["エンタープライズシステム", "ハイブリッドクラウド", "Microsoft 365連携", "SAP on Azure"],
  },
  {
    name: "Google Cloud",
    icon: Globe,
    color: "bg-[#4285F4]",
    description:
      "Google Cloud Platform - データ分析・ML/AIに強みを持つクラウドサービス。BigQuery、GKE、Cloud Runなどが特に人気。グローバルネットワークの品質が高い。",
    features: ["BigQueryの分析基盤", "GKEのKubernetes環境", "ML/AIサービスの充実", "グローバルネットワーク"],
    resources: [
      { name: "google_compute_instance", desc: "Compute Engine VM" },
      { name: "google_storage_bucket", desc: "Cloud Storageバケット" },
      { name: "google_container_cluster", desc: "GKEクラスター" },
      { name: "google_bigquery_dataset", desc: "BigQueryデータセット" },
      { name: "google_cloud_run_service", desc: "Cloud Runサービス" },
      { name: "google_sql_database_instance", desc: "Cloud SQL" },
      { name: "google_pubsub_topic", desc: "Pub/Subトピック" },
    ],
    configExample: `terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = "asia-northeast1"
  zone    = "asia-northeast1-a"
}

# Google Beta プロバイダー（プレビュー機能用）
provider "google-beta" {
  project = var.project_id
  region  = "asia-northeast1"
}`,
    authMethods: [
      "gcloud CLI（gcloud auth application-default login）",
      "サービスアカウントキー（JSON）",
      "Workload Identity（GKE内）",
      "環境変数（GOOGLE_CREDENTIALS）",
    ],
    useCases: ["データ分析基盤", "コンテナ化アプリ", "機械学習パイプライン", "サーバーレスアプリ"],
  },
  {
    name: "Kubernetes",
    icon: Container,
    color: "bg-[#326CE5]",
    description:
      "Kubernetesリソースの管理。Deployment、Service、ConfigMapなどをTerraformで宣言的に管理。Helmチャートとの連携も可能。",
    features: ["宣言的なK8sリソース管理", "Helmプロバイダーとの連携", "マルチクラスター管理", "インフラとアプリの一元管理"],
    resources: [
      { name: "kubernetes_deployment_v1", desc: "Deployment" },
      { name: "kubernetes_service_v1", desc: "Service" },
      { name: "kubernetes_namespace_v1", desc: "Namespace" },
      { name: "kubernetes_config_map_v1", desc: "ConfigMap" },
      { name: "kubernetes_secret_v1", desc: "Secret" },
      { name: "kubernetes_ingress_v1", desc: "Ingress" },
    ],
    configExample: `provider "kubernetes" {
  config_path    = "~/.kube/config"
  config_context = "my-cluster"
}

resource "kubernetes_namespace_v1" "app" {
  metadata {
    name = "my-app"
    labels = {
      managed-by = "terraform"
    }
  }
}

resource "kubernetes_deployment_v1" "app" {
  metadata {
    name      = "my-app"
    namespace = kubernetes_namespace_v1.app.metadata[0].name
  }
  spec {
    replicas = 3
    selector {
      match_labels = { app = "my-app" }
    }
    template {
      metadata { labels = { app = "my-app" } }
      spec {
        container {
          name  = "app"
          image = "nginx:latest"
        }
      }
    }
  }
}`,
    authMethods: [
      "kubeconfig ファイル",
      "クラウドプロバイダー認証（EKS/GKE/AKS）",
      "サービスアカウントトークン",
      "クライアント証明書",
    ],
    useCases: ["マイクロサービスデプロイ", "マルチクラスター管理", "GitOps基盤", "開発環境の自動構築"],
  },
  {
    name: "GitHub",
    icon: GitBranch,
    color: "bg-[#24292F]",
    description:
      "GitHubリソースの管理。リポジトリ、チーム、ブランチ保護ルール、Actionsシークレットなどをコードで管理。組織の大規模管理に最適。",
    features: ["リポジトリの一括管理", "チーム・権限の管理", "ブランチ保護の自動設定", "Actionsシークレット管理"],
    resources: [
      { name: "github_repository", desc: "リポジトリ" },
      { name: "github_team", desc: "チーム" },
      { name: "github_branch_protection", desc: "ブランチ保護ルール" },
      { name: "github_actions_secret", desc: "Actions シークレット" },
      { name: "github_membership", desc: "組織メンバー" },
    ],
    configExample: `provider "github" {
  token = var.github_token
  owner = "my-organization"
}

resource "github_repository" "app" {
  name        = "my-app"
  description = "Application repository"
  visibility  = "private"
  
  has_issues   = true
  has_projects = true
  
  template {
    owner      = "my-organization"
    repository = "template-repo"
  }
}

resource "github_branch_protection" "main" {
  repository_id = github_repository.app.node_id
  pattern       = "main"
  
  required_pull_request_reviews {
    required_approving_review_count = 2
  }
}`,
    authMethods: [
      "Personal Access Token（PAT）",
      "GitHub App（Installation Token）",
      "OAuth App Token",
    ],
    useCases: ["組織のリポジトリ一括管理", "セキュリティポリシーの統一", "新プロジェクトの自動セットアップ"],
  },
  {
    name: "Cloudflare",
    icon: Shield,
    color: "bg-[#F38020]",
    description:
      "CloudflareのDNS、CDN、セキュリティ機能をTerraformで管理。DNSレコード、ファイアウォールルール、Workers等の設定を自動化。",
    features: ["DNS レコード管理", "WAFルール管理", "Workers のデプロイ", "ページルールの設定"],
    resources: [
      { name: "cloudflare_record", desc: "DNSレコード" },
      { name: "cloudflare_zone", desc: "DNSゾーン" },
      { name: "cloudflare_firewall_rule", desc: "ファイアウォールルール" },
      { name: "cloudflare_worker_script", desc: "Workers スクリプト" },
      { name: "cloudflare_page_rule", desc: "ページルール" },
    ],
    configExample: `provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

resource "cloudflare_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  content = aws_lb.main.dns_name
  type    = "CNAME"
  proxied = true
}

resource "cloudflare_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = "api"
  content = "203.0.113.10"
  type    = "A"
  proxied = true
}`,
    authMethods: [
      "API Token（推奨・権限を細かく設定可能）",
      "Global API Key + Email",
    ],
    useCases: ["DNS管理の自動化", "CDN設定", "DDoS対策", "エッジコンピューティング"],
  },
  {
    name: "Docker",
    icon: Network,
    color: "bg-[#2496ED]",
    description:
      "Dockerイメージとコンテナの管理。ローカル開発環境やテスト環境の自動構築に使用。Docker ComposeのTerraform版として活用。",
    features: ["コンテナの宣言的管理", "イメージのビルド・管理", "ネットワークとボリューム管理", "開発環境の自動構築"],
    resources: [
      { name: "docker_container", desc: "コンテナ" },
      { name: "docker_image", desc: "イメージ" },
      { name: "docker_network", desc: "ネットワーク" },
      { name: "docker_volume", desc: "ボリューム" },
    ],
    configExample: `provider "docker" {
  host = "unix:///var/run/docker.sock"
}

resource "docker_image" "nginx" {
  name         = "nginx:latest"
  keep_locally = false
}

resource "docker_container" "web" {
  name  = "web-server"
  image = docker_image.nginx.image_id
  
  ports {
    internal = 80
    external = 8080
  }
  
  volumes {
    host_path      = "/path/to/html"
    container_path = "/usr/share/nginx/html"
  }
}`,
    authMethods: [
      "Unixソケット（ローカル）",
      "TCP接続（リモート）",
      "TLS証明書（セキュア接続）",
    ],
    useCases: ["ローカル開発環境", "テスト環境構築", "CI/CD パイプライン", "マイクロサービス開発"],
  },
];

export function Providers() {
  const [selected, setSelected] = useState<string>("AWS");
  const current = providers.find((p) => p.name === selected)!;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1>プロバイダー</h1>
        <p className="text-muted-foreground mt-1">
          Terraformが対応する主要なプロバイダー（{providers.length}種類）
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {providers.map((p) => (
          <button
            key={p.name}
            onClick={() => setSelected(p.name)}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
              selected === p.name
                ? "border-purple-500 bg-purple-50 shadow-sm"
                : "border-border bg-card hover:border-purple-300"
            }`}
          >
            <div className={`w-10 h-10 rounded-lg ${p.color} flex items-center justify-center`}>
              <p.icon className="w-5 h-5 text-white" />
            </div>
            <span className="text-[14px]">{p.name}</span>
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl ${current.color} flex items-center justify-center`}>
            <current.icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2>{current.name}</h2>
          </div>
        </div>
        <p className="text-[14px] text-muted-foreground leading-relaxed">{current.description}</p>

        {/* Features */}
        <div className="flex flex-wrap gap-2">
          {current.features.map((f) => (
            <span key={f} className="text-[12px] bg-purple-50 text-purple-700 px-3 py-1 rounded-full border border-purple-200">
              {f}
            </span>
          ))}
        </div>

        {/* Config example */}
        <div>
          <h3 className="mb-2">設定例</h3>
          <div>
            <pre className="bg-[#1e1e2e] text-[#cdd6f4] text-[13px] p-4 rounded-lg overflow-x-auto">
              <code>{current.configExample}</code>
            </pre>
            <div className="flex justify-end mt-2">
              <DownloadCodeButton
                code={current.configExample}
                filename={`${current.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}_provider.tf`}
              />
            </div>
          </div>
        </div>

        {/* Resources */}
        <div>
          <h3 className="mb-2">主なリソース</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {current.resources.map((r) => (
              <div key={r.name} className="flex items-center gap-2 text-[13px]">
                <code className="bg-muted px-2 py-0.5 rounded text-purple-600 shrink-0">{r.name}</code>
                <span className="text-muted-foreground">{r.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Auth methods */}
        <div>
          <h3 className="mb-2">認証方法</h3>
          <ul className="space-y-1.5">
            {current.authMethods.map((a) => (
              <li key={a} className="text-[13px] text-muted-foreground flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                {a}
              </li>
            ))}
          </ul>
        </div>

        {/* Use cases */}
        <div>
          <h3 className="mb-2">ユースケース</h3>
          <div className="flex flex-wrap gap-2">
            {current.useCases.map((u) => (
              <span key={u} className="text-[12px] bg-muted text-muted-foreground px-3 py-1 rounded-lg">
                {u}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
