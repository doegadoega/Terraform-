import { useState } from "react";
import {
  BookOpen,
  GitBranch,
  Terminal,
  Shield,
  Lightbulb,
  CheckCircle2,
  Circle,
  TrendingUp,
  ExternalLink,
  Sparkles,
  Container,
  Globe,
  Rocket,
  FolderGit2,
  Zap,
  ClipboardCheck,
} from "lucide-react";
import { Link } from "react-router";

const progressData = [
  { label: "基本概念", progress: 0, total: 12, to: "/concepts", icon: BookOpen, color: "bg-blue-500" },
  { label: "ワークフロー", progress: 0, total: 6, to: "/workflow", icon: GitBranch, color: "bg-green-500" },
  { label: "コマンド", progress: 0, total: 15, to: "/commands", icon: Terminal, color: "bg-orange-500" },
  { label: "プロバイダー", progress: 0, total: 7, to: "/providers", icon: Shield, color: "bg-purple-500" },
  { label: "コンテナ構築", progress: 0, total: 4, to: "/containers", icon: Container, color: "bg-cyan-500" },
  { label: "VPC & コンテナ実践", progress: 0, total: 7, to: "/vpc-container", icon: Container, color: "bg-indigo-500" },
  { label: "サーバーレス", progress: 0, total: 7, to: "/serverless", icon: Zap, color: "bg-amber-500" },
  { label: "マルチリージョン", progress: 0, total: 5, to: "/multi-region", icon: Globe, color: "bg-emerald-500" },
  { label: "デプロイ実践", progress: 0, total: 3, to: "/deploy-practice", icon: Rocket, color: "bg-rose-500" },
  { label: "Git / GitHub", progress: 0, total: 6, to: "/git-workflow", icon: FolderGit2, color: "bg-gray-700" },
  { label: "ベストプラクティス", progress: 0, total: 8, to: "/best-practices", icon: Lightbulb, color: "bg-yellow-500" },
  { label: "演習問題", progress: 0, total: 20, to: "/exercises", icon: ClipboardCheck, color: "bg-pink-500" },
];

const totalTopics = progressData.reduce((sum, p) => sum + p.total, 0);

const recentTopics = [
  { title: "Infrastructure as Code とは", category: "基本概念", difficulty: "初級", to: "/concepts" },
  { title: "terraform init の使い方", category: "コマンド", difficulty: "初級", to: "/commands" },
  { title: "HCL の基本構文", category: "基本概念", difficulty: "初級", to: "/concepts" },
  { title: "terraform plan で変更確認", category: "コマンド", difficulty: "初級", to: "/commands" },
  { title: "AWS プロバイダーの設定", category: "プロバイダー", difficulty: "初級", to: "/providers" },
  { title: "Variable（変数）の使い方", category: "基本概念", difficulty: "初級", to: "/concepts" },
  { title: "State管理のベストプラクティス", category: "ベストプラクティス", difficulty: "中級", to: "/best-practices" },
  { title: "Module（モジュール）の設計", category: "基本概念", difficulty: "中級", to: "/concepts" },
  { title: "CI/CDパイプラインの構築", category: "ベストプラクティス", difficulty: "中級", to: "/best-practices" },
  { title: "セキュリティのベストプラクティス", category: "ベストプラクティス", difficulty: "中級", to: "/best-practices" },
];

const difficultyColor: Record<string, string> = {
  "初級": "bg-green-100 text-green-700",
  "中級": "bg-yellow-100 text-yellow-700",
  "上級": "bg-red-100 text-red-700",
};

const quickLinks = [
  { label: "Terraform公式ドキュメント", url: "https://developer.hashicorp.com/terraform/docs" },
  { label: "Terraform Registry", url: "https://registry.terraform.io/" },
  { label: "HashiCorp Learn", url: "https://developer.hashicorp.com/terraform/tutorials" },
  { label: "Terraform GitHub", url: "https://github.com/hashicorp/terraform" },
];

