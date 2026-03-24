import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Code2,
  Database,
  Layers,
  FileCode,
  RefreshCw,
  Lock,
  Variable,
  FileOutput,
  Braces,
  Globe,
  Workflow,
  HardDrive,
} from "lucide-react";
import { DownloadCodeButton } from "./DownloadCodeButton";

interface Concept {
  title: string;
  icon: React.ElementType;
  color: string;
  summary: string;
  details: string;
  codeExample?: string;
  tips?: string[];
  category: string;
}

const concepts: Concept[] = [
  {
    title: "Infrastructure as Code (IaC)",
    icon: Code2,
    color: "bg-blue-500",
    category: "基礎",
    summary: "インフラをコードとして定義・管理するアプローチ",
    details:
      "IaCは、サーバー、ネットワーク、データベースなどのインフラをコードファイルとして記述し、バージョン管理・自動化・再現性を実現する手法です。手動でのGUIクリック操作から脱却し、一貫性のあるインフラ管理を可能にします。従来の手動管理に比べて、変更履歴の追跡、レビュープロセスの導入、環境の複製が容易になります。",
    codeExample: `# main.tf - インフラの定義例
provider "aws" {
  region = "ap-northeast-1"
}

resource "aws_instance" "web" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.micro"
  
  tags = {
    Name        = "WebServer"
    Environment = "production"
  }
}`,
    tips: [
      "宣言的（Declarative）アプローチ：望ましい状態を記述し、Terraformが差分を自動計算",
      "命令的（Imperative）アプローチとの違い：手順ではなく結果を記述する",
      "Git等でバージョン管理することで変更履歴を追跡可能",
    ],
  },
  {
    title: "HCL (HashiCorp Configuration Language)",
    icon: FileCode,
    color: "bg-purple-500",
    category: "基礎",
    summary: "Terraformで使用される宣言的な設定言語",
    details:
      "HCLはHashiCorpが開発した設定言語で、人間にとって読みやすく、機械にとってパースしやすいように設計されています。JSONと互換性がありますが、コメントや変数、関数、条件式、ループなどの機能が追加されています。拡張子は .tf を使用します。",
    codeExample: `# 変数の定義
variable "instance_type" {
  description = "EC2インスタンスタイプ"
  type        = string
  default     = "t3.micro"
}

# ローカル値
locals {
  common_tags = {
    Project     = "MyApp"
    ManagedBy   = "Terraform"
  }
}

# 条件式の使用
resource "aws_instance" "example" {
  instance_type = var.environment == "prod" ? "t3.large" : var.instance_type
  tags          = local.common_tags
}`,
    tips: [
      "# でコメントを記述可能（/* */ もサポート）",
      "文字列内で ${...} を使った式展開が可能",
      "JSONフォーマット (.tf.json) でも記述可能",
    ],
  },
  {
    title: "Variable（変数）",
    icon: Variable,
    color: "bg-indigo-500",
    category: "基礎",
    summary: "設定値をパラメータ化して再利用性を高める仕組み",
    details:
      "変数を使うことで、環境ごとに異なる値（リージョン、インスタンスサイズなど）を外部から注入できます。型制約（string, number, bool, list, map, object）を指定でき、バリデーションルールも定義可能です。変数の値は、コマンドライン引数、環境変数、.tfvarsファイル、デフォルト値の順で解決されます。",
    codeExample: `# variables.tf
variable "region" {
  description = "AWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "allowed_ports" {
  description = "許可するポートのリスト"
  type        = list(number)
  default     = [80, 443, 8080]
}

variable "environment" {
  description = "環境名"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "環境名は dev, staging, prod のいずれかです。"
  }
}

# terraform.tfvars
region      = "ap-northeast-1"
environment = "prod"`,
    tips: [
      "sensitive = true で出力時にマスクされる機密変数を定義",
      "terraform.tfvars は自動的に読み込まれる",
      "TF_VAR_変数名 の環境変数でも値を指定可能",
      "nullable = false でnull値を禁止できる",
    ],
  },
  {
    title: "Output（出力値）",
    icon: FileOutput,
    color: "bg-cyan-500",
    category: "基礎",
    summary: "Terraform実行後にリソースの情報を表示・共有する仕組み",
    details:
      "Output値は、作成されたリソースの属性（IPアドレス、ARN、URLなど）をapply後に表示したり、他のモジュールやTerraformワークスペースから参照するために使用します。CI/CDパイプラインでの値の受け渡しにも活用されます。",
    codeExample: `# outputs.tf
output "instance_ip" {
  description = "EC2インスタンスのパブリックIP"
  value       = aws_instance.web.public_ip
}

output "db_endpoint" {
  description = "RDSエンドポイント"
  value       = aws_db_instance.main.endpoint
  sensitive   = true  # 機密情報として扱う
}

output "load_balancer_dns" {
  description = "ALBのDNS名"
  value       = aws_lb.main.dns_name
  depends_on  = [aws_lb_listener.front_end]
}`,
    tips: [
      "terraform output コマンドで値を確認可能",
      "-json フラグでJSON形式の出力が可能",
      "モジュール間でのデータ共有に不可欠",
    ],
  },
  {
    title: "State（状態管理）",
    icon: Database,
    color: "bg-green-500",
    category: "中級",
    summary: "Terraformが管理するインフラの現在の状態を記録するファイル",
    details:
      "terraform.tfstate ファイルは、Terraformが作成・管理しているリソースの現在の状態をJSON形式で記録します。このファイルにより、コードの変更内容と実際のインフラの差分を検出し、必要な変更のみを適用できます。チーム開発ではリモートバックエンド（S3、Azure Blob、GCS等）に保存し、ロック機能で競合を防ぎます。",
    codeExample: `# リモートバックエンドの設定例（S3 + DynamoDB）
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "ap-northeast-1"
    encrypt        = true
    dynamodb_table = "terraform-lock"
  }
}

# State操作コマンド
# terraform state list          - リソース一覧
# terraform state show <addr>   - リソース詳細
# terraform state mv            - リソースの移動
# terraform state rm            - Stateからの除外`,
    tips: [
      "Stateファイルには機密情報（パスワード等）が含まれることがあるため暗号化必須",
      "terraform state mv でリファクタリング時のリソース移動が可能",
      "terraform import で既存リソースをState管理下に取り込める",
      "DynamoDBテーブルによるState Lockで同時実行を防止",
    ],
  },
  {
    title: "Provider（プロバイダー）",
    icon: Layers,
    color: "bg-orange-500",
    category: "基礎",
    summary: "クラウドサービスやAPIとの接続を担当するプラグイン",
    details:
      "プロバイダーは、Terraformが特定のクラウドサービス（AWS, Azure, GCPなど）やSaaSサービスと通信するためのプラグインです。各プロバイダーは、そのサービスのリソースを作成・読取・更新・削除するためのAPIを抽象化します。Terraform Registryには3,000以上のプロバイダーが公開されています。",
    codeExample: `# 複数プロバイダーの使用例
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "aws" {
  region = "ap-northeast-1"
}

# エイリアスで同一プロバイダーの複数設定
provider "aws" {
  alias  = "us_east"
  region = "us-east-1"
}`,
    tips: [
      "required_providers で使用するプロバイダーとバージョンを明示",
      "alias を使って同一プロバイダーの複数リージョン設定が可能",
      "~> はペシミスティックバージョン制約（マイナーバージョンまで許容）",
    ],
  },
  {
    title: "Resource（リソース）",
    icon: RefreshCw,
    color: "bg-red-500",
    category: "基礎",
    summary: "Terraformで管理するインフラの個々のコンポーネント",
    details:
      "リソースは、EC2インスタンス、S3バケット、VPCなど、実際のインフラコンポーネントを表します。各リソースにはタイプと名前があり、設定パラメータを指定してその振る舞いを定義します。リソース間の依存関係は自動的に解決されますが、depends_on で明示的に指定することも可能です。",
    codeExample: `# リソースの定義と依存関係
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  tags       = { Name = "main-vpc" }
}

resource "aws_subnet" "public" {
  vpc_id            = aws_vpc.main.id  # 暗黙的な依存関係
  cidr_block        = "10.0.1.0/24"
  availability_zone = "ap-northeast-1a"
}

# ライフサイクル管理
resource "aws_instance" "web" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.public.id

  lifecycle {
    create_before_destroy = true   # 削除前に新規作成
    prevent_destroy       = true   # 誤削除防止
    ignore_changes        = [tags] # タグの変更を無視
  }
}`,
    tips: [
      "リソース参照（例: aws_vpc.main.id）で暗黙的依存関係が作られる",
      "lifecycle ブロックでリソースの作成・削除の振る舞いを制御",
      "count や for_each で複数のリソースを動的に作成可能",
      "timeouts ブロックで作成・更新・削除のタイムアウトを設定",
    ],
  },
  {
    title: "Data Source（データソース）",
    icon: HardDrive,
    color: "bg-pink-500",
    category: "中級",
    summary: "Terraform外部で管理されている情報を参照する仕組み",
    details:
      "データソースは、Terraformが管理していない既存のリソースや外部情報を読み取り専用で参照する機能です。例えば、既存のVPC ID、最新のAMI ID、AWSアカウント情報などを取得してリソース定義に利用できます。データソースはインフラを変更せず、読み取りのみ行います。",
    codeExample: `# 最新のAmazon Linux 2 AMIを取得
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

# 既存VPCの参照
data "aws_vpc" "existing" {
  tags = { Name = "production-vpc" }
}

# データソースの利用
resource "aws_instance" "web" {
  ami       = data.aws_ami.amazon_linux.id
  subnet_id = tolist(data.aws_vpc.existing.cidr_block_associations)[0].cidr_block
}`,
    tips: [
      "data ブロックで定義し、data.タイプ.名前.属性 で参照",
      "既存インフラとの統合に便利",
      "planの段階で値が読み取られる",
    ],
  },
  {
    title: "Module（モジュール）",
    icon: Lock,
    color: "bg-teal-500",
    category: "中級",
    summary: "再利用可能なTerraform設定のパッケージ",
    details:
      "モジュールは、複数のリソースをまとめて再利用可能なパッケージにしたものです。DRY原則に従い、共通のインフラパターンを抽象化できます。Terraform Registryには多数のコミュニティモジュールが公開されています。ローカルモジュール、Gitリポジトリ、Terraform Registryからモジュールを利用できます。",
    codeExample: `# モジュールの使用例
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = "my-vpc"
  cidr = "10.0.0.0/16"
  
  azs             = ["ap-northeast-1a", "ap-northeast-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]
  
  enable_nat_gateway = true
  single_nat_gateway = true
}

# ローカルモジュールの使用
module "web_server" {
  source = "./modules/web-server"
  
  instance_type = "t3.micro"
  vpc_id        = module.vpc.vpc_id
  subnet_ids    = module.vpc.private_subnets
}`,
    tips: [
      "source で参照先を指定（ローカルパス、Git URL、Registry）",
      "モジュールの入力は variable、出力は output で定義",
      "terraform get または terraform init でモジュールをダウンロード",
      "モジュールのネスト（モジュールからモジュールを呼ぶ）も可能",
    ],
  },
  {
    title: "Built-in Functions（組み込み関数）",
    icon: Braces,
    color: "bg-amber-500",
    category: "中級",
    summary: "値の変換・操作に使える豊富な組み込み関数群",
    details:
      "Terraformには文字列操作、数値計算、コレクション操作、暗号化、ファイル読み込みなど、多数の組み込み関数が用意されています。terraform console コマンドでインタラクティブに試すことができます。",
    codeExample: `locals {
  # 文字列関数
  upper_name = upper("terraform")           # "TERRAFORM"
  joined     = join("-", ["web", "server"])  # "web-server"
  
  # コレクション関数
  merged_tags = merge(
    { ManagedBy = "Terraform" },
    { Environment = var.environment }
  )
  unique_zones = distinct(var.availability_zones)
  
  # 条件式とループ
  instance_count = var.environment == "prod" ? 3 : 1
  
  # for式
  upper_names = [for name in var.names : upper(name)]
  name_map    = { for name in var.names : name => upper(name) }
  
  # ファイル読み込み
  user_data = file("\${path.module}/scripts/init.sh")
  config    = yamldecode(file("config.yaml"))
}`,
    tips: [
      "terraform console で関数を対話的にテスト可能",
      "templatefile() でテンプレートファイルを変数展開",
      "try() でエラー時のフォールバック値を指定可能",
      "cidrsubnet() でCIDRブロックの計算ができる",
    ],
  },
  {
    title: "Provisioner（プロビジョナー）",
    icon: Globe,
    color: "bg-rose-500",
    category: "上級",
    summary: "リソース作成後にスクリプトを実行する仕組み（非推奨だが知っておくべき）",
    details:
      "プロビジョナーは、リソースの作成や削除時にローカルまたはリモートでスクリプトを実行する機能です。HashiCorpは「最後の手段」として位置付けており、可能な限りクラウドネイティブな手段（user_data、cloud-init等）やAnsible等の構成管理ツールの使用を推奨しています。",
    codeExample: `resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = "t3.micro"

  # 推奨: user_data を使用
  user_data = <<-EOF
    #!/bin/bash
    yum update -y
    yum install -y httpd
    systemctl start httpd
  EOF

  # 非推奨: provisioner の使用
  provisioner "remote-exec" {
    inline = [
      "sudo yum update -y",
    ]
  }

  provisioner "local-exec" {
    command = "echo \${self.private_ip} >> inventory.txt"
  }
}`,
    tips: [
      "local-exec: Terraformを実行しているマシンでコマンド実行",
      "remote-exec: 作成されたリソース上でコマンドを実行",
      "on_failure = continue でエラーを無視して続行可能",
      "代替手段: user_data, cloud-init, Ansible, Packer",
    ],
  },
  {
    title: "Workspace（ワークスペース）",
    icon: Workflow,
    color: "bg-violet-500",
    category: "上級",
    summary: "同一設定で複数の環境（dev/staging/prod）を管理する仕組み",
    details:
      "ワークスペースは、同じTerraform設定を使って複数の独立した状態（State）を管理する機能です。環境ごとにワークスペースを作成し、変数で差異を吸収することで、設定の重複を減らせます。ただし、大規模な環境差異がある場合はディレクトリ分離の方が適している場合もあります。",
    codeExample: `# ワークスペースの操作
# terraform workspace new dev
# terraform workspace new staging
# terraform workspace new prod
# terraform workspace select prod
# terraform workspace list

# ワークスペース名を変数として利用
locals {
  environment = terraform.workspace
  
  instance_types = {
    dev     = "t3.micro"
    staging = "t3.small"
    prod    = "t3.large"
  }
}

resource "aws_instance" "web" {
  instance_type = local.instance_types[local.environment]
  
  tags = {
    Environment = local.environment
  }
}`,
    tips: [
      "terraform.workspace で現在のワークスペース名を取得",
      "Stateは各ワークスペースごとに独立して管理される",
      "default ワークスペースは削除できない",
      "Terraform Cloudのワークスペースとは概念が異なる点に注意",
    ],
  },
];

