import { NavLink } from "react-router";
import {
  LayoutDashboard,
  BookOpen,
  GitBranch,
  Terminal,
  Shield,
  Lightbulb,
  GraduationCap,
  Container,
  Globe,
  Rocket,
  FolderGit2,
  Zap,
  Network,
  ClipboardCheck,
  Database,
  KeyRound,
  ShieldCheck,
  Map,
  Boxes,
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "ダッシュボード" },
  { to: "/concepts", icon: BookOpen, label: "基本概念" },
  { to: "/workflow", icon: GitBranch, label: "ワークフロー" },
  { to: "/commands", icon: Terminal, label: "コマンド" },
  { to: "/providers", icon: Shield, label: "プロバイダー" },
  { to: "/containers", icon: Container, label: "コンテナ構築" },
  { to: "/ecs-architecture", icon: Boxes, label: "ECSアーキテクチャ" },
  { to: "/vpc-step-guide", icon: Map, label: "VPC構築ガイド" },
  { to: "/vpc-container", icon: Network, label: "VPC & コンテナ実践" },
  { to: "/aws-integration", icon: Database, label: "AWS連携" },
  { to: "/cognito-auth", icon: KeyRound, label: "Cognito認証" },
  { to: "/zscaler", icon: ShieldCheck, label: "Zscaler ZPA" },
  { to: "/serverless", icon: Zap, label: "サーバーレス" },
  { to: "/multi-region", icon: Globe, label: "マルチリージョン" },
  { to: "/deploy-practice", icon: Rocket, label: "デプロイ実践" },
  { to: "/git-workflow", icon: FolderGit2, label: "Git / GitHub" },
  { to: "/best-practices", icon: Lightbulb, label: "ベストプラクティス" },
  { to: "/exercises", icon: ClipboardCheck, label: "演習問題" },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-card border-r border-border h-screen sticky top-0 flex flex-col">
      <div className="p-5 border-b border-border flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-purple-600 flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-[15px]">Terraform学習</h2>
          <p className="text-[12px] text-muted-foreground">ダッシュボード</p>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] transition-colors ${
                isActive
                  ? "bg-purple-600 text-white"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`
            }
          >
            <item.icon className="w-[18px] h-[18px]" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}