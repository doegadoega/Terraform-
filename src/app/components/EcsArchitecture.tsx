import { useState } from "react";
import {
  Server,
  Box,
  Layers,
  Container,
  Network,
  ArrowRight,
  ArrowDown,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Globe,
  Settings,
  Cpu,
  HardDrive,
  Link2,
  RefreshCw,
  Scale,
  Eye,
  Lock,
} from "lucide-react";
import { DownloadCodeButton } from "./DownloadCodeButton";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab =
  | "hierarchy"
  | "multi-container"
  | "networking"
  | "scaling"
  | "terraform";

// ─── Hierarchy Section ───────────────────────────────────────────────────────

function HierarchySection() {
  const [expandedLayer, setExpandedLayer] = useState<string | null>("cluster");

  const layers = [
    {
      id: "cluster",
      icon: Server,
      color: "bg-purple-600",
      textColor: "text-purple-600",
      bgLight: "bg-purple-50",
      borderColor: "border-purple-200",
      title: "Cluster（クラスター）",
      subtitle: "ECS の最上位の管理単位",
      analogy: "会社のオフィスビル",
      description:
        "ECS クラスターは、タスクとサービスをまとめて管理するための論理的なグループです。1つの AWS アカウント内に複数のクラスターを作成でき、環境ごと（dev / staging / prod）やプロジェクトごとに分けるのが一般的です。",
      details: [
        "論理的なグループ（物理的なサーバーとは独立）",
        "Fargate 利用時はインフラ管理不要",
        "EC2 起動タイプの場合は EC2 インスタンスを登録",
        "CloudWatch Container Insights で監視可能",
        "1アカウントにつき最大 10,000 クラスター",
      ],
      contains: "Service × 複数",
      code: `resource "aws_ecs_cluster" "main" {
  name = "my-app-cluster"

  # Container Insights（監視）を有効化
  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Environment = "production"
  }
}`,
    },
    {
      id: "service",
      icon: RefreshCw,
      color: "bg-blue-600",
      textColor: "text-blue-600",
      bgLight: "bg-blue-50",
      borderColor: "border-blue-200",
      title: "Service（サービス）",
      subtitle: "タスクの常時稼働を保証する仕組み",
      analogy: "部門（営業部、開発部など）",
      description:
        "サービスは、指定した数のタスクを常時稼働させ続ける仕組みです。タスクが異常終了したら自動的に再起動し、ALB との連携やオートスケーリングもサービスが管理します。Web アプリケーションや API サーバーなど、常時動かしたいものはサービスとしてデプロイします。",
      details: [
        "指定した desired_count のタスクを維持（自動復旧）",
        "ALB / NLB との紐付けで負荷分散",
        "Auto Scaling でタスク数を自動増減",
        "ローリングアップデートで無停止デプロイ",
        "1クラスターに複数サービスを配置可能",
        "サービス間は独立しており、個別にスケール可能",
      ],
      contains: "Task × desired_count 個",
      code: `resource "aws_ecs_service" "web" {
  name            = "web-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn

  # 常時 2 タスク稼働（異常時は自動復旧）
  desired_count = 2

  # Fargate 起動タイプ
  launch_type = "FARGATE"

  # ネットワーク設定
  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  # ALB との連携
  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "nginx"     # タスク内のコンテナ名
    container_port   = 80          # コンテナのポート
  }

  # デプロイ設定（ローリングアップデート）
  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200
}`,
    },
    {
      id: "task-definition",
      icon: Layers,
      color: "bg-green-600",
      textColor: "text-green-600",
      bgLight: "bg-green-50",
      borderColor: "border-green-200",
      title: "Task Definition（タスク定義）",
      subtitle: "コンテナの設計図（テンプレート）",
      analogy: "業務マニュアル・設計書",
      description:
        "タスク定義は、タスクの「設計図」です。どのコンテナイメージを使い、CPU / メモリをどれだけ割り当て、環境変数は何か、などを定義します。タスク定義自体はテンプレートであり、実行されるものではありません。サービスまたは手動実行時にこの定義に基づいてタスクが起動されます。",
      details: [
        "Docker Compose の docker-compose.yml に相当",
        "1つの定義に複数コンテナを含められる",
        "CPU / メモリはタスクレベルとコンテナレベルで設定",
        "リビジョン管理（変更するたびに新リビジョン作成）",
        "環境変数、シークレット、ボリュームを定義",
        "IAM ロール（タスクロール / 実行ロール）を指定",
      ],
      contains: "Container Definition × 1〜10 個",
      code: `resource "aws_ecs_task_definition" "web" {
  family                   = "web-task"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"

  # タスク全体の CPU / メモリ上限
  cpu    = "512"    # 0.5 vCPU
  memory = "1024"   # 1 GB

  execution_role_arn = aws_iam_role.ecs_execution.arn
  task_role_arn      = aws_iam_role.ecs_task.arn

  # コンテナ定義（JSON）
  container_definitions = jsonencode([
    {
      name  = "nginx"
      image = "nginx:latest"
      # ... 詳細は次のレイヤーで解説
    }
  ])
}`,
    },
    {
      id: "task",
      icon: Box,
      color: "bg-orange-600",
      textColor: "text-orange-600",
      bgLight: "bg-orange-50",
      borderColor: "border-orange-200",
      title: "Task（タスク）",
      subtitle: "タスク定義から起動された実行インスタンス",
      analogy: "実際に働いている従業員",
      description:
        "タスクは、タスク定義に基づいて実際に起動された実行単位です。1つのタスクに含まれるすべてのコンテナは、同じホスト上で動作し、ネットワーク（localhost）やストレージ（ボリューム）を共有できます。Kubernetes の Pod に相当する概念です。",
      details: [
        "タスク定義の「インスタンス化」されたもの",
        "タスク内の全コンテナは同一ホストで実行",
        "同一タスク内のコンテナは localhost で通信可能",
        "タスクごとに固有の ENI（IP アドレス）を持つ（awsvpc モード）",
        "タスクが停止 → サービスが自動的に新タスクを起動",
        "スタンドアロン（サービスなし）で単発実行も可能",
      ],
      contains: "Container × タスク定義で指定した数",
      code: `# タスクはサービスが自動管理するが、
# 手動で単発タスクを実行することもできる

# 例: データベースマイグレーションを単発実行
# aws ecs run-task \\
#   --cluster my-app-cluster \\
#   --task-definition db-migration:3 \\
#   --launch-type FARGATE \\
#   --network-configuration '{
#     "awsvpcConfiguration": {
#       "subnets": ["subnet-xxx"],
#       "securityGroups": ["sg-xxx"]
#     }
#   }'`,
    },
    {
      id: "container",
      icon: Container,
      color: "bg-red-600",
      textColor: "text-red-600",
      bgLight: "bg-red-50",
      borderColor: "border-red-200",
      title: "Container（コンテナ）",
      subtitle: "実際にアプリが動く Docker コンテナ",
      analogy: "デスクに座って作業する個人",
      description:
        "コンテナは、Docker イメージから起動された実行環境です。タスク定義の container_definitions で定義し、1タスクに最大10個まで含められます。同一タスク内のコンテナは localhost を通じて相互に通信でき、共有ボリュームでファイルも共有できます。",
      details: [
        "Docker イメージから起動される実行環境",
        "1タスクに最大 10 コンテナ",
        "コンテナごとに CPU / メモリの割当を指定可能",
        "Essential コンテナが停止 → タスク全体が停止",
        "Non-essential コンテナの停止はタスクに影響しない",
        "各コンテナに独立したログ設定が可能",
      ],
      contains: "アプリケーション（Docker イメージ）",
      code: `# container_definitions の詳細例
container_definitions = jsonencode([
  {
    name      = "app"
    image     = "123456789.dkr.ecr.ap-northeast-1.amazonaws.com/my-app:latest"
    essential = true    # このコンテナが停止 → タスク停止
    cpu       = 256
    memory    = 512

    portMappings = [
      {
        containerPort = 8080
        protocol      = "tcp"
      }
    ]

    environment = [
      { name = "NODE_ENV", value = "production" }
    ]

    secrets = [
      {
        name      = "DB_PASSWORD"
        valueFrom = "arn:aws:ssm:ap-northeast-1:123456789:parameter/db-password"
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/my-app"
        "awslogs-region"        = "ap-northeast-1"
        "awslogs-stream-prefix" = "app"
      }
    }
  }
])`,
    },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Visual hierarchy diagram */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-purple-600" />
          ECS の階層構造
        </h3>
        <div className="flex flex-col items-center gap-1">
          {layers.map((layer, i) => (
            <div key={layer.id} className="w-full max-w-lg">
              <button
                onClick={() =>
                  setExpandedLayer(
                    expandedLayer === layer.id ? null : layer.id
                  )
                }
                className={`w-full rounded-lg border-2 p-3 transition-all ${
                  expandedLayer === layer.id
                    ? `${layer.borderColor} ${layer.bgLight} shadow-md`
                    : "border-border hover:border-purple-200"
                }`}
                style={{
                  marginLeft: `${i * 20}px`,
                  marginRight: `${i * 20}px`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg ${layer.color} flex items-center justify-center`}
                  >
                    <layer.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[13px] font-semibold">{layer.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {layer.subtitle}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {layer.contains}
                  </span>
                  {expandedLayer === layer.id ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {expandedLayer === layer.id && (
                <div
                  className={`mt-2 p-5 rounded-lg border ${layer.borderColor} ${layer.bgLight} space-y-4`}
                  style={{
                    marginLeft: `${i * 20}px`,
                    marginRight: `${i * 20}px`,
                  }}
                >
                  {/* Analogy */}
                  <div className="flex items-center gap-2 text-[12px]">
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                    <span className="text-muted-foreground">
                      たとえるなら：
                    </span>
                    <span className="font-semibold">{layer.analogy}</span>
                  </div>

                  {/* Description */}
                  <p className="text-[13px] leading-relaxed">
                    {layer.description}
                  </p>

                  {/* Details */}
                  <ul className="space-y-1.5">
                    {layer.details.map((detail, j) => (
                      <li
                        key={j}
                        className="text-[12px] flex items-start gap-2"
                      >
                        <CheckCircle2
                          className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${layer.textColor}`}
                        />
                        {detail}
                      </li>
                    ))}
                  </ul>

                  {/* Code */}
                  <div>
                    <p className="text-[12px] font-semibold mb-2">
                      Terraform コード例
                    </p>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-[11px] leading-relaxed">
                      <code>{layer.code}</code>
                    </pre>
                    <div className="mt-2">
                      <DownloadCodeButton
                        code={layer.code}
                        filename={`ecs_${layer.id.replace("-", "_")}.tf`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {i < layers.length - 1 && (
                <div className="flex justify-center py-1">
                  <ArrowDown className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Summary card */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-[15px] font-semibold mb-3">まとめ：誰が何を管理？</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {
              label: "Cluster",
              manages: "Service をグルーピング",
              color: "bg-purple-100 text-purple-700",
            },
            {
              label: "Service",
              manages: "Task の数を維持 + ALB 連携",
              color: "bg-blue-100 text-blue-700",
            },
            {
              label: "Task Definition",
              manages: "コンテナの設計図（テンプレート）",
              color: "bg-green-100 text-green-700",
            },
            {
              label: "Task",
              manages: "コンテナの実行インスタンス",
              color: "bg-orange-100 text-orange-700",
            },
            {
              label: "Container",
              manages: "アプリの実行環境",
              color: "bg-red-100 text-red-700",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
            >
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${item.color}`}
              >
                {item.label}
              </span>
              <span className="text-[12px]">{item.manages}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Multi-Container Section ─────────────────────────────────────────────────

function MultiContainerSection() {
  const patterns = [
    {
      id: "sidecar",
      title: "サイドカーパターン",
      subtitle: "メインアプリに補助コンテナを追加",
      icon: Link2,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      description:
        "メインアプリケーションに、ログ転送・監視エージェント・プロキシなどの補助コンテナを並行して動かすパターンです。メインコンテナのコードを変更せずに、機能を追加できます。",
      examples: [
        "Nginx（リバースプロキシ） + アプリコンテナ",
        "アプリ + Datadog Agent（監視）",
        "アプリ + Fluentd / Fluent Bit（ログ転送）",
        "アプリ + AWS X-Ray デーモン（トレーシング）",
      ],
      communication: "localhost:ポート番号 で相互通信",
      code: `# サイドカーパターン: Nginx + Node.js アプリ
container_definitions = jsonencode([
  # --- メインコンテナ: Nginx（リバースプロキシ）---
  {
    name      = "nginx"
    image     = "nginx:alpine"
    essential = true    # これが停止 → タスク停止
    cpu       = 128
    memory    = 256

    portMappings = [
      {
        containerPort = 80
        protocol      = "tcp"
      }
    ]

    # Nginx がアプリに proxy_pass するための設定ボリューム
    mountPoints = [
      {
        sourceVolume  = "nginx-config"
        containerPath = "/etc/nginx/conf.d"
        readOnly      = true
      }
    ]

    # アプリが起動してから Nginx を起動
    dependsOn = [
      {
        containerName = "app"
        condition     = "START"
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/my-app/nginx"
        "awslogs-region"        = "ap-northeast-1"
        "awslogs-stream-prefix" = "nginx"
      }
    }
  },

  # --- サイドカー: Node.js アプリ ---
  {
    name      = "app"
    image     = "123456789.dkr.ecr.ap-northeast-1.amazonaws.com/my-app:latest"
    essential = true
    cpu       = 384
    memory    = 768

    # ポートを公開しなくても localhost で通信可能
    portMappings = [
      {
        containerPort = 3000
        protocol      = "tcp"
      }
    ]

    environment = [
      { name = "PORT", value = "3000" }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/my-app/app"
        "awslogs-region"        = "ap-northeast-1"
        "awslogs-stream-prefix" = "app"
      }
    }
  }
])`,
    },
    {
      id: "init",
      title: "初期化コンテナパターン",
      subtitle: "メインアプリ起動前の前処理",
      icon: Settings,
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      description:
        "メインアプリが起動する前に、データベースマイグレーションや設定ファイルのダウンロードなどの前処理を実行するコンテナです。処理完了後に自動終了し、その後メインアプリが起動します。",
      examples: [
        "DB マイグレーション → アプリ起動",
        "設定ファイルダウンロード → アプリ起動",
        "証明書取得 → アプリ起動",
        "S3 からアセット取得 → Web サーバー起動",
      ],
      communication:
        "共有ボリュームでファイルを受け渡し + dependsOn で起動順序を制御",
      code: `# 初期化パターン: DB マイグレーション → アプリ起動
container_definitions = jsonencode([
  # --- 初期化コンテナ: マイグレーション ---
  {
    name      = "migration"
    image     = "123456789.dkr.ecr.ap-northeast-1.amazonaws.com/my-app:latest"
    essential = false   # 完了後に停止してもタスクは継続

    command = ["npx", "prisma", "migrate", "deploy"]

    environment = [
      { name = "DATABASE_URL", value = "postgresql://..." }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/my-app/migration"
        "awslogs-region"        = "ap-northeast-1"
        "awslogs-stream-prefix" = "migration"
      }
    }
  },

  # --- メインコンテナ: アプリ ---
  {
    name      = "app"
    image     = "123456789.dkr.ecr.ap-northeast-1.amazonaws.com/my-app:latest"
    essential = true

    # マイグレーション完了後に起動
    dependsOn = [
      {
        containerName = "migration"
        condition     = "SUCCESS"  # 成功時のみ起動
      }
    ]

    portMappings = [
      { containerPort = 3000, protocol = "tcp" }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/my-app/app"
        "awslogs-region"        = "ap-northeast-1"
        "awslogs-stream-prefix" = "app"
      }
    }
  }
])`,
    },
    {
      id: "monitoring",
      title: "監視エージェントパターン",
      subtitle: "メトリクス収集・トレーシング",
      icon: Eye,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200",
      description:
        "メインアプリと並行して監視エージェントを動かすパターンです。アプリのメトリクスやトレース情報を収集し、外部の監視サービスに転送します。",
      examples: [
        "アプリ + AWS X-Ray デーモン",
        "アプリ + Datadog Agent",
        "アプリ + CloudWatch Agent",
        "アプリ + OpenTelemetry Collector",
      ],
      communication:
        "アプリが localhost:2000（X-Ray）や localhost:8126（Datadog）にトレースデータを送信",
      code: `# 監視パターン: アプリ + X-Ray デーモン
container_definitions = jsonencode([
  # --- メインコンテナ ---
  {
    name      = "app"
    image     = "my-app:latest"
    essential = true
    cpu       = 384
    memory    = 768

    portMappings = [
      { containerPort = 8080, protocol = "tcp" }
    ]

    environment = [
      # X-Ray デーモンのアドレスを指定
      { name = "AWS_XRAY_DAEMON_ADDRESS", value = "localhost:2000" }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/my-app/app"
        "awslogs-region"        = "ap-northeast-1"
        "awslogs-stream-prefix" = "app"
      }
    }
  },

  # --- サイドカー: X-Ray デーモン ---
  {
    name      = "xray-daemon"
    image     = "amazon/aws-xray-daemon:latest"
    essential = false   # 監視が落ちてもアプリは継続

    cpu    = 32
    memory = 256

    portMappings = [
      {
        containerPort = 2000
        protocol      = "udp"
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/my-app/xray"
        "awslogs-region"        = "ap-northeast-1"
        "awslogs-stream-prefix" = "xray"
      }
    }
  }
])`,
    },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Answer the key question */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
        <h3 className="text-[16px] font-bold text-purple-800 mb-3">
          コンテナは複数登録できるの？
        </h3>
        <p className="text-[14px] text-purple-700 leading-relaxed mb-4">
          <strong>はい、1つのタスク定義に最大 10 個のコンテナを登録できます。</strong>
          同一タスク内のコンテナ同士は <code className="bg-purple-200 px-1.5 py-0.5 rounded text-[13px]">localhost</code> で通信できます。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border border-purple-100">
            <h4 className="text-[13px] font-semibold text-purple-800 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              同一タスク内のコンテナ
            </h4>
            <ul className="space-y-1.5 text-[12px] text-purple-700">
              <li>→ <strong>localhost で通信可能</strong>（ポートで区別）</li>
              <li>→ 共有ボリュームでファイル共有可能</li>
              <li>→ 同じ ENI（IP アドレス）を共有</li>
              <li>→ ライフサイクルが連動（essential コンテナ）</li>
            </ul>
          </div>
          <div className="bg-white rounded-lg p-4 border border-purple-100">
            <h4 className="text-[13px] font-semibold text-purple-800 mb-2 flex items-center gap-1.5">
              <Network className="w-4 h-4 text-blue-500" />
              異なるタスク間のコンテナ
            </h4>
            <ul className="space-y-1.5 text-[12px] text-purple-700">
              <li>→ <strong>タスクの IP アドレスで通信</strong></li>
              <li>→ Cloud Map（Service Discovery）で名前解決</li>
              <li>→ ALB / NLB 経由で負荷分散</li>
              <li>→ セキュリティグループで通信制御</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Communication diagram */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
          <Network className="w-5 h-5 text-purple-600" />
          コンテナ間の通信の仕組み
        </h3>

        {/* Diagram */}
        <div className="bg-muted/30 rounded-lg p-6 mb-4">
          <div className="text-center text-[12px] text-muted-foreground mb-3">
            ▼ 同一タスク内（localhost 通信）
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <div className="border-2 border-dashed border-orange-300 rounded-xl p-4 bg-orange-50/50">
              <p className="text-[10px] text-orange-600 font-semibold mb-2 text-center">
                Task（ENI: 10.0.10.15）
              </p>
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 text-center">
                  <Container className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-[11px] font-semibold">Nginx</p>
                  <p className="text-[10px] text-muted-foreground">:80</p>
                </div>
                <div className="text-center">
                  <ArrowRight className="w-4 h-4 text-green-500" />
                  <p className="text-[9px] text-green-600 font-mono">
                    localhost:3000
                  </p>
                </div>
                <div className="bg-green-100 border border-green-300 rounded-lg p-3 text-center">
                  <Container className="w-5 h-5 text-green-600 mx-auto mb-1" />
                  <p className="text-[11px] font-semibold">App</p>
                  <p className="text-[10px] text-muted-foreground">:3000</p>
                </div>
                <div className="text-center">
                  <ArrowRight className="w-4 h-4 text-orange-500" />
                  <p className="text-[9px] text-orange-600 font-mono">
                    localhost:2000
                  </p>
                </div>
                <div className="bg-orange-100 border border-orange-300 rounded-lg p-3 text-center">
                  <Container className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                  <p className="text-[11px] font-semibold">X-Ray</p>
                  <p className="text-[10px] text-muted-foreground">:2000</p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center text-[12px] text-muted-foreground my-4">
            ▼ 異なるタスク間（IP / Service Discovery / ALB 通信）
          </div>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            <div className="border-2 border-dashed border-blue-300 rounded-xl p-3 bg-blue-50/50 text-center">
              <p className="text-[10px] text-blue-600 font-semibold">
                Task A（10.0.10.15）
              </p>
              <p className="text-[10px]">Web API</p>
            </div>
            <div className="text-center">
              <ArrowRight className="w-4 h-4 text-purple-500" />
              <p className="text-[9px] text-purple-600">
                api.local:8080
              </p>
              <p className="text-[8px] text-muted-foreground">
                (Cloud Map)
              </p>
            </div>
            <div className="border-2 border-dashed border-green-300 rounded-xl p-3 bg-green-50/50 text-center">
              <p className="text-[10px] text-green-600 font-semibold">
                Task B（10.0.10.22）
              </p>
              <p className="text-[10px]">Worker</p>
            </div>
          </div>
        </div>

        {/* Key points */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <h4 className="text-[12px] font-semibold text-green-800 mb-1">
              同一タスク内
            </h4>
            <p className="text-[11px] text-green-700">
              <code className="bg-green-100 px-1 rounded">localhost:ポート</code> で直接通信。
              セキュリティグループ不要。
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h4 className="text-[12px] font-semibold text-blue-800 mb-1">
              同一サービス内の別タスク
            </h4>
            <p className="text-[11px] text-blue-700">
              各タスクの ENI IP で通信。
              Cloud Map で名前解決推奨。
            </p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <h4 className="text-[12px] font-semibold text-purple-800 mb-1">
              別サービス間
            </h4>
            <p className="text-[11px] text-purple-700">
              ALB / NLB 経由、または Cloud Map（Service Connect）で通信。
            </p>
          </div>
        </div>
      </div>

      {/* Multi-container patterns */}
      <div className="space-y-4">
        <h3 className="text-[15px] font-semibold flex items-center gap-2">
          <Layers className="w-5 h-5 text-purple-600" />
          マルチコンテナの設計パターン
        </h3>

        {patterns.map((pattern) => (
          <MultiContainerPatternCard key={pattern.id} pattern={pattern} />
        ))}
      </div>
    </div>
  );
}

function MultiContainerPatternCard({
  pattern,
}: {
  readonly pattern: {
    readonly id: string;
    readonly title: string;
    readonly subtitle: string;
    readonly icon: React.ElementType;
    readonly color: string;
    readonly bgColor: string;
    readonly borderColor: string;
    readonly description: string;
    readonly examples: readonly string[];
    readonly communication: string;
    readonly code: string;
  };
}) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = pattern.icon;

  return (
    <div className={`bg-card rounded-xl border border-border overflow-hidden`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-start gap-4 p-5 text-left hover:bg-accent/50 transition-colors"
      >
        <div
          className={`w-10 h-10 rounded-lg ${pattern.bgColor} border ${pattern.borderColor} flex items-center justify-center shrink-0`}
        >
          <Icon className={`w-5 h-5 ${pattern.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[14px] font-semibold">{pattern.title}</h4>
          <p className="text-[12px] text-muted-foreground">
            {pattern.subtitle}
          </p>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
          <p className="text-[13px] leading-relaxed">{pattern.description}</p>

          <div className="flex items-start gap-2 text-[12px] bg-blue-50 border border-blue-200 rounded-lg p-3">
            <Network className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-blue-800">通信方法: </span>
              <span className="text-blue-700">{pattern.communication}</span>
            </div>
          </div>

          <div>
            <p className="text-[12px] font-semibold mb-2">使用例</p>
            <ul className="space-y-1">
              {pattern.examples.map((ex, i) => (
                <li
                  key={i}
                  className="text-[12px] flex items-center gap-2 text-muted-foreground"
                >
                  <ArrowRight className="w-3 h-3 text-purple-500" />
                  {ex}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[12px] font-semibold mb-2">Terraform コード</p>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-[11px] leading-relaxed">
              <code>{pattern.code}</code>
            </pre>
            <div className="mt-2">
              <DownloadCodeButton
                code={pattern.code}
                filename={`ecs_${pattern.id}_pattern.tf`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Networking Section ──────────────────────────────────────────────────────

function NetworkingSection() {
  const serviceDiscoveryCode = `# =============================================
# Service Discovery（Cloud Map）
# =============================================
# サービス間の通信を DNS 名で解決

resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "local"
  description = "ECS サービスディスカバリ用"
  vpc         = aws_vpc.main.id
}

# API サービスの登録
resource "aws_service_discovery_service" "api" {
  name = "api"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }
}

# ECS サービスに Service Discovery を紐付け
resource "aws_ecs_service" "api" {
  name            = "api-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  # Service Discovery 登録
  service_registries {
    registry_arn = aws_service_discovery_service.api.arn
  }
}

# 他のサービスから api.local:8080 で通信可能`;

  const serviceConnectCode = `# =============================================
# ECS Service Connect（推奨）
# =============================================
# Cloud Map + Envoy プロキシを自動管理

resource "aws_service_discovery_http_namespace" "main" {
  name = "my-app"
}

resource "aws_ecs_service" "api" {
  name            = "api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  # Service Connect 設定
  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn

    service {
      port_name = "api"

      client_alias {
        port     = 8080
        dns_name = "api"
      }
    }
  }
}

# 他のサービスから http://api:8080 で通信可能
# Envoy が自動でロードバランシング + リトライ`;

  return (
    <div className="space-y-6">
      {/* Network modes */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-purple-600" />
          ECS のネットワークモード
        </h3>
        <div className="space-y-3">
          {[
            {
              mode: "awsvpc（推奨）",
              description:
                "タスクごとに ENI を割当。Fargate では必須。セキュリティグループをタスク単位で適用可能。",
              color: "bg-green-50 border-green-200",
              recommended: true,
            },
            {
              mode: "bridge",
              description:
                "Docker のデフォルトブリッジネットワーク。EC2 起動タイプでのみ使用可能。ポートマッピングが必要。",
              color: "bg-gray-50 border-gray-200",
              recommended: false,
            },
            {
              mode: "host",
              description:
                "ホストのネットワークを直接使用。EC2 起動タイプでのみ。ポート競合に注意。",
              color: "bg-gray-50 border-gray-200",
              recommended: false,
            },
            {
              mode: "none",
              description:
                "外部ネットワークなし。バッチ処理などネットワーク不要な場合。",
              color: "bg-gray-50 border-gray-200",
              recommended: false,
            },
          ].map((nm) => (
            <div
              key={nm.mode}
              className={`p-4 rounded-lg border ${nm.color}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-[13px] font-semibold">{nm.mode}</h4>
                {nm.recommended && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-200 text-green-800">
                    推奨
                  </span>
                )}
              </div>
              <p className="text-[12px] text-muted-foreground">
                {nm.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Service Discovery */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
          <Link2 className="w-5 h-5 text-purple-600" />
          サービス間通信の方法
        </h3>

        <div className="space-y-4">
          <div>
            <h4 className="text-[13px] font-semibold mb-2 flex items-center gap-2">
              方法 1: Cloud Map（Service Discovery）
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                シンプル
              </span>
            </h4>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-[11px] leading-relaxed">
              <code>{serviceDiscoveryCode}</code>
            </pre>
            <div className="mt-2">
              <DownloadCodeButton
                code={serviceDiscoveryCode}
                filename="ecs_service_discovery.tf"
              />
            </div>
          </div>

          <div>
            <h4 className="text-[13px] font-semibold mb-2 flex items-center gap-2">
              方法 2: ECS Service Connect
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                推奨
              </span>
            </h4>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-[11px] leading-relaxed">
              <code>{serviceConnectCode}</code>
            </pre>
            <div className="mt-2">
              <DownloadCodeButton
                code={serviceConnectCode}
                filename="ecs_service_connect.tf"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Security considerations */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
        <h4 className="text-[13px] font-semibold text-yellow-800 mb-3 flex items-center gap-1.5">
          <Shield className="w-4 h-4" />
          コンテナ間通信のセキュリティ
        </h4>
        <ul className="space-y-2">
          {[
            "同一タスク内のコンテナ間通信はセキュリティグループの制約を受けない（localhost 通信のため）",
            "異なるタスク間の通信はセキュリティグループで制御される",
            "タスクロール（task_role_arn）はタスク内の全コンテナで共有される",
            "コンテナごとにアクセスを分けたい場合は別タスクに分離する",
            "機密データは Secrets Manager / Parameter Store から注入（環境変数にハードコードしない）",
          ].map((item, i) => (
            <li
              key={i}
              className="text-[12px] text-yellow-700 flex items-start gap-2"
            >
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Scaling Section ─────────────────────────────────────────────────────────

function ScalingSection() {
  const scalingCode = `# =============================================
# ECS Auto Scaling
# =============================================

# スケーリングターゲットの登録
resource "aws_appautoscaling_target" "ecs" {
  max_capacity       = 10
  min_capacity       = 2
  resource_id        = "service/\${aws_ecs_cluster.main.name}/\${aws_ecs_service.web.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# --- CPU 使用率ベースのスケーリング ---
resource "aws_appautoscaling_policy" "cpu" {
  name               = "cpu-auto-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0   # CPU 70% を維持
    scale_in_cooldown  = 300    # 5分間のクールダウン
    scale_out_cooldown = 60     # 1分で素早くスケールアウト
  }
}

# --- メモリ使用率ベースのスケーリング ---
resource "aws_appautoscaling_policy" "memory" {
  name               = "memory-auto-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value = 80.0   # メモリ 80% を維持
  }
}

# --- リクエスト数ベースのスケーリング ---
resource "aws_appautoscaling_policy" "requests" {
  name               = "request-auto-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "\${aws_lb.main.arn_suffix}/\${aws_lb_target_group.web.arn_suffix}"
    }
    target_value = 1000   # タスクあたり 1000 リクエスト/分
  }
}`;

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
          <Scale className="w-5 h-5 text-purple-600" />
          ECS のスケーリング戦略
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            {
              title: "CPU ベース",
              desc: "CPU 使用率が閾値を超えたらスケールアウト",
              metric: "ECSServiceAverageCPUUtilization",
              target: "70%",
              useCase: "計算負荷の高い API",
              color: "bg-blue-50 border-blue-200",
            },
            {
              title: "メモリベース",
              desc: "メモリ使用率が閾値を超えたらスケールアウト",
              metric: "ECSServiceAverageMemoryUtilization",
              target: "80%",
              useCase: "キャッシュ・データ処理",
              color: "bg-green-50 border-green-200",
            },
            {
              title: "リクエスト数ベース",
              desc: "タスクあたりのリクエスト数で制御",
              metric: "ALBRequestCountPerTarget",
              target: "1000 req/min",
              useCase: "Web API・フロントエンド",
              color: "bg-purple-50 border-purple-200",
            },
          ].map((s) => (
            <div
              key={s.title}
              className={`rounded-lg border p-4 ${s.color}`}
            >
              <h4 className="text-[13px] font-semibold mb-1">{s.title}</h4>
              <p className="text-[11px] text-muted-foreground mb-2">
                {s.desc}
              </p>
              <div className="space-y-1 text-[11px]">
                <p>
                  <span className="font-semibold">メトリクス:</span>{" "}
                  <code className="bg-white/60 px-1 rounded text-[10px]">
                    {s.metric}
                  </code>
                </p>
                <p>
                  <span className="font-semibold">推奨閾値:</span> {s.target}
                </p>
                <p>
                  <span className="font-semibold">適用:</span> {s.useCase}
                </p>
              </div>
            </div>
          ))}
        </div>

        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-[11px] leading-relaxed">
          <code>{scalingCode}</code>
        </pre>
        <div className="mt-2">
          <DownloadCodeButton
            code={scalingCode}
            filename="ecs_auto_scaling.tf"
          />
        </div>
      </div>

      {/* Scaling tips */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-5">
        <h4 className="text-[13px] font-semibold text-green-800 mb-3 flex items-center gap-1.5">
          <Lightbulb className="w-4 h-4" />
          スケーリングのベストプラクティス
        </h4>
        <ul className="space-y-1.5">
          {[
            "スケールアウトのクールダウンは短く（60秒）、スケールインは長く（300秒）",
            "min_capacity は最低 2（マルチ AZ で冗長化）",
            "CPU + リクエスト数の複数メトリクスでスケーリングすると安定する",
            "スケジュールドスケーリングで予測可能なピークに対応",
            "タスクの起動に時間がかかる場合は、ヘルスチェックの猶予期間を設定",
          ].map((tip, i) => (
            <li
              key={i}
              className="text-[12px] text-green-700 flex items-start gap-2"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-500" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Terraform Full Example ──────────────────────────────────────────────────

function TerraformSection() {
  const fullCode = `# =============================================
# ECS フルスタック Terraform 構成
# =============================================

# --- 変数定義 ---
variable "project_name" {
  type    = string
  default = "my-app"
}

variable "app_image" {
  description = "アプリの ECR イメージ URI"
  type        = string
}

variable "app_port" {
  description = "アプリのリスンポート"
  type        = number
  default     = 8080
}

# --- ECS クラスター ---
resource "aws_ecs_cluster" "main" {
  name = "\${var.project_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# --- CloudWatch ロググループ ---
resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/\${var.project_name}"
  retention_in_days = 30
}

# --- タスク定義 ---
resource "aws_ecs_task_definition" "app" {
  family                   = "\${var.project_name}-task"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "app"
      image     = var.app_image
      essential = true
      cpu       = 256
      memory    = 512

      portMappings = [
        {
          containerPort = var.app_port
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "PORT", value = tostring(var.app_port) },
        { name = "NODE_ENV", value = "production" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = "ap-northeast-1"
          "awslogs-stream-prefix" = "app"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:\${var.app_port}/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])
}

# --- ECS サービス ---
resource "aws_ecs_service" "app" {
  name            = "\${var.project_name}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = var.app_port
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = 60

  lifecycle {
    ignore_changes = [desired_count]  # Auto Scaling に任せる
  }
}

# --- IAM ロール: タスク実行ロール ---
resource "aws_iam_role" "ecs_execution" {
  name = "\${var.project_name}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# --- IAM ロール: タスクロール ---
resource "aws_iam_role" "ecs_task" {
  name = "\${var.project_name}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}`;

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-[15px] font-semibold mb-2">
          ECS フルスタック構成（コピペで使える）
        </h3>
        <p className="text-[12px] text-muted-foreground mb-4">
          クラスター → タスク定義 → サービス → IAM ロールまでの一式。VPC
          とセキュリティグループは別途作成済みの前提です。
        </p>

        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-[11px] leading-relaxed max-h-[500px]">
          <code>{fullCode}</code>
        </pre>
        <div className="mt-2">
          <DownloadCodeButton
            code={fullCode}
            filename="ecs_fullstack.tf"
          />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h4 className="text-[13px] font-semibold text-blue-800 mb-3 flex items-center gap-1.5">
          <Cpu className="w-4 h-4" />
          Fargate の CPU / メモリ組み合わせ
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { cpu: "256", mem: "512 / 1024 / 2048" },
            { cpu: "512", mem: "1024 〜 4096" },
            { cpu: "1024", mem: "2048 〜 8192" },
            { cpu: "2048", mem: "4096 〜 16384" },
            { cpu: "4096", mem: "8192 〜 30720" },
            { cpu: "8192", mem: "16384 〜 61440" },
            { cpu: "16384", mem: "32768 〜 122880" },
          ].map((combo) => (
            <div
              key={combo.cpu}
              className="bg-white rounded-lg p-2 border border-blue-100 text-center"
            >
              <p className="text-[11px] font-mono font-semibold text-blue-800">
                {combo.cpu} CPU
              </p>
              <p className="text-[10px] text-blue-600">{combo.mem} MB</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-blue-600 mt-2">
          ※ CPU 単位は 1024 = 1 vCPU。メモリは 1 MB 単位で指定可能（範囲内）
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function EcsArchitecture() {
  const [activeTab, setActiveTab] = useState<Tab>("hierarchy");

  const tabs: readonly { readonly id: Tab; readonly label: string; readonly icon: React.ElementType }[] = [
    { id: "hierarchy", label: "階層構造", icon: Layers },
    { id: "multi-container", label: "マルチコンテナ", icon: Container },
    { id: "networking", label: "ネットワーク", icon: Network },
    { id: "scaling", label: "スケーリング", icon: Scale },
    { id: "terraform", label: "フル構成", icon: HardDrive },
  ] as const;

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[28px] font-bold mb-2">
            ECS アーキテクチャ解説
          </h1>
          <p className="text-muted-foreground text-[14px]">
            ECS の階層構造（Cluster → Service → Task → Container）を理解し、
            マルチコンテナ構成やコンテナ間通信の仕組みを学びます
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] transition-colors border ${
                activeTab === tab.id
                  ? "bg-purple-600 text-white border-purple-600"
                  : "border-border hover:border-purple-300 hover:bg-purple-50"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "hierarchy" && <HierarchySection />}
        {activeTab === "multi-container" && <MultiContainerSection />}
        {activeTab === "networking" && <NetworkingSection />}
        {activeTab === "scaling" && <ScalingSection />}
        {activeTab === "terraform" && <TerraformSection />}
      </div>
    </main>
  );
}
