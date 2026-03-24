import { useState } from "react";
import {
  GitBranch,
  GitPullRequest,
  GitMerge,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  AlertTriangle,
  FolderGit2,
  Shield,
  Users,
  Workflow,
  Eye,
  Rocket,
  FileCode,
  Lock,
  RefreshCw,
  CheckCircle2,
  Settings,
  Layers,
} from "lucide-react";
import { DownloadCodeButton } from "./DownloadCodeButton";

type Tab = "setup" | "branching" | "github-actions" | "pr-workflow" | "secrets" | "team";

const tabs: { id: Tab; label: string; icon: React.ElementType; color: string }[] = [
  { id: "setup", label: "初期セットアップ", icon: FolderGit2, color: "bg-gray-700" },
  { id: "branching", label: "ブランチ戦略", icon: GitBranch, color: "bg-purple-600" },
  { id: "github-actions", label: "GitHub Actions", icon: Workflow, color: "bg-blue-600" },
  { id: "pr-workflow", label: "PR運用フロー", icon: GitPullRequest, color: "bg-green-600" },
  { id: "secrets", label: "シークレット管理", icon: Lock, color: "bg-red-600" },
  { id: "team", label: "チーム開発", icon: Users, color: "bg-orange-500" },
];

interface Section {
  title: string;
  description: string;
  code: string;
  tips?: string[];
  warnings?: string[];
  fileHint?: string;
}

// ---- Setup ----
const setupSections: Section[] = [
  {
    title: "Step 1: Gitリポジトリの初期化",
    description:
      "Terraformプロジェクト用のGitリポジトリを作成し、基本的なファイル構成を整えます。.gitignore の設定が特に重要です。",
    fileHint: "ターミナル",
    code: `# リポジトリの作成
$ mkdir my-terraform-project && cd my-terraform-project
$ git init

# GitHubにリモートリポジトリを作成してリンク
$ gh repo create my-terraform-project --private
# または
$ git remote add origin git@github.com:your-org/my-terraform-project.git`,
    tips: [
      "Terraformリポジトリは基本的に private にする（機密情報保護）",
      "GitHub CLI（gh）を使うとリポジトリ作成が簡単",
    ],
  },
  {
    title: "Step 2: .gitignore の設定（超重要！）",
    description:
      "Terraformには絶対にGitにコミットしてはいけないファイルがあります。.gitignore を最初に正しく設定しましょう。",
    fileHint: ".gitignore",
    code: `# ========================================
# .gitignore（Terraform用）
# ========================================

# ローカルの .terraform ディレクトリ
# （プロバイダーのバイナリ等が入っている。巨大。）
.terraform/
.terraform.lock.hcl

# tfstate ファイル（State）
# ★ これをGitに入れると機密情報が漏洩する！
# ★ 必ずリモートバックエンド（S3等）で管理すること！
*.tfstate
*.tfstate.*

# tfvars ファイル（機密変数が含まれる可能性）
# ★ APIキーやパスワードが入っている可能性がある
*.tfvars
!example.tfvars        # サンプルファイルは残す

# プラン出力ファイル
*.tfplan
out.plan

# クラッシュログ
crash.log
crash.*.log

# CLI設定ファイル
.terraformrc
terraform.rc

# OS固有
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
*.swo`,
    tips: [
      "最も重要: *.tfstate と *.tfvars を絶対にコミットしない",
      ".terraform/ にはプロバイダーバイナリ（数百MB）が入る",
      "example.tfvars をコミットしてチームに必要な変数を共有する",
    ],
    warnings: [
      "一度でも tfstate をコミットすると、履歴に機密情報が残る。万が一の場合は git filter-branch で履歴を書き換える必要がある",
    ],
  },
  {
    title: "Step 3: 推奨ディレクトリ構成",
    description: "チーム開発に適したディレクトリ構成を作ります。モジュールと環境を分離し、再利用性と保守性を高めます。",
    fileHint: "プロジェクトルート",
    code: `# 推奨ディレクトリ構成
my-terraform-project/
│
├── .github/
│   └── workflows/
│       ├── terraform-plan.yml     # PR時に自動 plan
│       ├── terraform-apply.yml    # マージ時に自動 apply
│       └── terraform-destroy.yml  # 手動実行で destroy
│
├── modules/                       # 再利用可能なモジュール
│   ├── networking/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   ├── compute/
│   ├── database/
│   └── static-site/
│
├── environments/                  # 環境別の設定
│   ├── dev/
│   │   ├── main.tf
│   │   ├── backend.tf
│   │   ├── variables.tf
│   │   ├── terraform.tfvars       # ← .gitignoreで除外
│   │   └── example.tfvars         # ← サンプル（コミット対象）
│   ├── staging/
│   └── prod/
│       ├── ap-northeast-1/        # 東京
│       └── ap-northeast-3/        # 大阪
│
├── scripts/
│   ├── deploy.sh
│   └── validate-all.sh
│
├── .gitignore
├── .pre-commit-config.yaml        # pre-commitフック
├── README.md
└── CODEOWNERS                     # レビュー必須設定`,
    tips: [
      "modules/ は環境非依存。environments/ が環境固有の設定を持つ",
      "README.md を各モジュールに書いておくとチームメンバーが助かる",
      "example.tfvars で必要な変数の形式をドキュメント化",
    ],
  },
  {
    title: "Step 4: リモートバックエンドの設定",
    description:
      "StateファイルをS3（またはTerraform Cloud）で管理します。これによりチームでStateを共有でき、Gitに機密情報を入れずに済みます。",
    fileHint: "environments/prod/ap-northeast-1/backend.tf",
    code: `# ========================================
# 方法1: S3 + DynamoDB（AWS）
# ========================================

# まずバックエンド用のリソースを手動で作成（1回だけ）
# $ aws s3api create-bucket \\
#     --bucket my-org-terraform-state \\
#     --region ap-northeast-1 \\
#     --create-bucket-configuration LocationConstraint=ap-northeast-1

# $ aws dynamodb create-table \\
#     --table-name terraform-locks \\
#     --attribute-definitions AttributeName=LockID,AttributeType=S \\
#     --key-schema AttributeName=LockID,KeyType=HASH \\
#     --billing-mode PAY_PER_REQUEST \\
#     --region ap-northeast-1

# backend.tf
terraform {
  backend "s3" {
    bucket         = "my-org-terraform-state"
    key            = "prod/ap-northeast-1/terraform.tfstate"
    region         = "ap-northeast-1"
    dynamodb_table = "terraform-locks"   # ロック用
    encrypt        = true                # 暗号化
  }
}

# ========================================
# 方法2: Terraform Cloud（無料プランあり）
# ========================================

terraform {
  cloud {
    organization = "my-org"

    workspaces {
      name = "my-app-prod-tokyo"
    }
  }
}

# Terraform Cloud の利点:
# - State管理 + ロック + 暗号化が自動
# - Web UIで State の確認・比較ができる
# - plan/apply の実行をクラウドで行える
# - 5ユーザーまで無料

# ========================================
# 初回のバックエンド初期化
# ========================================
# $ cd environments/prod/ap-northeast-1
# $ terraform init
# Initializing the backend...
# Successfully configured the backend "s3"!`,
    tips: [
      "DynamoDB テーブルでStateのロックを管理（同時編集を防止）",
      "encrypt = true でS3内のStateを暗号化",
      "バックエンド用のS3/DynamoDBは最初に手動で作るか、別のTerraformプロジェクトで管理",
    ],
    warnings: [
      "バックエンド設定を変更すると terraform init -migrate-state が必要",
    ],
  },
  {
    title: "Step 5: 最初のコミット & プッシュ",
    description: "準備ができたら最初のコミットを行います。コミット前にsensitiveな情報が含まれていないか必ず確認しましょう。",
    fileHint: "ターミナル",
    code: `# コミット前の確認
$ git status
$ git diff

# 機密情報が含まれていないかチェック
$ grep -r "AKIA" .          # AWSアクセスキー
$ grep -r "password" .       # パスワード
$ grep -r "secret" .         # シークレット
# → 何も出力されなければOK

# ステージング & コミット
$ git add .
$ git status                 # 最終確認！

# .tfstate や .tfvars が含まれていないことを確認
# ↓ これらが表示されたら .gitignore を見直す
#   new file: xxx.tfstate      ← NG！
#   new file: xxx.tfvars       ← NG！

$ git commit -m "feat: initial Terraform project setup

- Add module structure (networking, compute, static-site)
- Configure S3 remote backend
- Set up .gitignore for Terraform
- Add GitHub Actions workflows"

# プッシュ
$ git push -u origin main

# ブランチ保護ルールを設定（GitHub UI または CLI）
$ gh api repos/{owner}/{repo}/branches/main/protection -X PUT \\
  -f "required_pull_request_reviews[required_approving_review_count]=1" \\
  -F "enforce_admins=true" \\
  -F "required_status_checks[strict]=true" \\
  -f "required_status_checks[contexts][]=terraform-plan"`,
    tips: [
      "mainブランチへの直接pushは禁止し、必ずPR経由にする",
      "コミットメッセージは Conventional Commits 形式が推奨",
      "ブランチ保護で plan のステータスチェックを必須にする",
    ],
  },
];