const categories = ["すべて", "基礎", "中級", "上級"];

export function Concepts() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState("すべて");

  const filtered = concepts.filter((c) => filterCat === "すべて" || c.category === filterCat);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1>基本概念</h1>
        <p className="text-muted-foreground mt-1">
          Terraformを理解するための重要な概念を学びましょう（{concepts.length}トピック）
        </p>
      </div>

      <div className="flex gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={`px-3 py-1.5 rounded-lg text-[13px] border transition-colors ${
              filterCat === cat
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-card border-border text-muted-foreground hover:border-purple-300"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((concept) => {
          const isOpen = expanded === concept.title;
          return (
            <div
              key={concept.title}
              className="bg-card border border-border rounded-xl overflow-hidden transition-shadow hover:shadow-md"
            >
              <button
                className="w-full flex items-center gap-4 p-5 text-left"
                onClick={() => setExpanded(isOpen ? null : concept.title)}
              >
                <div
                  className={`w-10 h-10 rounded-lg ${concept.color} flex items-center justify-center shrink-0`}
                >
                  <concept.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[15px]">{concept.title}</p>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full ${
                        concept.category === "基礎"
                          ? "bg-green-100 text-green-700"
                          : concept.category === "中級"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {concept.category}
                    </span>
                  </div>
                  <p className="text-[13px] text-muted-foreground">{concept.summary}</p>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="px-5 pb-5 space-y-4">
                  <p className="text-[14px] text-muted-foreground leading-relaxed">
                    {concept.details}
                  </p>
                  {concept.codeExample && (
                    <div>
                      <pre className="bg-[#1e1e2e] text-[#cdd6f4] text-[13px] p-4 rounded-lg overflow-x-auto">
                        <code>{concept.codeExample}</code>
                      </pre>
                      <div className="flex justify-end mt-2">
                        <DownloadCodeButton
                          code={concept.codeExample}
                          filename={`${concept.title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}.tf`}
                        />
                      </div>
                    </div>
                  )}
                  {concept.tips && concept.tips.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-[13px] text-blue-700 mb-2">ポイント</p>
                      <ul className="space-y-1.5">
                        {concept.tips.map((tip) => (
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