const learningPath = [
  { step: 1, title: "基礎を理解する", desc: "IaC, HCL, リソースの概念を学ぶ", to: "/concepts" },
  { step: 2, title: "ワークフローを覚える", desc: "init → plan → apply の流れを習得", to: "/workflow" },
  { step: 3, title: "コマンドを使いこなす", desc: "主要コマンドとオプションを理解", to: "/commands" },
  { step: 4, title: "プロバイダーを選ぶ", desc: "AWS/Azure/GCPの設定方法を学ぶ", to: "/providers" },
  { step: 5, title: "コンテナを構築する", desc: "ECS/EKS/GKEでコンテナ環境を構築", to: "/containers" },
  { step: 6, title: "VPC & コンテナ実践", desc: "VPC構築→ECR→ECS→Lambda/Webアプリ配置", to: "/vpc-container" },
  { step: 7, title: "サーバーレスAPIを作る", desc: "API Gateway + Lambdaのモジュール管理", to: "/serverless" },
  { step: 8, title: "マルチリージョンで検証", desc: "別リージョンでの動作確認とDR構成", to: "/multi-region" },
  { step: 9, title: "実際にデプロイしてみる", desc: "大阪リージョンにアプリをデプロイ！", to: "/deploy-practice" },
  { step: 10, title: "Git/GitHubで管理する", desc: "CI/CD・PR運用・チーム開発の実践", to: "/git-workflow" },
  { step: 11, title: "実践的に運用する", desc: "ベストプラクティスでプロ品質に", to: "/best-practices" },
  { step: 12, title: "演習問題で力試し", desc: "20問の問題で理解度をチェック！", to: "/exercises" },
];

export function Dashboard() {
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set());

  const toggleTopic = (title: string) => {
    setCompletedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1>Terraform 学習ダッシュボード</h1>
        <p className="text-muted-foreground mt-1">
          HashiCorp Terraformの基礎から応用まで、ステップバイステップで学びましょう
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-[14px]">完了トピック</p>
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-[28px] mt-2">{completedTopics.size}</p>
          <p className="text-muted-foreground text-[13px]">/ {totalTopics} トピック</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-[14px]">学習進捗</p>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-[28px] mt-2">{Math.round((completedTopics.size / totalTopics) * 100)}%</p>
          <div className="w-full bg-muted rounded-full h-2 mt-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all"
              style={{ width: `${(completedTopics.size / totalTopics) * 100}%` }}
            />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-[14px]">カテゴリ</p>
            <BookOpen className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-[28px] mt-2">12</p>
          <p className="text-muted-foreground text-[13px]">学習カテゴリ</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-[14px]">総コンテンツ</p>
            <Sparkles className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-[28px] mt-2">{totalTopics}</p>
          <p className="text-muted-foreground text-[13px]">学習トピック</p>
        </div>
      </div>

      {/* Learning Path */}
      <div>
        <h2 className="mb-4">学習ロードマップ</h2>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="space-y-0">
            {learningPath.map((item, i) => (
              <Link
                key={item.step}
                to={item.to}
                className="flex items-start gap-4 p-3 rounded-lg hover:bg-accent/50 transition-colors group"
              >
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-[13px]">
                    {item.step}
                  </div>
                  {i < learningPath.length - 1 && <div className="w-0.5 h-8 bg-purple-200 mt-1" />}
                </div>
                <div className="pt-1">
                  <p className="text-[14px] group-hover:text-purple-600 transition-colors">{item.title}</p>
                  <p className="text-[13px] text-muted-foreground">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Progress by category */}
      <div>
        <h2 className="mb-4">カテゴリ別進捗</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {progressData.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="bg-card border border-border rounded-xl p-5 hover:border-purple-300 transition-colors group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-lg ${item.color} flex items-center justify-center`}>
                  <item.icon className="w-[18px] h-[18px] text-white" />
                </div>
                <div>
                  <span className="text-[15px]">{item.label}</span>
                  <p className="text-[12px] text-muted-foreground">{item.total} トピック</p>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`${item.color} h-2 rounded-full transition-all`}
                  style={{ width: `${(item.progress / item.total) * 100}%` }}
                />
              </div>
              <p className="text-muted-foreground text-[13px] mt-2">
                {item.progress} / {item.total} 完了
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent / Recommended Topics */}
      <div>
        <h2 className="mb-4">おすすめトピック</h2>
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {recentTopics.map((topic) => (
            <div
              key={topic.title}
              className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => toggleTopic(topic.title)}
            >
              <div className="flex items-center gap-3">
                {completedTopics.has(topic.title) ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
                <div>
                  <p className="text-[14px]">{topic.title}</p>
                  <p className="text-[12px] text-muted-foreground">{topic.category}</p>
                </div>
              </div>
              <span
                className={`text-[12px] px-2 py-0.5 rounded-full ${difficultyColor[topic.difficulty]}`}
              >
                {topic.difficulty}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="mb-4">外部リソース</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickLinks.map((link) => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:border-purple-300 transition-colors group"
            >
              <span className="text-[14px] group-hover:text-purple-600 transition-colors">
                {link.label}
              </span>
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-purple-600" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}