// ---- Branching ----
const branchingSections: Section[] = [
  {
    title: "Terraform向けブランチ戦略",
    description:
      "Terraformプロジェクトでは、環境（dev/staging/prod）とブランチの関係を明確に定義することが重要です。",
    code: `# ========================================
# 推奨: 環境ブランチ戦略
# ========================================

main（本番環境に自動適用）
 ├── develop（開発環境に自動適用）
 │    ├── feature/add-rds-module
 │    ├── feature/update-vpc-cidr
 │    └── fix/security-group-rule
 └── staging（ステージング環境に自動適用）

# ========================================
# ブランチと環境の対応
# ========================================
# main     → prod（terraform apply 自動実行）
# staging  → staging（terraform apply 自動実行）
# develop  → dev（terraform apply 自動実行）
# feature/* → なし（terraform plan のみ実行）

# ========================================
# ブランチ命名規則
# ========================================
# feature/xxx    新機能・新リソースの追加
# fix/xxx        バグ修正・設定修正
# refactor/xxx   リファクタリング（モジュール整理等）
# docs/xxx       ドキュメント更新
# hotfix/xxx     本番の緊急修正（main から直接分岐）

# ========================================
# 運用フロー
# ========================================

# 1. feature ブランチを切る
$ git checkout develop
$ git pull origin develop
$ git checkout -b feature/add-osaka-region

# 2. 変更を実装 & コミット
$ vim environments/prod/ap-northeast-3/main.tf
$ terraform fmt -recursive
$ terraform validate
$ git add .
$ git commit -m "feat: add Osaka region deployment"

# 3. PRを作成
$ git push origin feature/add-osaka-region
$ gh pr create --base develop \\
  --title "feat: 大阪リージョンのデプロイ設定を追加" \\
  --body "## 変更内容
- 大阪リージョン(ap-northeast-3)の環境設定を追加
- 静的サイトモジュールを使用

## terraform plan の結果
GitHub Actionsの結果を確認してください"

# 4. PRでplanが自動実行される
# 5. レビュー & 承認後にマージ
# 6. develop → staging → main へ段階的にマージ`,
    tips: [
      "feature ブランチでは plan のみ、マージ後に apply が走る構成が安全",
      "hotfix は main から直接分岐し、修正後に develop にもバックマージ",
      "小さなPRを心がける（1PRに複数環境の変更を含めない）",
    ],
  },
  {
    title: "環境別PRフロー図",
    description: "feature → develop → staging → main と段階的に昇格させることで、本番への影響を最小化します。",
    code: `# ========================================
# 段階的デプロイフロー
# ========================================

    feature/add-osaka-region
            │
            │ PR + terraform plan（自動）
            ▼
    develop ─────── dev環境に apply（自動）
            │
            │ 動作確認OK!
            │ PR + terraform plan（自動）
            ▼
    staging ─────── staging環境に apply（自動）
            │
            │ QA + 動作確認OK!
            │ PR + terraform plan（自動）
            │ ★ 承認必須（CODEOWNERS）
            ▼
    main ────────── prod環境に apply（自動 or 手動承認）


# ========================================
# CODEOWNERS ファイル（レビュー必須設定）
# ========================================
# .github/CODEOWNERS

# インフラ変更は全てインフラチームのレビュー必須
*                          @your-org/infra-team

# 本番環境は追加でリードの承認も必須
environments/prod/         @your-org/infra-leads

# モジュール変更は作成者 + インフラチーム
modules/                   @your-org/infra-team

# GitHub Actions の変更はリードの承認必須
.github/                   @your-org/infra-leads`,
    tips: [
      "CODEOWNERS で本番変更に対するレビュー必須化を強制",
      "develop で十分テストしてから staging → main へ昇格",
      "緊急時は hotfix ブランチで main に直接PRを出す",
    ],
  },
];

