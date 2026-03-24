import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Trophy,
  BookOpen,
  Zap,
  HelpCircle,
  ArrowRight,
} from "lucide-react";

type Difficulty = "初級" | "中級" | "上級";
type Category =
  | "基礎"
  | "VPC"
  | "コンテナ"
  | "Lambda"
  | "運用"
  | "セキュリティ";

interface Exercise {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  codeSnippet?: string;
  difficulty: Difficulty;
  category: Category;
}

const exercises: Exercise[] = [
  {
    id: 1,
    question:
      "Terraform で既にデプロイ済みのインフラの現在の状態を記録しているファイルはどれですか？",
    options: [
      "main.tf",
      "terraform.tfstate",
      "variables.tf",
      "terraform.tfvars",
    ],
    correctIndex: 1,
    explanation:
      "terraform.tfstate は Terraform が管理するリソースの現在の状態を JSON 形式で記録するファイルです。このファイルによりコードと実際のインフラの差分を検出し、必要な変更のみを適用できます。",
    difficulty: "初級",
    category: "基礎",
  },
  {
    id: 2,
    question:
      "terraform plan コマンドの役割として正しいものはどれですか？",
    options: [
      "インフラリソースを実際に作成・変更・削除する",
      "実行計画を表示し、変更内容を事前に確認する",
      "Terraform の初期化とプロバイダーのダウンロードを行う",
      "State ファイルをリモートバックエンドに同期する",
    ],
    correctIndex: 1,
    explanation:
      "terraform plan は実行計画を作成し、どのリソースが作成・変更・削除されるかを事前に確認するコマンドです。実際にインフラを変更するのは terraform apply です。",
    difficulty: "初級",
    category: "基礎",
  },
  {
    id: 3,
    question:
      "以下の HCL コードで、VPC の DNS ホスト名を有効にするために必要な設定はどれですか？",
    codeSnippet: `resource "aws_vpc" "main" {
  cidr_block         = "10.0.0.0/16"
  enable_dns_support = true
  # ここに何を追加する？
}`,
    options: [
      'dns_hostnames = "enabled"',
      "enable_dns_hostnames = true",
      'dns_resolution = "on"',
      "hostname_support = true",
    ],
    correctIndex: 1,
    explanation:
      "enable_dns_hostnames = true で VPC 内のインスタンスにパブリック DNS ホスト名が割り当てられるようになります。ECS タスクの通信にも必要な設定です。",
    difficulty: "初級",
    category: "VPC",
  },
  {
    id: 4,
    question:
      "プライベートサブネット内の ECS タスクがインターネット（ECR からのイメージプル等）にアクセスするために必要なものはどれですか？",
    options: [
      "Internet Gateway",
      "NAT Gateway",
      "Transit Gateway",
      "VPN Gateway",
    ],
    correctIndex: 1,
    explanation:
      "NAT Gateway はプライベートサブネットからインターネットへのアウトバウンド通信を可能にします。ECS タスクが ECR からイメージをプルしたり、外部 API に接続する際に必要です。Internet Gateway はパブリックサブネット用で双方向通信が可能ですが、プライベートサブネットには不適切です。",
    difficulty: "中級",
    category: "VPC",
  },
  {
    id: 5,
    question:
      "ECS Fargate のタスク定義で、target_type を何に設定する必要がありますか？",
    codeSnippet: `resource "aws_lb_target_group" "app" {
  name        = "my-app-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "???"
}`,
    options: ['"instance"', '"ip"', '"lambda"', '"alb"'],
    correctIndex: 1,
    explanation:
      'Fargate では target_type = "ip" が必須です。Fargate タスクは動的に IP アドレスが割り当てられるため、インスタンスベースではなく IP ベースでターゲットを管理する必要があります。EC2 起動タイプの場合は "instance" を使います。',
    difficulty: "中級",
    category: "コンテナ",
  },
  {
    id: 6,
    question:
      "ECR にプッシュしたイメージの脆弱性スキャンを自動で実行するには、どの設定を有効にしますか？",
    options: [
      "encryption_configuration",
      "image_scanning_configuration の scan_on_push",
      "lifecycle_policy",
      "image_tag_mutability",
    ],
    correctIndex: 1,
    explanation:
      "image_scanning_configuration で scan_on_push = true を設定すると、イメージがプッシュされるたびに自動的に CVE 脆弱性スキャンが実行されます。",
    difficulty: "初級",
    category: "コンテナ",
  },
  {
    id: 7,
    question:
      "Lambda 関数をコンテナイメージからデプロイする場合、package_type に何を指定しますか？",
    options: ['"Zip"', '"Image"', '"Container"', '"Docker"'],
    correctIndex: 1,
    explanation:
      'package_type = "Image" を指定すると、ECR に登録したコンテナイメージから Lambda 関数をデプロイできます。通常の ZIP デプロイの場合は "Zip"（デフォルト）です。',
    difficulty: "中級",
    category: "Lambda",
  },
  {
    id: 8,
    question:
      "Terraform で既存の VPC を管理下に取り込まず、読み取り専用で参照する方法はどれですか？",
    options: [
      "terraform import コマンド",
      "data ブロック（Data Source）",
      "resource ブロック",
      "module ブロック",
    ],
    correctIndex: 1,
    explanation:
      "data ブロック（Data Source）を使うと、Terraform 管理外のリソースを読み取り専用で参照できます。import はリソースを Terraform 管理下に取り込むため、変更・削除のリスクがあります。別チームが管理する VPC を参照する場合は Data Source が安全です。",
    difficulty: "中級",
    category: "運用",
  },
  {
    id: 9,
    question:
      "以下のコードの cidrsubnet 関数で、2番目のサブネットに割り当てられる CIDR ブロックはどれですか？",
    codeSnippet: `resource "aws_subnet" "public" {
  count      = 2
  vpc_id     = aws_vpc.main.id
  cidr_block = cidrsubnet("10.0.0.0/16", 8, count.index)
}`,
    options: [
      "10.0.0.0/24",
      "10.0.1.0/24",
      "10.0.2.0/24",
      "10.0.0.0/16",
    ],
    correctIndex: 1,
    explanation:
      "cidrsubnet(\"10.0.0.0/16\", 8, count.index) は /16 のネットワークを /24（16+8）に分割します。count.index=0 で 10.0.0.0/24、count.index=1 で 10.0.1.0/24 が割り当てられます。",
    difficulty: "上級",
    category: "VPC",
  },
  {
    id: 10,
    question:
      "ECS サービスでデプロイ失敗時に自動ロールバックを有効にするブロックはどれですか？",
    options: [
      "deployment_configuration",
      "deployment_circuit_breaker",
      "rollback_configuration",
      "deployment_controller",
    ],
    correctIndex: 1,
    explanation:
      "deployment_circuit_breaker ブロックで enable = true, rollback = true を設定すると、デプロイが失敗した場合に自動的に前のバージョンにロールバックされます。",
    difficulty: "中級",
    category: "コンテナ",
  },
  {
    id: 11,
    question:
      "別の AWS アカウントにデプロイする際の最も安全な方法はどれですか？",
    options: [
      "アクセスキーを terraform.tfvars にハードコード",
      "AssumeRole でクロスアカウントアクセス",
      "IAM ユーザーの認証情報を共有",
      "ルートアカウントの認証情報を使用",
    ],
    correctIndex: 1,
    explanation:
      "AssumeRole が最も安全な方法です。一時的な認証情報が発行され、CloudTrail に誰がどのアカウントで何を実行したか記録されます。アクセスキーのハードコードは漏洩リスクが高く、ルートアカウントの使用は AWS のベストプラクティスに反します。",
    difficulty: "中級",
    category: "運用",
  },
  {
    id: 12,
    question:
      "ECS タスク定義の container_definitions で、機密情報（DB パスワード等）を安全に注入する方法はどれですか？",
    options: [
      "environment ブロックに直接記述",
      "secrets ブロックで Secrets Manager / SSM Parameter Store を参照",
      "terraform.tfvars にパスワードを記述",
      "Dockerfile の ENV に記述",
    ],
    correctIndex: 1,
    explanation:
      "secrets ブロックで AWS Secrets Manager や SSM Parameter Store の ARN を指定すると、ECS Agent が安全に値を取得してコンテナに注入します。環境変数への直接記述や tfvars への記載は平文で保存されるため危険です。",
    difficulty: "中級",
    category: "セキュリティ",
  },
  {
    id: 13,
    question:
      "Terraform 1.5 以降で、既存リソースを State に取り込むための宣言的な方法はどれですか？",
    options: [
      "terraform import コマンド",
      "import ブロックを .tf ファイルに記述",
      "terraform state mv コマンド",
      "data ブロックで参照",
    ],
    correctIndex: 1,
    explanation:
      "Terraform 1.5+ では import ブロックを .tf ファイルに記述し、terraform plan で事前確認してから apply で取り込むことができます。従来の terraform import コマンドと異なり、plan で差分を確認できるため安全です。",
    difficulty: "上級",
    category: "運用",
  },
  {
    id: 14,
    question:
      "ECS タスク定義の IAM ロールのうち、ECR からのイメージプルや CloudWatch Logs への書き込みを許可するのはどちらですか？",
    options: [
      "タスクロール（task_role_arn）",
      "タスク実行ロール（execution_role_arn）",
      "サービスロール",
      "インスタンスロール",
    ],
    correctIndex: 1,
    explanation:
      "タスク実行ロール (execution_role_arn) は ECS Agent が使うロールで、ECR からのイメージプルや CloudWatch Logs への書き込み権限を持ちます。タスクロール (task_role_arn) はコンテナ内のアプリケーションが AWS サービスにアクセスするためのロールです。",
    difficulty: "中級",
    category: "コンテナ",
  },
  {
    id: 15,
    question:
      "ECR イメージを東京リージョンから大阪リージョンに自動的に複製するリソースはどれですか？",
    options: [
      "aws_ecr_repository",
      "aws_ecr_replication_configuration",
      "aws_ecr_lifecycle_policy",
      "aws_ecr_pull_through_cache_rule",
    ],
    correctIndex: 1,
    explanation:
      "aws_ecr_replication_configuration を使うと、ECR リポジトリのイメージを別リージョンや別アカウントに自動的に複製できます。プッシュ時に自動実行されるため、DR 対策やマルチリージョンデプロイに最適です。",
    difficulty: "上級",
    category: "運用",
  },
  {
    id: 16,
    question:
      "以下のセキュリティグループの設定で、ECS タスクへのアクセスを ALB からのみに制限しているのはどの設定ですか？",
    codeSnippet: `resource "aws_security_group" "ecs_tasks" {
  name   = "ecs-tasks-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]  # ???
  }
}`,
    options: [
      "cidr_blocks でパブリック IP を指定",
      "security_groups で ALB の SG を参照",
      "self = true で自己参照",
      "prefix_list_ids でプレフィックスリストを指定",
    ],
    correctIndex: 1,
    explanation:
      "security_groups に ALB のセキュリティグループ ID を指定することで、ALB からのトラフィックのみ許可できます。CIDR ブロックではなく SG 参照を使うことで、ALB の IP が変わっても自動追従します。これは最小権限の原則に基づくベストプラクティスです。",
    difficulty: "中級",
    category: "セキュリティ",
  },
  {
    id: 17,
    question:
      "Terraform で同じプロバイダー（例: AWS）を複数リージョンで使い分けるための機能はどれですか？",
    options: [
      "terraform workspace",
      "provider の alias",
      "module の for_each",
      "backend の設定",
    ],
    correctIndex: 1,
    explanation:
      'provider ブロックに alias を設定すると、同じプロバイダーを異なる設定（リージョンなど）で複数定義できます。モジュール呼び出し時に providers = { aws = aws.osaka } のように使い分けます。',
    difficulty: "中級",
    category: "運用",
  },
  {
    id: 18,
    question:
      "Lambda コンテナイメージのベースイメージとして AWS が公式に提供しているレジストリはどれですか？",
    options: [
      "docker.io/amazon/lambda",
      "public.ecr.aws/lambda/",
      "gcr.io/aws-lambda/",
      "registry.hub.docker.com/aws/",
    ],
    correctIndex: 1,
    explanation:
      "AWS は public.ecr.aws/lambda/ で公式の Lambda ベースイメージを提供しています。Node.js、Python、Java、Go 等の各ランタイム用が用意されており、Lambda Runtime Interface Client が含まれています。",
    difficulty: "初級",
    category: "Lambda",
  },
  {
    id: 19,
    question:
      "ECS サービスでタスクの CPU 使用率に応じて自動スケーリングを設定する場合、predefined_metric_type に何を指定しますか？",
    options: [
      "ALBRequestCountPerTarget",
      "ECSServiceAverageCPUUtilization",
      "EC2SpotFleetRequestAverageCPUUtilization",
      "DynamoDBReadCapacityUtilization",
    ],
    correctIndex: 1,
    explanation:
      "ECSServiceAverageCPUUtilization を指定すると、ECS サービスの平均 CPU 使用率に基づいてタスク数を自動調整できます。target_value に閾値（例: 70.0）を設定し、それを超えるとスケールアウトします。",
    difficulty: "上級",
    category: "コンテナ",
  },
  {
    id: 20,
    question:
      "API Gateway (HTTP API v2) で Lambda 関数を統合する場合、integration_type に指定するのはどれですか？",
    codeSnippet: `resource "aws_apigatewayv2_integration" "lambda" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "???"
  integration_uri    = aws_lambda_function.app.invoke_arn
}`,
    options: ['"HTTP_PROXY"', '"AWS_PROXY"', '"LAMBDA"', '"AWS"'],
    correctIndex: 1,
    explanation:
      'AWS_PROXY（Lambda プロキシ統合）を指定すると、API Gateway がリクエスト全体をそのまま Lambda に渡し、Lambda のレスポンスをそのままクライアントに返します。マッピングテンプレートの設定が不要でシンプルです。',
    difficulty: "上級",
    category: "Lambda",
  },
];

