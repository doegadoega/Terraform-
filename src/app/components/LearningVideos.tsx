import { useState } from "react";
import {
  Play,
  Monitor,
  Cloud,
  Network,
  Shield,
  Container,
  Rocket,
  Server,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  BookOpen,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Category = "all" | "terraform" | "ecs" | "network" | "deploy" | "aws-basics";

interface Video {
  readonly id: string;
  readonly title: string;
  readonly channel: string;
  readonly category: Category;
  readonly categoryLabel: string;
  readonly description: string;
  readonly topics: readonly string[];
}

// ─── Data ────────────────────────────────────────────────────────────────────

const VIDEOS: readonly Video[] = [
  {
    id: "h1MDCp7blmg",
    title: "Terraformの基礎を90分で解説するチュートリアル",
    channel: "クライン【KLeIn】",
    category: "terraform",
    categoryLabel: "Terraform",
    description:
      "Terraform の基本概念から実際のコードの書き方まで、90分で体系的に学べる入門チュートリアル。HCL の文法、リソース定義、変数、モジュールまでカバー。",
    topics: ["HCL文法", "リソース定義", "変数・出力", "モジュール", "State管理"],
  },
  {
    id: "HxBNDPQOJiQ",
    title: "AWS 最低限知っとくと良いサービス6選",
    channel: "クライン【KLeIn】",
    category: "aws-basics",
    categoryLabel: "AWS基礎",
    description:
      "AWS を使い始める際に最低限知っておくべき6つの主要サービスを解説。EC2、S3、RDS、IAM など基本サービスの概要と使いどころを紹介。",
    topics: ["EC2", "S3", "RDS", "IAM", "VPC", "Lambda"],
  },
  {
    id: "xq595cj3IdQ",
    title: "IAMとは？",
    channel: "クライン【KLeIn】",
    category: "aws-basics",
    categoryLabel: "AWS基礎",
    description:
      "AWS IAM（Identity and Access Management）の基本を解説。ユーザー、グループ、ロール、ポリシーの概念と、最小権限の原則について学ぶ。",
    topics: ["IAMユーザー", "IAMロール", "ポリシー", "最小権限", "MFA"],
  },
  {
    id: "7J_crzU5KP8",
    title: "AWS 基本ネットワーク構成をマスターしよう！",
    channel: "クライン【KLeIn】",
    category: "network",
    categoryLabel: "ネットワーク",
    description:
      "AWS の VPC、サブネット、インターネットゲートウェイ、ルートテーブルなど、基本的なネットワーク構成要素を実際に構築しながら解説。",
    topics: ["VPC", "サブネット", "IGW", "ルートテーブル", "セキュリティグループ"],
  },
  {
    id: "rnRKHXePeVM",
    title: "NAT（IPアドレス変換）を超ざっくり解説！",
    channel: "クライン【KLeIn】",
    category: "network",
    categoryLabel: "ネットワーク",
    description:
      "NAT（Network Address Translation）の仕組みをわかりやすく解説。プライベートIPとパブリックIPの変換、NATゲートウェイの役割について。",
    topics: ["NAT", "IPアドレス変換", "プライベートIP", "パブリックIP"],
  },
  {
    id: "R7fyKQ2e0XU",
    title: "AWS NATゲートウェイを超ざっくり解説！",
    channel: "クライン【KLeIn】",
    category: "network",
    categoryLabel: "ネットワーク",
    description:
      "AWS の NAT ゲートウェイの仕組みと使いどころを解説。プライベートサブネットからインターネットにアクセスする方法を学ぶ。",
    topics: ["NATゲートウェイ", "プライベートサブネット", "アウトバウンド通信", "コスト"],
  },
  {
    id: "Y-Mc2OenReA",
    title: "ELBとEC2で負荷分散してみよう",
    channel: "クライン【KLeIn】",
    category: "network",
    categoryLabel: "ネットワーク",
    description:
      "ELB（Elastic Load Balancer）を使って EC2 インスタンスへのトラフィックを負荷分散する方法を実践的に解説。ALB の設定方法も学べる。",
    topics: ["ELB", "ALB", "EC2", "負荷分散", "ヘルスチェック"],
  },
  {
    id: "2_FxLp9xgmo",
    title: "ECS(Fargate)とECRで楽々コンテナからHelloWorld",
    channel: "クライン【KLeIn】",
    category: "ecs",
    categoryLabel: "ECS/コンテナ",
    description:
      "ECS Fargate と ECR を使ってコンテナアプリケーションをデプロイする方法をハンズオン形式で解説。Docker イメージの作成からデプロイまでの一連の流れ。",
    topics: ["ECS", "Fargate", "ECR", "Docker", "コンテナデプロイ"],
  },
  {
    id: "Bq-DT30hesA",
    title: "20分でFARGATEの基本を解説する",
    channel: "クライン【KLeIn】",
    category: "ecs",
    categoryLabel: "ECS/コンテナ",
    description:
      "AWS Fargate の基本概念を20分でコンパクトに解説。EC2 起動タイプとの違い、メリット・デメリット、料金体系まで。",
    topics: ["Fargate", "サーバーレスコンテナ", "EC2との比較", "料金", "ユースケース"],
  },
  {
    id: "ptZcgOjmgss",
    title: "サーバーレスを超ざっくり解説！",
    channel: "クライン【KLeIn】",
    category: "deploy",
    categoryLabel: "デプロイ/運用",
    description:
      "サーバーレスアーキテクチャの概念をわかりやすく解説。Lambda、API Gateway などのサーバーレスサービスの概要と、従来のサーバー管理との違い。",
    topics: ["サーバーレス", "Lambda", "API Gateway", "イベント駆動", "スケーリング"],
  },
  {
    id: "_mlZ-j2d6vY",
    title: "CI/CDを作れるCode4兄弟を紹介！",
    channel: "クライン【KLeIn】",
    category: "deploy",
    categoryLabel: "デプロイ/運用",
    description:
      "AWS の CI/CD サービス群（CodeCommit、CodeBuild、CodeDeploy、CodePipeline）を紹介。自動デプロイパイプラインの構築方法を学ぶ。",
    topics: ["CodeCommit", "CodeBuild", "CodeDeploy", "CodePipeline", "CI/CD"],
  },
  {
    id: "C-CtA0LPmPg",
    title: "ブルーグリーンデプロイメントを超ざっくり解説！",
    channel: "クライン【KLeIn】",
    category: "deploy",
    categoryLabel: "デプロイ/運用",
    description:
      "ブルーグリーンデプロイメントの仕組みとメリットを解説。ダウンタイムゼロでのデプロイ手法と、ロールバック戦略について。",
    topics: ["Blue/Green", "無停止デプロイ", "ロールバック", "ALB切替", "リスク軽減"],
  },
] as const;

const CATEGORIES: readonly { readonly id: Category; readonly label: string; readonly icon: React.ElementType }[] = [
  { id: "all", label: "すべて", icon: BookOpen },
  { id: "terraform", label: "Terraform", icon: Monitor },
  { id: "aws-basics", label: "AWS基礎", icon: Cloud },
  { id: "network", label: "ネットワーク", icon: Network },
  { id: "ecs", label: "ECS/コンテナ", icon: Container },
  { id: "deploy", label: "デプロイ/運用", icon: Rocket },
] as const;

// ─── Components ──────────────────────────────────────────────────────────────

function VideoCard({ video }: { readonly video: Video }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const categoryColors: Record<string, string> = {
    terraform: "bg-purple-100 text-purple-700",
    "aws-basics": "bg-orange-100 text-orange-700",
    network: "bg-blue-100 text-blue-700",
    ecs: "bg-green-100 text-green-700",
    deploy: "bg-red-100 text-red-700",
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden transition-shadow hover:shadow-md">
      {/* Thumbnail / Player */}
      <div className="relative aspect-video bg-gray-900">
        {isPlaying ? (
          <iframe
            src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <button
            onClick={() => setIsPlaying(true)}
            className="absolute inset-0 w-full h-full group cursor-pointer"
          >
            <img
              src={`https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`}
              alt={video.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
              }}
            />
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-red-600 group-hover:bg-red-500 flex items-center justify-center transition-colors shadow-lg">
                <Play className="w-7 h-7 text-white ml-1" fill="white" />
              </div>
            </div>
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  categoryColors[video.category] ?? "bg-gray-100 text-gray-700"
                }`}
              >
                {video.categoryLabel}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {video.channel}
              </span>
            </div>
            <h3 className="text-[14px] font-semibold leading-snug mb-1">
              {video.title}
            </h3>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="shrink-0 mt-1"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-border space-y-3">
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              {video.description}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {video.topics.map((topic) => (
                <span
                  key={topic}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                >
                  {topic}
                </span>
              ))}
            </div>
            <a
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] text-purple-600 hover:text-purple-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              YouTube で開く
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function LearningVideos() {
  const [activeCategory, setActiveCategory] = useState<Category>("all");

  const filteredVideos =
    activeCategory === "all"
      ? VIDEOS
      : VIDEOS.filter((v) => v.category === activeCategory);

  const categoryCounts = CATEGORIES.map((cat) => ({
    ...cat,
    count:
      cat.id === "all"
        ? VIDEOS.length
        : VIDEOS.filter((v) => v.category === cat.id).length,
  }));

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[28px] font-bold mb-2 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center">
              <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
            </div>
            学習動画
          </h1>
          <p className="text-muted-foreground text-[14px]">
            Terraform・AWS の基礎からコンテナデプロイまでを動画で学習 —
            サムネイルをクリックするとこのページ内で再生できます
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {categoryCounts.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] transition-colors border ${
                activeCategory === cat.id
                  ? "bg-purple-600 text-white border-purple-600"
                  : "border-border hover:border-purple-300 hover:bg-purple-50"
              }`}
            >
              <cat.icon className="w-4 h-4" />
              {cat.label}
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-full ml-0.5 ${
                  activeCategory === cat.id
                    ? "bg-white/20"
                    : "bg-muted"
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Recommended Learning Path */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-5 mb-6">
          <h3 className="text-[14px] font-semibold text-purple-800 mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            おすすめの視聴順序
          </h3>
          <div className="flex items-center gap-2 flex-wrap text-[12px]">
            {[
              { step: "1", label: "AWS 基礎6選", color: "bg-orange-500" },
              { step: "2", label: "IAM", color: "bg-orange-500" },
              { step: "3", label: "ネットワーク基礎", color: "bg-blue-500" },
              { step: "4", label: "NAT → NATゲートウェイ", color: "bg-blue-500" },
              { step: "5", label: "ELB/EC2", color: "bg-blue-500" },
              { step: "6", label: "Terraform 90分", color: "bg-purple-500" },
              { step: "7", label: "Fargate → ECS/ECR", color: "bg-green-500" },
              { step: "8", label: "サーバーレス", color: "bg-red-500" },
              { step: "9", label: "CI/CD → B/G デプロイ", color: "bg-red-500" },
            ].map((item, i) => (
              <div key={item.step} className="flex items-center gap-1.5">
                {i > 0 && (
                  <span className="text-purple-300">→</span>
                )}
                <span
                  className={`${item.color} text-white px-1.5 py-0.5 rounded text-[10px] font-bold`}
                >
                  {item.step}
                </span>
                <span className="text-purple-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredVideos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>

        {filteredVideos.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Server className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-[14px]">
              このカテゴリの動画はまだありません
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