// ---- GitHub Actions ----
const githubActionsSections: Section[] = [
  {
    title: "PR時に terraform plan を自動実行",
    description:
      "PRが作成されたら自動で terraform plan を実行し、結果をPRコメントに投稿します。これによりレビュアーが変更内容を確認できます。",
    fileHint: ".github/workflows/terraform-plan.yml",
    code: `# .github/workflows/terraform-plan.yml
name: Terraform Plan

on:
  pull_request:
    branches: [main, staging, develop]
    paths:
      - 'modules/**'
      - 'environments/**'
      - '.github/workflows/terraform-*.yml'

# PRコメントの書き込みに必要
permissions:
  contents: read
  pull-requests: write

env:
  TF_VERSION: "1.7.0"

jobs:
  # 変更された環境を検出
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      environments: \${{ steps.changes.outputs.environments }}
    steps:
      - uses: actions/checkout@v4
      - id: changes
        name: Detect changed environments
        run: |
          ENVS=$(git diff --name-only origin/\${{ github.base_ref }}...HEAD \\
            | grep '^environments/' \\
            | cut -d'/' -f2-3 \\
            | sort -u \\
            | jq -R -s -c 'split("\\n") | map(select(length > 0))')
          echo "environments=$ENVS" >> $GITHUB_OUTPUT

  plan:
    needs: detect-changes
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: \${{ fromJson(needs.detect-changes.outputs.environments) }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: \${{ env.TF_VERSION }}

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: \${{ secrets.AWS_ROLE_ARN }}
          aws-region: ap-northeast-1

      - name: Terraform Init
        working-directory: environments/\${{ matrix.environment }}
        run: terraform init -input=false

      - name: Terraform Format Check
        working-directory: environments/\${{ matrix.environment }}
        run: terraform fmt -check -recursive

      - name: Terraform Validate
        working-directory: environments/\${{ matrix.environment }}
        run: terraform validate

      - name: Terraform Plan
        id: plan
        working-directory: environments/\${{ matrix.environment }}
        run: |
          terraform plan -input=false -no-color \\
            -out=tfplan 2>&1 | tee plan_output.txt
        continue-on-error: true

      - name: Post Plan to PR
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const plan = fs.readFileSync(
              'environments/\${{ matrix.environment }}/plan_output.txt',
              'utf8'
            );
            const truncated = plan.length > 60000
              ? plan.substring(0, 60000) + '\\n... (truncated)'
              : plan;

            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: \`### 📋 Terraform Plan: \\\`\${{ matrix.environment }}\\\`

            \\\`\\\`\\\`hcl
            \${truncated}
            \\\`\\\`\\\`

            | Status | Environment |
            |--------|-------------|
            | \${{ steps.plan.outcome == 'success' && '✅ Success' || '❌ Failed' }} | \${{ matrix.environment }} |
            \`
            });

      - name: Fail if plan failed
        if: steps.plan.outcome == 'failure'
        run: exit 1`,
    tips: [
      "paths フィルタで関連ファイルの変更時のみ実行（無駄な実行を防止）",
      "plan 結果をPRコメントに投稿するとレビューが格段にやりやすくなる",
      "matrix で複数環境のplanを並列実行",
      "OIDC（role-to-assume）で長期クレデンシャル不要に",
    ],
  },
  {
    title: "マージ時に terraform apply を自動実行",
    description: "mainブランチへのマージ時に自動で apply を実行します。環境ごとに手動承認ゲートを設けることも可能。",
    fileHint: ".github/workflows/terraform-apply.yml",
    code: `# .github/workflows/terraform-apply.yml
name: Terraform Apply

on:
  push:
    branches: [main]
    paths:
      - 'modules/**'
      - 'environments/**'

permissions:
  contents: read
  id-token: write

# 同時実行を防止（State ロックの競合防止）
concurrency:
  group: terraform-apply
  cancel-in-progress: false

jobs:
  apply-prod:
    runs-on: ubuntu-latest
    # GitHub Environments で手動承認を設定可能
    environment: production
    strategy:
      # 順番に実行（並列だとState競合の可能性）
      max-parallel: 1
      matrix:
        region:
          - { dir: "prod/ap-northeast-1", name: "Tokyo" }
          - { dir: "prod/ap-northeast-3", name: "Osaka" }
    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.7.0"

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: \${{ secrets.AWS_ROLE_ARN }}
          aws-region: ap-northeast-1

      - name: Terraform Init
        working-directory: environments/\${{ matrix.region.dir }}
        run: terraform init -input=false

      - name: Terraform Apply
        working-directory: environments/\${{ matrix.region.dir }}
        run: |
          echo "🚀 Applying to \${{ matrix.region.name }}..."
          terraform apply -input=false -auto-approve

      - name: Post-deploy Health Check
        run: |
          cd environments/\${{ matrix.region.dir }}
          SITE_URL=$(terraform output -raw site_url 2>/dev/null || echo "")
          if [ -n "$SITE_URL" ]; then
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" $SITE_URL)
            echo "Health check: $SITE_URL → HTTP $STATUS"
            if [ "$STATUS" != "200" ]; then
              echo "::warning::Health check failed for \${{ matrix.region.name }}"
            fi
          fi

      - name: Notify on failure
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🚨 Terraform Apply Failed: \${{ matrix.region.name }}',
              body: 'Apply failed for \${{ matrix.region.dir }}. Check the workflow run.',
              labels: ['bug', 'infrastructure']
            });`,
    tips: [
      "concurrency で同時実行を防ぎ、State ロックの競合を回避",
      "max-parallel: 1 でリージョンを順番に適用（安全）",
      "environment: production でGitHub UI上の手動承認が可能",
      "失敗時に自動でIssueを作成すると見逃しを防げる",
    ],
    warnings: [
      "-auto-approve はCI専用。ローカルでは絶対に使わないこと",
    ],
  },
  {
    title: "定期的なドリフト検出",
    description:
      "手動変更によるドリフト（Terraformの定義と実際のインフラの差分）を定期的に検出し、通知するワークフロー。",
    fileHint: ".github/workflows/terraform-drift.yml",
    code: `# .github/workflows/terraform-drift.yml
name: Terraform Drift Detection

on:
  schedule:
    # 毎日朝9時（JST）に実行
    - cron: '0 0 * * *'
  workflow_dispatch:  # 手動実行も可能

permissions:
  contents: read
  issues: write
  id-token: write

jobs:
  drift-detection:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment:
          - prod/ap-northeast-1
          - prod/ap-northeast-3
    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.7.0"

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: \${{ secrets.AWS_ROLE_ARN }}
          aws-region: ap-northeast-1

      - name: Terraform Init
        working-directory: environments/\${{ matrix.environment }}
        run: terraform init -input=false

      - name: Detect Drift
        id: drift
        working-directory: environments/\${{ matrix.environment }}
        run: |
          # -detailed-exitcode: 0=変更なし, 1=エラー, 2=差分あり
          terraform plan -input=false -detailed-exitcode -no-color \\
            2>&1 | tee drift_output.txt
          echo "exitcode=$?" >> $GITHUB_OUTPUT
        continue-on-error: true

      - name: Create Issue if Drift Detected
        if: steps.drift.outputs.exitcode == '2'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const drift = fs.readFileSync(
              'environments/\${{ matrix.environment }}/drift_output.txt',
              'utf8'
            );
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '⚠️ Drift detected: \${{ matrix.environment }}',
              body: \`## ドリフト検出
            
            **環境:** \\\`\${{ matrix.environment }}\\\`
            **検出日時:** \${new Date().toISOString()}

            ### plan 出力
            \\\`\\\`\\\`
            \${drift.substring(0, 60000)}
            \\\`\\\`\\\`
            
            ### 対応方法
            1. 意図した変更なら \\\`terraform apply\\\` で適用
            2. 手動変更を元に戻すなら AWS コンソールで修正
            3. Terraform に取り込むなら \\\`terraform import\\\` を使用
            \`,
              labels: ['drift', 'infrastructure']
            });`,
    tips: [
      "-detailed-exitcode で差分の有無をexit codeで判定できる",
      "ドリフト＝誰かがコンソールから手動変更した可能性が高い",
      "定期検出でインフラの「実態とコードの乖離」を早期発見",
    ],
  },
];

