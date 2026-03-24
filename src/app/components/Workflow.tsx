import { useState } from "react";
import { FileEdit, Download, Search, Play, Trash2, ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { DownloadCodeButton } from "./DownloadCodeButton";

interface Step {
  id: number;
  title: string;
  command: string;
  icon: React.ElementType;
  color: string;
  description: string;
  details: string[];
  codeExample?: string;
  warnings?: string[];
  output?: string;
}

const steps: Step[] = [
  {
    id: 1,
    title: "コードを書く",
    command: "*.tf ファイルを作成",
    icon: FileEdit,
    color: "bg-blue-500",
    description: "HCLでインフラの望ましい状態を定義します。ファイルは用途ごとに分割するのがベストプラクティスです。",
    details: [
      "main.tf にリソースを定義",
      "variables.tf に入力変数を定義",
      "outputs.tf に出力値を定義",
      "providers.tf にプロバイダー設定を記述",
      "backend.tf にState保存先を設定",
      "terraform.tfvars に変数の値を設定",
      "versions.tf にバージョン制約を記述",
    ],
    codeExample: `# main.tf
resource "aws_instance" "web" {
  ami           = var.ami_id
  instance_type = var.instance_type
  subnet_id     = aws_subnet.public.id
  
  tags = local.common_tags
}

# variables.tf
variable "instance_type" {
  description = "EC2インスタンスタイプ"
  type        = string
  default     = "t3.micro"
}

# outputs.tf
output "public_ip" {
  value = aws_instance.web.public_ip
}`,
    warnings: ["terraform.tfvars に機密情報を入れてGitにコミットしないこと"],
  },
  {
    id: 2,
    title: "初期化",
    command: "terraform init",
    icon: Download,
    color: "bg-purple-500",
    description: "プロバイダーのダウンロードとバックエンドの初期化を行います。プロジェクトのセットアップやクローン後に最初に実行するコマンドです。",
    details: [
      "プロバイダープラグインを .terraform/providers/ にダウンロード",
      "バックエンド（State保存先）を設定・初期化",
      "モジュールを .terraform/modules/ にダウンロード",
      ".terraform.lock.hcl（依存関係ロックファイル）が作成される",
      "-upgrade フラグでプロバイダーを最新版に更新可能",
      "-backend-config でバックエンド設定を外部から注入可能",
    ],
    codeExample: `$ terraform init

Initializing the backend...
Initializing provider plugins...
- Finding hashicorp/aws versions matching "~> 5.0"...
- Installing hashicorp/aws v5.31.0...
- Installed hashicorp/aws v5.31.0 (signed by HashiCorp)

Terraform has been successfully initialized!`,
    output: `生成されるファイル/ディレクトリ:
├── .terraform/
│   ├── providers/          # プロバイダープラグイン
│   └── modules/            # ダウンロードしたモジュール
└── .terraform.lock.hcl     # 依存関係ロック（Gitにコミット推奨）`,
  },
  {
    id: 3,
    title: "フォーマット & 検証",
    command: "terraform fmt && terraform validate",
    icon: CheckCircle2,
    color: "bg-teal-500",
    description: "コードのフォーマット整形と構文検証を行います。CIパイプラインに組み込むことが推奨されます。",
    details: [
      "terraform fmt: HCL標準スタイルにコードを整形",
      "terraform validate: 構文エラーや不正な参照を検出",
      "fmt -check: フォーマットされていなければエラー終了（CI向け）",
      "validate は init 後に実行する必要がある",
      "実際のインフラには一切影響しない安全な操作",
    ],
    codeExample: `$ terraform fmt -recursive
main.tf
variables.tf

$ terraform validate
Success! The configuration is valid.

# CI/CD での活用例
$ terraform fmt -check -recursive || (echo "Format check failed"; exit 1)
$ terraform validate -json | jq '.valid'`,
  },
  {
    id: 4,
    title: "計画",
    command: "terraform plan",
    icon: Search,
    color: "bg-green-500",
    description: "実行前に変更内容をプレビューし、影響範囲を確認します。PRレビューでplan結果を共有するのがベストプラクティスです。",
    details: [
      "作成(+)・変更(~)・削除(-)されるリソースを詳細表示",
      "実際のインフラには一切影響しない（読み取り専用）",
      "-out オプションで計画をファイルに保存可能",
      "保存した計画は terraform apply plan_file で適用",
      "-target で特定リソースのみの計画を作成",
      "-refresh-only で State のリフレッシュのみ実行",
      "PRのコメントに plan 結果を自動投稿するツール（Atlantis等）がある",
    ],
    codeExample: `$ terraform plan -out=tfplan

Terraform will perform the following actions:

  # aws_instance.web will be created
  + resource "aws_instance" "web" {
      + ami                    = "ami-0abcdef1234567890"
      + instance_type          = "t3.micro"
      + id                     = (known after apply)
      + public_ip              = (known after apply)
      + tags                   = {
          + "Name" = "WebServer"
        }
    }

Plan: 1 to add, 0 to change, 0 to destroy.`,
    warnings: ["plan結果が想定通りか必ず確認してからapplyすること"],
  },
  {
    id: 5,
    title: "適用",
    command: "terraform apply",
    icon: Play,
    color: "bg-orange-500",
    description: "計画に基づいてインフラを作成・変更します。本番環境では必ず plan の結果を確認してから適用しましょう。",
    details: [
      "確認プロンプトが表示される（yes を入力で実行）",
      "-auto-approve で確認をスキップ（CI向け・本番注意）",
      "plan -out で保存したファイルを指定すると確認なしで実行",
      "リソースは依存関係に基づいて並列で作成される",
      "-parallelism=N で並列実行数を調整（デフォルト: 10）",
      "State ファイルが自動的に更新される",
      "出力値（outputs）が apply 完了後に表示される",
      "-replace=RESOURCE でリソースの強制再作成が可能",
    ],
    codeExample: `# 保存したplanを適用（推奨）
$ terraform apply tfplan

aws_instance.web: Creating...
aws_instance.web: Still creating... [10s elapsed]
aws_instance.web: Creation complete after 25s [id=i-0abc123def456789]

Apply complete! Resources: 1 added, 0 changed, 0 destroyed.

Outputs:
public_ip = "54.250.xx.xx"`,
    warnings: [
      "本番環境では -auto-approve の使用は慎重に",
      "大きな変更（削除を含む）は特に注意深く確認",
    ],
  },
  {
    id: 6,
    title: "破棄（必要時）",
    command: "terraform destroy",
    icon: Trash2,
    color: "bg-red-500",
    description: "管理しているすべてのリソースを削除します。開発・テスト環境のクリーンアップに使用します。",
    details: [
      "すべてのリソースが削除対象になる（plan -destroy で事前確認推奨）",
      "確認プロンプトが表示される（yes を入力で実行）",
      "開発環境・テスト環境のクリーンアップに使用",
      "-target で特定リソースのみ削除可能",
      "依存関係の逆順でリソースが削除される",
      "Stateファイルは残る（リソースが0の状態に更新）",
    ],
    codeExample: `# 事前に削除対象を確認
$ terraform plan -destroy

# 削除を実行
$ terraform destroy

aws_instance.web: Destroying... [id=i-0abc123def456789]
aws_instance.web: Destruction complete after 30s

Destroy complete! Resources: 1 destroyed.

# 特定リソースのみ削除
$ terraform destroy -target=aws_instance.web`,
    warnings: [
      "本番環境での実行は極めて慎重に！復旧不可能な場合がある",
      "lifecycle.prevent_destroy = true でリソースの誤削除を防止可能",
    ],
  },
];

export function Workflow() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const current = steps.find((s) => s.id === activeStep)!;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1>ワークフロー</h1>
        <p className="text-muted-foreground mt-1">
          Terraformの基本的な作業フローを理解しましょう（{steps.length}ステップ）
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-2">
            <button
              onClick={() => setActiveStep(step.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all text-[14px] ${
                activeStep === step.id
                  ? `${step.color} text-white border-transparent`
                  : "bg-card border-border text-muted-foreground hover:border-purple-300"
              }`}
            >
              <step.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{step.title}</span>
              <span className="sm:hidden">{step.id}</span>
            </button>
            {i < steps.length - 1 && (
              <ArrowRight className="w-4 h-4 text-muted-foreground hidden md:block" />
            )}
          </div>
        ))}
      </div>

      {/* Active step detail */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl ${current.color} flex items-center justify-center`}>
            <current.icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2>
              Step {current.id}: {current.title}
            </h2>
            <code className="text-[13px] bg-muted px-2 py-0.5 rounded text-purple-600">
              {current.command}
            </code>
          </div>
        </div>

        <p className="text-muted-foreground leading-relaxed">{current.description}</p>

        <div className="space-y-2">
          <h3>ポイント</h3>
          <ul className="space-y-2">
            {current.details.map((d) => (
              <li key={d} className="flex items-start gap-2 text-[14px] text-muted-foreground">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                {d}
              </li>
            ))}
          </ul>
        </div>

        {current.codeExample && (
          <div>
            <h3 className="mb-2">{current.output ? "実行例" : "コード例"}</h3>
            <div>
              <pre className="bg-[#1e1e2e] text-[#cdd6f4] text-[13px] p-4 rounded-lg overflow-x-auto">
                <code>{current.codeExample}</code>
              </pre>
              <div className="flex justify-end mt-2">
                <DownloadCodeButton
                  code={current.codeExample}
                  filename={`${current.title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}.tf`}
                />
              </div>
            </div>
          </div>
        )}

        {current.output && (
          <div>
            <h3 className="mb-2">生成されるファイル</h3>
            <pre className="bg-[#1e1e2e] text-[#cdd6f4] text-[13px] p-4 rounded-lg overflow-x-auto">
              <code>{current.output}</code>
            </pre>
          </div>
        )}

        {current.warnings && current.warnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <p className="text-[13px] text-amber-700">注意事項</p>
            </div>
            {current.warnings.map((w) => (
              <p key={w} className="text-[13px] text-amber-800 ml-6">
                {w}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