const difficultyConfig: Record<
  Difficulty,
  { bg: string; text: string; border: string }
> = {
  "初級": {
    bg: "bg-green-100",
    text: "text-green-700",
    border: "border-green-200",
  },
  "中級": {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    border: "border-yellow-200",
  },
  "上級": { bg: "bg-red-100", text: "text-red-700", border: "border-red-200" },
};

const categoryConfig: Record<Category, string> = {
  "基礎": "bg-blue-100 text-blue-700",
  VPC: "bg-indigo-100 text-indigo-700",
  "コンテナ": "bg-cyan-100 text-cyan-700",
  Lambda: "bg-amber-100 text-amber-700",
  "運用": "bg-purple-100 text-purple-700",
  "セキュリティ": "bg-rose-100 text-rose-700",
};

const allCategories: ("すべて" | Category)[] = [
  "すべて",
  "基礎",
  "VPC",
  "コンテナ",
  "Lambda",
  "運用",
  "セキュリティ",
];

const allDifficulties: ("すべて" | Difficulty)[] = [
  "すべて",
  "初級",
  "中級",
  "上級",
];

export function Exercises() {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<"すべて" | Category>(
    "すべて"
  );
  const [filterDifficulty, setFilterDifficulty] = useState<
    "すべて" | Difficulty
  >("すべて");

  const filtered = exercises.filter((ex) => {
    const catMatch =
      filterCategory === "すべて" || ex.category === filterCategory;
    const diffMatch =
      filterDifficulty === "すべて" || ex.difficulty === filterDifficulty;
    return catMatch && diffMatch;
  });

  const answeredCount = filtered.filter((ex) => revealed.has(ex.id)).length;
  const correctCount = filtered.filter(
    (ex) => revealed.has(ex.id) && answers[ex.id] === ex.correctIndex
  ).length;

  const handleSelect = (exerciseId: number, optionIndex: number) => {
    if (revealed.has(exerciseId)) return;
    setAnswers((prev) => ({ ...prev, [exerciseId]: optionIndex }));
  };

  const handleReveal = (exerciseId: number) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.add(exerciseId);
      return next;
    });
  };

  const handleReset = () => {
    setAnswers({});
    setRevealed(new Set());
    setExpandedId(null);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1>演習問題</h1>
        <p className="text-muted-foreground mt-1">
          Terraform の知識を確認する {exercises.length} 問の演習問題
        </p>
      </div>

      {/* Score bar */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span className="text-[15px]">スコア</span>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[13px] text-muted-foreground hover:bg-accent transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            リセット
          </button>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[32px]">{correctCount}</span>
          <span className="text-muted-foreground text-[14px]">
            / {filtered.length} 問中（回答済: {answeredCount}）
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5 mt-3">
          <div
            className="bg-purple-600 h-2.5 rounded-full transition-all"
            style={{
              width: `${filtered.length > 0 ? (correctCount / filtered.length) * 100 : 0}%`,
            }}
          />
        </div>
        {answeredCount === filtered.length && filtered.length > 0 && (
          <div
            className={`mt-3 p-3 rounded-lg text-[14px] ${
              correctCount === filtered.length
                ? "bg-green-50 border border-green-200 text-green-700"
                : correctCount >= filtered.length * 0.8
                  ? "bg-blue-50 border border-blue-200 text-blue-700"
                  : correctCount >= filtered.length * 0.6
                    ? "bg-yellow-50 border border-yellow-200 text-yellow-700"
                    : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {correctCount === filtered.length
              ? "全問正解！素晴らしいです！"
              : correctCount >= filtered.length * 0.8
                ? `正解率 ${Math.round((correctCount / filtered.length) * 100)}%！よくできました！`
                : correctCount >= filtered.length * 0.6
                  ? `正解率 ${Math.round((correctCount / filtered.length) * 100)}%。もう少し復習しましょう。`
                  : `正解率 ${Math.round((correctCount / filtered.length) * 100)}%。各セクションを復習してから再挑戦しましょう。`}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div>
          <p className="text-[13px] text-muted-foreground mb-2">カテゴリ</p>
          <div className="flex gap-2 flex-wrap">
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-[13px] border transition-colors ${
                  filterCategory === cat
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-card border-border text-muted-foreground hover:border-purple-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[13px] text-muted-foreground mb-2">難易度</p>
          <div className="flex gap-2 flex-wrap">
            {allDifficulties.map((diff) => (
              <button
                key={diff}
                onClick={() => setFilterDifficulty(diff)}
                className={`px-3 py-1.5 rounded-lg text-[13px] border transition-colors ${
                  filterDifficulty === diff
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-card border-border text-muted-foreground hover:border-purple-300"
                }`}
              >
                {diff}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {filtered.map((ex) => {
          const isExpanded = expandedId === ex.id;
          const isRevealed = revealed.has(ex.id);
          const selectedIndex = answers[ex.id];
          const isCorrect = selectedIndex === ex.correctIndex;
          const diffConf = difficultyConfig[ex.difficulty];

          return (
            <div
              key={ex.id}
              className={`bg-card border rounded-xl overflow-hidden transition-shadow ${
                isRevealed
                  ? isCorrect
                    ? "border-green-300"
                    : "border-red-300"
                  : "border-border"
              }`}
            >
              {/* Question header */}
              <button
                className="w-full flex items-start gap-4 p-5 text-left"
                onClick={() => setExpandedId(isExpanded ? null : ex.id)}
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-purple-600 text-white text-[14px] shrink-0">
                  {ex.id}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full ${diffConf.bg} ${diffConf.text}`}
                    >
                      {ex.difficulty}
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full ${categoryConfig[ex.category]}`}
                    >
                      {ex.category}
                    </span>
                    {isRevealed && (
                      <span className="flex items-center gap-1 text-[11px]">
                        {isCorrect ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-green-600">正解</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-red-500" />
                            <span className="text-red-600">不正解</span>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <p className="text-[14px] leading-relaxed">{ex.question}</p>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
                )}
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-5 pb-5 space-y-4">
                  {/* Code snippet */}
                  {ex.codeSnippet && (
                    <pre className="bg-[#1e1e2e] text-[#cdd6f4] text-[13px] p-4 rounded-lg overflow-x-auto">
                      <code>{ex.codeSnippet}</code>
                    </pre>
                  )}

                  {/* Options */}
                  <div className="space-y-2">
                    {ex.options.map((option, i) => {
                      const isSelected = selectedIndex === i;
                      const isCorrectOption = i === ex.correctIndex;

                      let optionStyle =
                        "bg-accent/30 border-transparent hover:border-purple-300 cursor-pointer";

                      if (isRevealed) {
                        if (isCorrectOption) {
                          optionStyle =
                            "bg-green-50 border-green-300 text-green-800";
                        } else if (isSelected && !isCorrectOption) {
                          optionStyle = "bg-red-50 border-red-300 text-red-800";
                        } else {
                          optionStyle =
                            "bg-accent/20 border-transparent text-muted-foreground";
                        }
                      } else if (isSelected) {
                        optionStyle =
                          "bg-purple-50 border-purple-400 text-purple-800";
                      }

                      return (
                        <button
                          key={i}
                          onClick={() => handleSelect(ex.id, i)}
                          disabled={isRevealed}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border text-[14px] text-left transition-colors ${optionStyle}`}
                        >
                          <span
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] shrink-0 ${
                              isRevealed && isCorrectOption
                                ? "bg-green-500 text-white"
                                : isRevealed && isSelected && !isCorrectOption
                                  ? "bg-red-500 text-white"
                                  : isSelected
                                    ? "bg-purple-600 text-white"
                                    : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="flex-1">{option}</span>
                          {isRevealed && isCorrectOption && (
                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                          )}
                          {isRevealed && isSelected && !isCorrectOption && (
                            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Answer button */}
                  {!isRevealed && (
                    <button
                      onClick={() => handleReveal(ex.id)}
                      disabled={selectedIndex === undefined}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[14px] transition-colors ${
                        selectedIndex !== undefined
                          ? "bg-purple-600 text-white hover:bg-purple-700"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      }`}
                    >
                      <HelpCircle className="w-4 h-4" />
                      回答を確認
                    </button>
                  )}

                  {/* Explanation */}
                  {isRevealed && (
                    <div
                      className={`p-4 rounded-lg border ${
                        isCorrect
                          ? "bg-green-50 border-green-200"
                          : "bg-blue-50 border-blue-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen
                          className={`w-4 h-4 ${isCorrect ? "text-green-600" : "text-blue-600"}`}
                        />
                        <p
                          className={`text-[13px] ${isCorrect ? "text-green-700" : "text-blue-700"}`}
                        >
                          解説
                        </p>
                      </div>
                      <p
                        className={`text-[13px] leading-relaxed ${isCorrect ? "text-green-800" : "text-blue-800"}`}
                      >
                        {ex.explanation}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <p className="text-muted-foreground text-[14px]">
            選択した条件に一致する問題がありません。フィルタを変更してください。
          </p>
        </div>
      )}
    </div>
  );
}