// ---- PR Workflow ----
const prWorkflowSections: Section[] = [
  {
    title: "PRテンプレートの作成",
    description: "PRを作成する際のテンプレートを用意しておくと、レビューに必要な情報が漏れなく記載されます。",
    fileHint: ".github/pull_request_template.md",
    code: `<!-- .github/pull_request_template.md -->

## 変更概要
<!-- 何をなぜ変更するのか、簡潔に記述 -->

## 変更対象の環境
- [ ] dev
- [ ] staging
- [ ] prod/ap-northeast-1 (東京)
- [ ] prod/ap-northeast-3 (大阪)

## 変更の種類
- [ ] 新規リソースの追加
- [ ] 既存リソースの変更
- [ ] リソースの削除 ⚠️
- [ ] モジュールの追加/変更
- [ ] 変数/出力の変更

## terraform plan の結果
<!-- GitHub Actions の plan 結果を確認してください -->
- [ ] plan の結果を確認した
- [ ] 意図しない変更（特にdestroyやreplace）がないことを確認した

## チェックリスト
- [ ] \`terraform fmt\` を実行した
- [ ] \`terraform validate\` が通る
- [ ] 機密情報（パスワード、APIキー等）がコードに含まれていない
- [ ] example.tfvars を更新した（変数を追加/変更した場合）
- [ ] README.md を更新した（必要な場合）

## 影響範囲
<!-- ダウンタイムが発生するか、依存する他のリソースへの影響等 -->

## ロールバック手順
<!-- 問題が発生した場合のロールバック方法 -->`,
    tips: [
      "「リソースの削除」にはアラートマークを付けて注意を促す",
      "plan結果の確認を必須チェック項目にする",
      "ロールバック手順を書く習慣をつけると障害対応が速い",
    ],
  },
  {
    title: "PR運用の具体的な流れ",
    description: "ブランチ作成からマージまでの具体的な手順を示します。この流れに沿うことで安全にインフラ変更ができます。",
    code: `# ========================================
# 実践: 大阪リージョンを追加するPR
# ========================================

# 1. ブランチ作成
$ git checkout develop
$ git pull origin develop
$ git checkout -b feature/add-osaka-region

# 2. 変更を実装
$ mkdir -p environments/prod/ap-northeast-3
$ cat > environments/prod/ap-northeast-3/main.tf << 'EOF'
provider "aws" {
  region = "ap-northeast-3"
}
module "site" {
  source      = "../../../modules/static-site"
  bucket_name = "my-app-osaka-prod"
  environment = "prod-osaka"
}
EOF

# 3. ローカルで事前確認
$ cd environments/prod/ap-northeast-3
$ terraform init
$ terraform fmt -check
$ terraform validate
$ terraform plan     # ← ローカルでも確認しておく

# 4. コミット & プッシュ
$ git add .
$ git commit -m "feat: add Osaka region (ap-northeast-3) deployment

- Configure S3 + CloudFront for Osaka
- Use shared static-site module
- Backend state: s3://my-org-terraform-state/prod/ap-northeast-3/"

$ git push origin feature/add-osaka-region

# 5. PR作成
$ gh pr create --base develop \\
  --title "feat: 大阪リージョン追加" \\
  --fill

# ========================================
# ここからGitHub上での操作
# ========================================

# 6. GitHub Actions が自動で plan を実行
#    → PRのコメントに plan 結果が投稿される
#    → "Plan: 5 to add, 0 to change, 0 to destroy."

# 7. レビュアーが確認
#    - plan の結果を確認
#    - コードの品質を確認
#    - Approve

# 8. develop にマージ → dev環境に自動apply

# 9. dev で動作確認後、staging にPR → マージ

# 10. staging で動作確認後、main にPR → マージ
#     → 本番環境に自動apply！

# ========================================
# PRコメントでの plan 結果の例
# ========================================
# 📋 Terraform Plan: prod/ap-northeast-3
# 
# Terraform will perform the following actions:
#   + aws_s3_bucket.site
#   + aws_s3_bucket_website_configuration.site
#   + aws_s3_bucket_policy.site
#   + aws_cloudfront_origin_access_control.site
#   + aws_cloudfront_distribution.site
# 
# Plan: 5 to add, 0 to change, 0 to destroy.`,
    tips: [
      "ローカルで plan → PR → CI plan → レビュー → マージの流れが基本",
      "plan の差分が大きい場合はPRを分割する",
      "destroy が含まれるPRは特に慎重にレビュー",
    ],
  },
  {
    title: "pre-commit フックでローカルチェック",
    description: "コミット前に自動でフォーマットチェックやバリデーションを実行し、CIの失敗を事前に防ぎます。",
    fileHint: ".pre-commit-config.yaml",
    code: `# .pre-commit-config.yaml
repos:
  - repo: https://github.com/antonbabenko/pre-commit-terraform
    rev: v1.88.0
    hooks:
      # terraform fmt（自動フォーマット）
      - id: terraform_fmt

      # terraform validate（構文チェック）
      - id: terraform_validate

      # tflint（Linter）
      - id: terraform_tflint
        args:
          - --args=--config=__GIT_WORKING_DIR__/.tflint.hcl

      # tfsec（セキュリティスキャン）
      - id: terraform_tfsec

      # ドキュメント自動生成
      - id: terraform_docs
        args:
          - --args=--config=.terraform-docs.yml

  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-merge-conflict
      - id: detect-private-key       # 秘密鍵の混入を検出！

# ========================================
# セットアップ手順
# ========================================
# $ pip install pre-commit
# $ pre-commit install
# $ pre-commit run --all-files  # 初回は全ファイルチェック

# 以降、git commit するたびに自動実行
# $ git commit -m "feat: add new module"
# terraform_fmt..............................................Passed
# terraform_validate.........................................Passed
# terraform_tflint...........................................Passed
# terraform_tfsec............................................Passed
# detect-private-key.........................................Passed`,
    tips: [
      "pre-commit install で自動的にgit hookがセットアップされる",
      "detect-private-key で秘密鍵の混入を自動検出",
      "terraform_docs でREADMEのInputs/Outputsを自動生成",
      "チーム全員が pre-commit install することが重要",
    ],
  },
];

