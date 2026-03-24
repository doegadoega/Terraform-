import { useState } from "react";
import { FolderTree, GitBranch, Lock, Users, Zap, ShieldCheck, FileCode, Layers, ChevronDown, ChevronUp } from "lucide-react";
import { DownloadCodeButton } from "./DownloadCodeButton";

interface Practice {
  title: string;
  icon: React.ElementType;
  color: string;
  description: string;
  dos: string[];
  donts: string[];
  codeExample?: string;
  references?: string[];
}

const practices: Practice[] = [
  {
    title: "ディレクトリ構成",
    icon: FolderTree,
    color: "bg-blue-500",
    description: "適切なファイル・ディレクトリ構成でプロジェクトを整理し、保守性と再利用性を高めましょう。",
    dos: [
      "環境ごとにディレクトリを分離（environments/dev, environments/prod）",
      "共通モジュールを modules/ にまとめる",
      "変数（variables.tf）と出力（outputs.tf）を専用ファイルに分離",
      "プロバイダー設定は providers.tf に集約",
      "バックエンド設定は backend.tf に分離",
      "README.md にモジュールの使い方を記載",
    ],
    donts: [
      "すべてを1つのmain.tfに書く（数百行超えは分割のサイン）",
      "環境固有の値をハードコード",
      "モジュールなしで巨大な設定ファイルを作る",
      ".terraform/ をGitにコミット",
    ],
    codeExample: `# 推奨ディレクトリ構成
project/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── terraform.tfvars
│   │   └── backend.tf
│   ├── staging/
│   └── prod/
├── modules/
│   ├── networking/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── compute/
│   └── database/
├── .gitignore
└── README.md`,
  },
  {
    title: "State管理",
    icon: Lock,
    color: "bg-green-500",
    description: "State ファイルを安全に管理し、チーム作業を円滑に進めるための重要なプラクティス。",
    dos: [
      "リモートバックエンド（S3+DynamoDB, Azure Blob, GCS等）を使用",
      "State のロック機能を有効化（同時実行防止）",
      "機密情報の暗号化を設定（encrypt = true）",
      "環境・サービスごとにStateを分割（blast radius軽減）",
      "定期的にStateのバックアップを取得",
      "terraform state mv でリファクタリング時の移動を行う",
    ],
    donts: [
      "ローカルにStateを保存したまま運用（チーム開発不可）",
      "Stateファイルをgitにコミット（機密情報漏洩リスク）",
      "手動でStateファイルを直接編集",
      "1つのStateで100以上のリソースを管理",
      "State Lockを無効化する",
    ],
    codeExample: `# S3 + DynamoDB バックエンドの設定
terraform {
  backend "s3" {
    bucket         = "mycompany-terraform-state"
    key            = "services/api/terraform.tfstate"
    region         = "ap-northeast-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
    
    # クロスアカウントアクセス
    role_arn = "arn:aws:iam::123456789012:role/TerraformRole"
  }
}

# DynamoDB テーブルの作成（別のTerraformプロジェクトで管理）
resource "aws_dynamodb_table" "terraform_lock" {
  name         = "terraform-state-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  
  attribute {
    name = "LockID"
    type = "S"
  }
}`,
  },
  {
    title: "バージョン管理",
    icon: GitBranch,
    color: "bg-purple-500",
    description: "プロバイダーとモジュールのバージョンを適切に管理し、再現性と安定性を確保します。",
    dos: [
      "required_providers でバージョン制約を明記",
      "required_version でTerraform本体のバージョンも指定",
      "モジュールのバージョンを固定（version = \"5.0.0\"）",
      ".terraform.lock.hcl をGitにコミット",
      "定期的にプロバイダーのアップグレードを計画",
      "CHANGELOG を確認してからアップグレード",
    ],
    donts: [
      "バージョン指定なしでプロバイダーを使用",
      "最新版を常に自動取得する設定（version = \">= 0.0.0\"）",
      "ロックファイルを .gitignore に追加",
      "メジャーバージョンを跨いだ一括アップグレード",
    ],
    codeExample: `terraform {
  # Terraform本体のバージョン制約
  required_version = ">= 1.5.0, < 2.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"   # 5.x の最新を許容
    }
    random = {
      source  = "hashicorp/random"
      version = "= 3.5.1"  # 厳密に固定
    }
  }
}

# バージョン制約の記法
# = 1.0.0   : 完全一致
# != 1.0.0  : 除外
# > 1.0.0   : より大きい
# >= 1.0.0  : 以上
# < 2.0.0   : より小さい
# ~> 1.0    : >= 1.0, < 2.0（マイナーバージョンまで許容）
# ~> 1.0.0  : >= 1.0.0, < 1.1.0（パッチバージョンまで許容）`,
  },
  {
    title: "セキュリティ",
    icon: ShieldCheck,
    color: "bg-red-500",
    description: "機密情報の管理とアクセス制御を適切に行い、セキュリティリスクを最小化します。",
    dos: [
      "機密情報は環境変数または外部シークレットマネージャーを使用",
      "sensitive = true で出力値をマスク",
      "IAMの最小権限の原則を適用",
      "checkov / tfsec 等のセキュリティスキャンツールを導入",
      "Stateファイルのアクセス権限を制限",
      "terraform plan の結果をレビューしてから apply",
    ],
    donts: [
      "パスワードやAPIキーをtfファイルにハードコード",
      "terraform.tfvars に機密情報を入れてGitにコミット",
      "Admin権限でTerraformを実行",
      "セキュリティグループで 0.0.0.0/0 を安易に許可",
    ],
    codeExample: `# 機密情報の安全な管理
variable "db_password" {
  description = "データベースパスワード"
  type        = string
  sensitive   = true  # plan/applyの出力でマスクされる
}

# AWS Secrets Managerからの取得
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "prod/db/password"
}

resource "aws_db_instance" "main" {
  password = data.aws_secretsmanager_secret_version.db_password.secret_string
  # ...
}

# .gitignore に追加すべきファイル
# *.tfvars      （機密変数を含む場合）
# .terraform/
# *.tfstate
# *.tfstate.backup
# crash.log`,
    references: ["tfsec - Terraformセキュリティスキャナー", "checkov - IaCスキャンツール", "Sentinel - HashiCorp のポリシーエンジン"],
  },
  {
    title: "チーム運用",
    icon: Users,
    color: "bg-orange-500",
    description: "チームでの安全な運用フローを構築し、変更管理のプロセスを確立します。",
    dos: [
      "CI/CDパイプラインでplan/applyを実行",
      "PRレビューでplan結果を確認（atlantis等の活用）",
      "Terraform CloudまたはSpaceliftの活用を検討",
      "terraform fmt と terraform validate をCIに組み込む",
      "変更はfeatureブランチで行い、mainへのマージ時にapply",
      "apply の実行ログを保存・監査",
    ],
    donts: [
      "個人のローカル環境からapplyを実行",
      "レビューなしでインフラ変更",
      "共有アカウントの認証情報を使用",
      "コミュニケーションなしで同時にapply",
      "手動変更（ドリフト）を放置",
    ],
    codeExample: `# GitHub Actions での CI/CD パイプライン例
# .github/workflows/terraform.yml
name: Terraform
on:
  pull_request:
    paths: ['terraform/**']
  push:
    branches: [main]

jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.7.0"
      
      - name: Terraform Init
        run: terraform init
      
      - name: Terraform Format Check
        run: terraform fmt -check
      
      - name: Terraform Validate
        run: terraform validate
      
      - name: Terraform Plan
        if: github.event_name == 'pull_request'
        run: terraform plan -no-color
      
      - name: Terraform Apply
        if: github.ref == 'refs/heads/main'
        run: terraform apply -auto-approve`,
  },
  {
    title: "命名規則",
    icon: FileCode,
    color: "bg-teal-500",
    description: "一貫した命名規則を使用して、リソースの識別と管理を容易にします。",
    dos: [
      "リソース名にはスネークケース（snake_case）を使用",
      "リソースタイプのプレフィックスは省略（aws_instance.web_server）",
      "環境名、プロジェクト名を含む命名規則を統一",
      "タグにも命名規則を適用（Name, Environment, Project等）",
      "モジュール名は目的を表す名前にする",
    ],
    donts: [
      "キャメルケースやケバブケースを混在させる",
      "リソースタイプ名を繰り返す（aws_instance.aws_instance_web）",
      "意味のない名前（main, this, example）を本番で使用",
      "タグなしでリソースを作成",
    ],
    codeExample: `# 良い例
resource "aws_instance" "web_server" {
  tags = {
    Name        = "myapp-web-prod"
    Environment = "production"
    Project     = "myapp"
    ManagedBy   = "terraform"
    Team        = "platform"
  }
}

# 命名規則テンプレート: {project}-{component}-{environment}
# 例: myapp-web-prod, myapp-db-staging

# ローカル変数で命名規則を統一
locals {
  name_prefix = "\${var.project}-\${var.component}-\${var.environment}"
  
  common_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}`,
  },
  {
    title: "モジュール設計",
    icon: Layers,
    color: "bg-indigo-500",
    description: "再利用可能で保守しやすいモジュールを設計するためのガイドライン。",
    dos: [
      "1つのモジュールは1つの責務に集中させる",
      "入力変数（variables.tf）にすべて description と type を付ける",
      "出力値（outputs.tf）で必要な情報を公開する",
      "README.md にモジュールの使い方とサンプルを記載",
      "バージョニング（Git tag）を行う",
      "validation ブロックで入力値を検証",
    ],
    donts: [
      "1つのモジュールで10以上のリソースを管理（分割検討）",
      "プロバイダー設定をモジュール内に書く",
      "モジュール内でハードコードされた値を使う",
      "密結合なモジュール設計（他モジュールへの直接参照）",
    ],
    codeExample: `# modules/web-server/variables.tf
variable "instance_type" {
  description = "EC2インスタンスタイプ"
  type        = string
  default     = "t3.micro"
  
  validation {
    condition     = can(regex("^t[23]\\\\.", var.instance_type))
    error_message = "t2 または t3 ファミリーのみ許可されています。"
  }
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

# modules/web-server/outputs.tf
output "instance_id" {
  description = "作成されたEC2インスタンスのID"
  value       = aws_instance.web.id
}

output "public_ip" {
  description = "パブリックIPアドレス"
  value       = aws_instance.web.public_ip
}`,
  },
  {
    title: "パフォーマンス",
    icon: Zap,
    color: "bg-yellow-500",
    description: "大規模なインフラ管理を効率的に行い、plan/applyの実行時間を最適化します。",
    dos: [
      "Stateを適切に分割（マイクロスタック・ブラストレディアス軽減）",
      "-target で必要なリソースのみ操作（開発時）",
      "-parallelism で並列度を調整（デフォルト10）",
      "-refresh=false で不要なリフレッシュを省略",
      "moved ブロックでStateの移動を宣言的に管理（v1.1+）",
      "terraform_remote_state で他のStateを参照",
    ],
    donts: [
      "1つのStateで数百リソースを管理（plan/applyが遅くなる）",
      "不要なデータソースの多用（API呼び出しが増加）",
      "毎回全リソースのrefreshを実行（大規模環境では非効率）",
      "-target を常用（本番では避ける）",
    ],
    codeExample: `# State分割の例（terraform_remote_state による参照）
# networking/ プロジェクト
output "vpc_id" {
  value = aws_vpc.main.id
}

# application/ プロジェクト
data "terraform_remote_state" "networking" {
  backend = "s3"
  config = {
    bucket = "terraform-state"
    key    = "networking/terraform.tfstate"
    region = "ap-northeast-1"
  }
}

resource "aws_instance" "web" {
  subnet_id = data.terraform_remote_state.networking.outputs.public_subnet_id
}

# パフォーマンスオプション
# terraform plan -parallelism=20     並列度を上げる
# terraform plan -refresh=false      リフレッシュをスキップ
# terraform plan -target=module.app  特定モジュールのみ`,
  },
];