// ---- Secrets ----
const secretsSections: Section[] = [
  {
    title: "GitHub Secrets にAWSクレデンシャルを設定",
    description:
      "GitHub Actions から AWS にアクセスするための認証情報を安全に管理します。OIDC（推奨）またはアクセスキー方式が使えます。",
    fileHint: "GitHub リポジトリ Settings",
    code: `# ========================================
# 方法1: OIDC（推奨・最もセキュア）
# ========================================
# 長期的なアクセスキーが不要！一時的な認証情報を使う

# 1. AWSでOIDCプロバイダーを作成
resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]

  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1"
  ]
}

# 2. GitHub Actions 用のIAMロールを作成
resource "aws_iam_role" "github_actions" {
  name = "github-actions-terraform"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          # 特定のリポジトリからのみアクセス許可
          "token.actions.githubusercontent.com:sub" = "repo:your-org/my-terraform-project:*"
        }
      }
    }]
  })
}

# 3. 必要な権限をアタッチ
resource "aws_iam_role_policy_attachment" "terraform" {
  role       = aws_iam_role.github_actions.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
  # ★ 本番では最小権限の原則に基づいたカスタムポリシーを使う
}

# 4. GitHub Secrets に Role ARN を設定
# Repository Settings → Secrets → Actions → New repository secret
# Name:  AWS_ROLE_ARN
# Value: arn:aws:iam::123456789012:role/github-actions-terraform

# 5. Workflow での使い方
# - name: Configure AWS Credentials
#   uses: aws-actions/configure-aws-credentials@v4
#   with:
#     role-to-assume: \${{ secrets.AWS_ROLE_ARN }}
#     aws-region: ap-northeast-1

# ========================================
# 方法2: アクセスキー（簡単だが非推奨）
# ========================================
# GitHub Secrets に以下を設定:
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY
#
# ★ 長期クレデンシャルは漏洩リスクが高い
# ★ 可能な限り OIDC を使うこと`,
    tips: [
      "OIDC は長期的なアクセスキーが不要で最もセキュア",
      "リポジトリを限定する Condition が重要（他のリポジトリからのアクセスを防止）",
      "本番では AdministratorAccess ではなく最小権限のカスタムポリシーを使う",
    ],
    warnings: [
      "AWS_SECRET_ACCESS_KEY をコードにハードコードしない（絶対に！）",
    ],
  },
  {
    title: "GitHub Environments による承認ゲート",
    description:
      "GitHub Environments を使うと、本番デプロイ前に手動承認を必須にできます。誰がいつ承認したかの記録も残ります。",
    fileHint: "GitHub リポジトリ Settings → Environments",
    code: `# ========================================
# GitHub Environments の設定
# ========================================

# 1. Repository Settings → Environments → New environment

# Environment: "production"
#   ├── Required reviewers: @infra-lead, @cto
#   ├── Wait timer: 5 minutes（冷却期間）
#   ├── Deployment branches: main only
#   └── Environment secrets:
#       └── AWS_ROLE_ARN: arn:aws:iam::...:role/prod-terraform

# Environment: "staging"
#   ├── Required reviewers: @infra-team
#   ├── Deployment branches: staging, main
#   └── Environment secrets:
#       └── AWS_ROLE_ARN: arn:aws:iam::...:role/staging-terraform

# Environment: "development"
#   ├── Required reviewers: なし（自動）
#   ├── Deployment branches: develop, staging, main
#   └── Environment secrets:
#       └── AWS_ROLE_ARN: arn:aws:iam::...:role/dev-terraform

# ========================================
# Workflow での使い方
# ========================================
jobs:
  deploy-prod:
    runs-on: ubuntu-latest
    environment: production  # ← これで承認が必須になる
    steps:
      - uses: actions/checkout@v4
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          # Environment secrets から取得される
          role-to-assume: \${{ secrets.AWS_ROLE_ARN }}
          aws-region: ap-northeast-1
      - name: Terraform Apply
        run: |
          cd environments/prod/ap-northeast-1
          terraform init -input=false
          terraform apply -input=false -auto-approve

# ========================================
# 承認フロー
# ========================================
# 1. ワークフローが「Waiting for review」状態になる
# 2. 指定されたレビュアーにメール通知が届く
# 3. レビュアーがGitHub UIで「Approve」をクリック
# 4. Wait timer（5分）が経過
# 5. terraform apply が実行される`,
    tips: [
      "環境ごとに異なるAWSロール（権限）を使い分けられる",
      "Wait timer で「承認後すぐに取り消す」余地を残せる",
      "承認履歴が記録されるため、監査対応にも有用",
    ],
  },
  {
    title: "機密変数の安全な管理方法",
    description: "データベースのパスワードやAPIキーなど、Terraform変数の中で機密性の高い値を安全に管理する方法。",
    code: `# ========================================
# 方法1: GitHub Secrets → 環境変数 → tfvars
# ========================================

# GitHub Actionsのワークフロー内で
- name: Create tfvars from secrets
  run: |
    cat > environments/prod/ap-northeast-1/secret.auto.tfvars << EOF
    db_password = "\${{ secrets.DB_PASSWORD }}"
    api_key     = "\${{ secrets.API_KEY }}"
    EOF

# ========================================
# 方法2: AWS Secrets Manager（推奨）
# ========================================

# Terraformでシークレットを参照
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "myapp/prod/db-password"
}

resource "aws_db_instance" "main" {
  engine   = "mysql"
  username = "admin"
  password = data.aws_secretsmanager_secret_version.db_password.secret_string
}

# ========================================
# 方法3: AWS SSM Parameter Store
# ========================================

data "aws_ssm_parameter" "db_password" {
  name            = "/myapp/prod/db-password"
  with_decryption = true
}

# ========================================
# sensitive フラグで plan 出力を隠す
# ========================================
variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true  # ← plan/apply の出力で *** と表示される
}

output "db_endpoint" {
  value     = aws_db_instance.main.endpoint
  sensitive = false
}

output "db_password" {
  value     = aws_db_instance.main.password
  sensitive = true   # ← 出力値も隠す
}`,
    tips: [
      "sensitive = true で plan 出力の機密情報をマスク",
      "AWS Secrets Manager / SSM Parameter Store を使えばTerraformに直接パスワードを渡さずに済む",
      "auto.tfvars は自動で読み込まれるため、CIで動的生成するのに便利",
    ],
    warnings: [
      "sensitive = true でもStateファイル内には平文で記録される → Stateの暗号化が重要",
    ],
  },
];

// ---- Team ----
const teamSections: Section[] = [
  {
    title: "チーム開発のルール設定",
    description: "複数人で Terraform を運用する際に決めておくべきルールをまとめます。",
    code: `# ========================================
# チーム開発ルール（CONTRIBUTING.md に記載）
# ========================================

## ブランチルール
- main への直接 push は禁止
- PR には最低 1 名の Approve が必要
- prod 環境の変更には infra-lead の Approve が必要

## コミットルール
- Conventional Commits 形式を使う
  feat: 新機能/新リソース
  fix:  バグ修正/設定修正
  refactor: リファクタリング
  docs: ドキュメント
  ci:   CI/CD設定変更

## コーディングルール
- terraform fmt を必ず実行（pre-commit で自動化）
- 変数には description を必ず書く
- リソースには Name タグを必ず付ける
- ハードコードを避け、変数/locals を使う
- モジュールの変更は別PRにする

## レビューのチェックポイント
- [ ] plan の結果を確認したか
- [ ] destroy/replace されるリソースはないか
- [ ] 意図しないリージョンに作成されていないか
- [ ] セキュリティグループが 0.0.0.0/0 で開いていないか
- [ ] 機密情報がハードコードされていないか
- [ ] 命名規則に従っているか
- [ ] example.tfvars が更新されているか`,
    tips: [
      "最初にルールを明文化しておくと後から揉めない",
      "ルールを厳しくしすぎると開発速度が落ちるのでバランスが重要",
      "新メンバーが入った時のオンボーディング資料にもなる",
    ],
  },
  {
    title: "State ロックとチーム運用",
    description: "複数人が同時に terraform apply すると State が破損する可能性があります。ロックの仕組みと運用方法を解説。",
    code: `# ========================================
# State ロックの仕組み
# ========================================

# terraform plan/apply 実行時に自動でロックを取得
$ terraform apply
# Acquiring state lock. This may take a few moments...
# → DynamoDB に LockID が書き込まれる

# 別の人が同時に実行しようとすると...
$ terraform apply
# Error: Error acquiring the state lock
#
# Lock Info:
#   ID:        12345678-abcd-1234-abcd-1234567890ab
#   Path:      my-org-terraform-state/prod/ap-northeast-1/terraform.tfstate
#   Operation: OperationTypeApply
#   Who:       tanaka@macbook-pro
#   Version:   1.7.0
#   Created:   2024-01-15 10:30:00.000000 +0000 UTC

# → ロックが解放されるまで待つ必要がある

# ========================================
# ロックが残ってしまった場合（異常終了時等）
# ========================================

# 手動でロック解除（Lock ID を指定）
$ terraform force-unlock 12345678-abcd-1234-abcd-1234567890ab
# Do you really want to force-unlock?
# → yes

# ★ force-unlock は最終手段！
# ★ まず誰かが本当に実行中でないか確認すること

# ========================================
# チーム運用のベストプラクティス
# ========================================

# 1. ローカルでの apply を禁止し、CI/CD経由のみにする
# 2. Slack等で「今からapplyします」と宣言する
# 3. CI/CDのconcurrencyで同時実行を防止

# GitHub Actions での設定
concurrency:
  group: "terraform-\${{ matrix.environment }}"
  cancel-in-progress: false  # 実行中のものはキャンセルしない`,
    tips: [
      "DynamoDB + S3 バックエンドなら自動でロック管理される",
      "CI/CD 経由のみに限定するのが最も安全な運用",
      "force-unlock は必ずチームに報告してから実行",
    ],
  },
  {
    title: "Terraform Cloud / Spacelift 連携",
    description: "より高度なチーム管理には、Terraform CloudやSpaceliftなどのプラットフォームを使う方法もあります。",
    code: `# ========================================
# Terraform Cloud（HashiCorp公式）
# ========================================

# 1. terraform ブロックで Cloud 連携を設定
terraform {
  cloud {
    organization = "my-org"
    workspaces {
      name = "my-app-prod-tokyo"
    }
  }
}

# 2. terraform login でCLI認証
$ terraform login
# → ブラウザが開いてトークンを取得

# 3. あとは普通に使える
$ terraform init
$ terraform plan
$ terraform apply
# → 実行はTerraform Cloud上で行われる

# ========================================
# Terraform Cloud の利点
# ========================================
# ✅ State管理 + ロック + 暗号化が自動
# ✅ Web UIで plan/apply の確認・承認
# ✅ VCS（GitHub）連携でPR時に自動plan
# ✅ コスト見積もり機能（Sentinel）
# ✅ 5ユーザー/500リソースまで無料
# ✅ チームメンバーの権限管理

# ========================================
# GitHub連携の設定（Terraform Cloud UI）
# ========================================
# 1. Settings → VCS Providers → GitHub を接続
# 2. Workspace → VCS Settings → リポジトリを選択
# 3. PR作成時に自動で Speculative Plan が実行
# 4. main マージ時に自動で Apply（承認付き可）

# ========================================
# 料金
# ========================================
# Free:  5ユーザー、500リソース
# Team:  $20/ユーザー/月
# Business: カスタム

# → 小規模チームなら Free で十分始められる！`,
    tips: [
      "Terraform Cloud Free プランは小規模チームに最適",
      "GitHub連携でPR時のplan結果が自動でPRに投稿される",
      "State Explorer で過去のStateを比較できるのが便利",
      "代替ツール: Spacelift, Env0, Atlantis（OSS）",
    ],
  },
];