export function BestPractices() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1>ベストプラクティス</h1>
        <p className="text-muted-foreground mt-1">
          Terraformを効果的に運用するためのガイドライン（{practices.length}カテゴリ）
        </p>
      </div>

      <div className="space-y-5">
        {practices.map((p) => {
          const isOpen = expanded === p.title;
          return (
            <div key={p.title} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                className="w-full p-6 text-left"
                onClick={() => setExpanded(isOpen ? null : p.title)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${p.color} flex items-center justify-center`}>
                      <p.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2>{p.title}</h2>
                      <p className="text-[13px] text-muted-foreground">{p.description}</p>
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="px-6 pb-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-[13px] text-green-700 mb-2">DO</p>
                      <ul className="space-y-1.5">
                        {p.dos.map((d) => (
                          <li key={d} className="text-[13px] text-green-800 flex items-start gap-2">
                            <span className="text-green-500 mt-0.5 shrink-0">+</span> {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-[13px] text-red-700 mb-2">DON'T</p>
                      <ul className="space-y-1.5">
                        {p.donts.map((d) => (
                          <li key={d} className="text-[13px] text-red-800 flex items-start gap-2">
                            <span className="text-red-500 mt-0.5 shrink-0">-</span> {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {p.codeExample && (
                    <div>
                      <p className="text-[13px] text-muted-foreground mb-2">コード例</p>
                      <div>
                        <pre className="bg-[#1e1e2e] text-[#cdd6f4] text-[13px] p-4 rounded-lg overflow-x-auto">
                          <code>{p.codeExample}</code>
                        </pre>
                        <div className="flex justify-end mt-2">
                          <DownloadCodeButton
                            code={p.codeExample}
                            filename={`${p.title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}.tf`}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {p.references && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-[12px] text-blue-700 mb-1">参考ツール</p>
                      {p.references.map((r) => (
                        <p key={r} className="text-[12px] text-blue-800">
                          {r}
                        </p>
                      ))}
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