// ---- Shared UI ----
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1.5 rounded hover:bg-white/10 transition-colors"
      title="コピー"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
    </button>
  );
}

function SectionList({ sections, color }: { sections: Section[]; color: string }) {
  const [expanded, setExpanded] = useState<number | null>(0);
  return (
    <div className="space-y-4">
      {sections.map((section, i) => {
        const isOpen = expanded === i;
        return (
          <div key={section.title} className="bg-card border border-border rounded-xl overflow-hidden">
            <button className="w-full flex items-center gap-4 p-5 text-left" onClick={() => setExpanded(isOpen ? null : i)}>
              <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center shrink-0`}>
                <span className="text-white text-[14px]">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[15px]">{section.title}</p>
                  {section.fileHint && (
                    <code className="text-[11px] bg-muted px-2 py-0.5 rounded text-purple-600">{section.fileHint}</code>
                  )}
                </div>
                <p className="text-[13px] text-muted-foreground">{section.description}</p>
              </div>
              {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />}
            </button>
            {isOpen && (
              <div className="px-5 pb-5 space-y-4">
                <div className="relative">
                  <div className="absolute top-2 right-2 z-10"><CopyButton text={section.code} /></div>
                  <pre className="bg-[#1e1e2e] text-[#cdd6f4] text-[13px] p-4 rounded-lg overflow-x-auto"><code>{section.code}</code></pre>
                  <div className="flex justify-end mt-2">
                    <DownloadCodeButton
                      code={section.code}
                      filename={`${section.title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}.tf`}
                    />
                  </div>
                </div>
                {section.tips && section.tips.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-[13px] text-blue-700 mb-2">Tips</p>
                    <ul className="space-y-1.5">
                      {section.tips.map((tip) => (
                        <li key={tip} className="text-[13px] text-blue-800 flex items-start gap-2">
                          <span className="text-blue-500 mt-0.5">*</span> {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {section.warnings && section.warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <p className="text-[13px] text-amber-700">注意</p>
                    </div>
                    {section.warnings.map((w) => (
                      <p key={w} className="text-[13px] text-amber-800 ml-6">{w}</p>
                    ))}
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

const sectionMap: Record<Tab, Section[]> = {
  setup: setupSections,
  branching: branchingSections,
  "github-actions": githubActionsSections,
  "pr-workflow": prWorkflowSections,
  secrets: secretsSections,
  team: teamSections,
};

export function GitWorkflow() {
  const [activeTab, setActiveTab] = useState<Tab>("setup");

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1>Git / GitHub ワークフロー</h1>
        <p className="text-muted-foreground mt-1">
          Git管理・ブランチ戦略・GitHub Actions CI/CD・チーム開発のベストプラクティス
        </p>
      </div>

      {/* Flow overview */}
      <div className="bg-gradient-to-r from-gray-50 to-purple-50 border border-gray-200 rounded-xl p-6">
        <p className="text-[14px] mb-4">全体の流れ</p>
        <div className="flex items-center gap-1.5 flex-wrap text-[12px]">
          {[
            { label: "git checkout -b", color: "bg-gray-600" },
            { label: "コード変更", color: "bg-purple-600" },
            { label: "git commit", color: "bg-gray-600" },
            { label: "git push", color: "bg-gray-600" },
            { label: "PR作成", color: "bg-blue-600" },
            { label: "自動 plan", color: "bg-blue-600" },
            { label: "レビュー", color: "bg-green-600" },
            { label: "マージ", color: "bg-green-600" },
            { label: "自動 apply", color: "bg-orange-500" },
          ].map((item, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-gray-400">→</span>}
              <span className={`${item.color} text-white px-2 py-1 rounded`}>{item.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-[14px] transition-all ${
              activeTab === tab.id
                ? `${tab.color} text-white border-transparent`
                : "bg-card border-border text-muted-foreground hover:border-purple-300"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <SectionList sections={sectionMap[activeTab]} color={tabs.find((t) => t.id === activeTab)!.color} />
    </div>
  );
}
