import { useState } from "react";
import { Search, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";

interface Command {
  name: string;
  description: string;
  usage: string;
  flags?: { flag: string; desc: string }[];
  category: string;
  examples?: { cmd: string; desc: string }[];
  tips?: string[];
}

const commands: Command[] = [
  {
    name: "terraform init",
    description: "作業ディレクトリを初期化し、プロバイダーやモジュールをダウンロード。新しいプロジェクトやクローン後に最初に実行するコマンド。",
    usage: "terraform init [options]",
    flags: [
      { flag: "-backend-config=PATH", desc: "バックエンド設定ファイルを指定" },
      { flag: "-upgrade", desc: "プロバイダー・モジュールを最新版に更新" },
      { flag: "-reconfigure", desc: "バックエンドを再設定（既存設定を無視）" },
      { flag: "-migrate-state", desc: "バックエンド変更時にStateを移行" },
      { flag: "-input=false", desc: "対話的な入力を無効化（CI向け）" },
    ],
    category: "基本",
    examples: [
      { cmd: "terraform init", desc: "標準の初期化" },
      { cmd: "terraform init -upgrade", desc: "プロバイダーを最新版に更新" },
      { cmd: 'terraform init -backend-config="prod.hcl"', desc: "環境別バックエンド設定で初期化" },
    ],
  },
  {
    name: "terraform plan",
    description: "実行計画を作成し、apply前に変更内容をプレビュー。作成(+)・変更(~)・削除(-)されるリソースが表示される。",
    usage: "terraform plan [options]",
    flags: [
      { flag: "-out=FILE", desc: "計画をファイルに保存（applyで使用）" },
      { flag: "-var='key=value'", desc: "変数を指定" },
      { flag: "-var-file=FILE", desc: "変数ファイルを指定" },
      { flag: "-destroy", desc: "削除計画を表示" },
      { flag: "-target=RESOURCE", desc: "特定リソースのみ対象" },
      { flag: "-refresh-only", desc: "Stateのリフレッシュのみ実行" },
    ],
    category: "基本",
    examples: [
      { cmd: "terraform plan -out=tfplan", desc: "計画を保存" },
      { cmd: 'terraform plan -var="instance_type=t3.large"', desc: "変数を指定して計画" },
      { cmd: "terraform plan -target=aws_instance.web", desc: "特定リソースのみ計画" },
    ],
  },
  {
    name: "terraform apply",
    description: "計画に基づいてインフラを作成・変更。確認プロンプトが表示され、yesで実行。plan保存ファイルを指定すると確認なしで実行。",
    usage: "terraform apply [plan_file] [options]",
    flags: [
      { flag: "-auto-approve", desc: "確認プロンプトをスキップ" },
      { flag: "-var='key=value'", desc: "変数を指定" },
      { flag: "-target=RESOURCE", desc: "特定リソースのみ適用" },
      { flag: "-parallelism=N", desc: "並列実行数（デフォルト: 10）" },
      { flag: "-replace=RESOURCE", desc: "リソースを強制的に再作成" },
    ],
    category: "基本",
    examples: [
      { cmd: "terraform apply tfplan", desc: "保存した計画を適用" },
      { cmd: "terraform apply -auto-approve", desc: "確認なしで適用（CI向け）" },
      { cmd: "terraform apply -replace=aws_instance.web", desc: "特定リソースを再作成" },
    ],
  },
  {
    name: "terraform destroy",
    description: "管理しているリソースをすべて削除。開発・テスト環境のクリーンアップに使用。本番環境では十分注意が必要。",
    usage: "terraform destroy [options]",
    flags: [
      { flag: "-auto-approve", desc: "確認プロンプトをスキップ" },
      { flag: "-target=RESOURCE", desc: "特定リソースのみ削除" },
      { flag: "-var='key=value'", desc: "変数を指定" },
    ],
    category: "基本",
    examples: [
      { cmd: "terraform destroy", desc: "すべてのリソースを削除" },
      { cmd: "terraform destroy -target=aws_instance.web", desc: "特定リソースのみ削除" },
    ],
    tips: ["plan -destroy で事前に削除対象を確認するのが安全"],
  },
  {
    name: "terraform fmt",
    description: "設定ファイルを標準フォーマット（HCL標準スタイル）に整形。インデントやアライメントが統一される。",
    usage: "terraform fmt [options] [dir]",
    flags: [
      { flag: "-recursive", desc: "サブディレクトリも再帰的に整形" },
      { flag: "-check", desc: "整形が必要なファイルがあればエラー終了（CI向け）" },
      { flag: "-diff", desc: "変更差分を表示" },
      { flag: "-write=false", desc: "ファイルを変更せず結果を出力" },
    ],
    category: "ユーティリティ",
    examples: [
      { cmd: "terraform fmt -recursive", desc: "全ディレクトリを再帰的に整形" },
      { cmd: "terraform fmt -check", desc: "CIでフォーマットチェック" },
    ],
  },
  {
    name: "terraform validate",
    description: "設定ファイルの構文やリソース定義の妥当性を検証。プロバイダーAPIへのアクセスは不要。",
    usage: "terraform validate [options]",
    flags: [
      { flag: "-json", desc: "JSON形式で結果を出力" },
      { flag: "-no-color", desc: "出力の色付けを無効化" },
    ],
    category: "ユーティリティ",
    examples: [{ cmd: "terraform validate", desc: "構文チェック" }],
    tips: ["init後に実行する必要がある", "実際のリソース状態は確認しない（純粋な構文チェック）"],
  },
  {
    name: "terraform output",
    description: "出力値を表示。apply後にリソースのIPアドレスやURLなどを確認する際に使用。",
    usage: "terraform output [options] [name]",
    flags: [
      { flag: "-json", desc: "JSON形式で出力" },
      { flag: "-raw", desc: "値のみを出力（スクリプト連携向け）" },
      { flag: "-no-color", desc: "色付けを無効化" },
    ],
    category: "State",
    examples: [
      { cmd: "terraform output", desc: "すべての出力値を表示" },
      { cmd: "terraform output -raw instance_ip", desc: "特定の出力値を表示" },
      { cmd: "terraform output -json", desc: "JSON形式で全出力" },
    ],
  },
  {
    name: "terraform state list",
    description: "Stateに記録されているリソースの一覧を表示。管理下のリソースを確認する際に使用。",
    usage: "terraform state list [options] [pattern]",
    flags: [{ flag: "-id=ID", desc: "特定IDのリソースをフィルタ" }],
    category: "State",
    examples: [
      { cmd: "terraform state list", desc: "全リソース一覧" },
      { cmd: "terraform state list aws_instance.*", desc: "EC2インスタンスのみ表示" },
    ],
  },
  {
    name: "terraform state show",
    description: "特定リソースの詳細な属性情報を表示。IPアドレス、ARN、IDなどの値を確認可能。",
    usage: "terraform state show [options] ADDRESS",
    flags: [{ flag: "-json", desc: "JSON形式で出力" }],
    category: "State",
    examples: [{ cmd: "terraform state show aws_instance.web", desc: "EC2インスタンスの詳細表示" }],
  },
  {
    name: "terraform state mv",
    description: "Stateファイル内でリソースの名前変更や移動。リファクタリング時にリソースの再作成を避けるために使用。",
    usage: "terraform state mv [options] SOURCE DESTINATION",
    flags: [
      { flag: "-dry-run", desc: "実際に移動せずプレビュー" },
      { flag: "-state-out=PATH", desc: "移動先のStateファイルを指定" },
    ],
    category: "State",
    examples: [
      { cmd: "terraform state mv aws_instance.old aws_instance.new", desc: "リソース名の変更" },
      { cmd: 'terraform state mv module.old module.new', desc: "モジュール名の変更" },
    ],
    tips: ["moved ブロックを使った宣言的な方法（v1.1+）も推奨"],
  },
  {
    name: "terraform import",
    description: "既存のインフラリソースをTerraform管理下に取り込む。手動で作成したリソースをコード管理に移行する際に使用。",
    usage: "terraform import [options] ADDRESS ID",
    flags: [
      { flag: "-var='key=value'", desc: "変数を指定" },
      { flag: "-input=false", desc: "対話的入力を無効化" },
    ],
    category: "State",
    examples: [
      { cmd: "terraform import aws_instance.web i-1234567890abcdef0", desc: "EC2インスタンスをインポート" },
      { cmd: "terraform import aws_s3_bucket.data my-bucket-name", desc: "S3バケットをインポート" },
    ],
    tips: ["import後にtfファイルにリソース定義を手動で書く必要がある", "v1.5+では import ブロックで宣言的にインポート可能"],
  },
  {
    name: "terraform workspace",
    description: "ワークスペースの管理。同一設定で複数の環境（dev/staging/prod）を管理する際に使用。",
    usage: "terraform workspace <subcommand>",
    flags: [],
    category: "ワークスペース",
    examples: [
      { cmd: "terraform workspace list", desc: "ワークスペース一覧" },
      { cmd: "terraform workspace new dev", desc: "新規ワークスペース作成" },
      { cmd: "terraform workspace select prod", desc: "ワークスペース切り替え" },
      { cmd: "terraform workspace delete staging", desc: "ワークスペース削除" },
    ],
  },
  {
    name: "terraform console",
    description: "対話的なコンソールを起動。式の評価や関数のテスト、変数の確認に便利。",
    usage: "terraform console [options]",
    flags: [{ flag: "-var='key=value'", desc: "変数を指定" }],
    category: "ユーティリティ",
    examples: [
      { cmd: "terraform console", desc: "コンソールを起動" },
      { cmd: '> upper("hello")', desc: '関数テスト → "HELLO"' },
      { cmd: "> var.instance_type", desc: "変数の値を確認" },
    ],
  },
  {
    name: "terraform graph",
    description: "リソースの依存関係グラフをDOT形式で出力。Graphvizで可視化可能。",
    usage: "terraform graph [options]",
    flags: [
      { flag: "-type=plan", desc: "グラフの種類を指定（plan/apply/destroy）" },
      { flag: "-draw-cycles", desc: "循環依存を強調表示" },
    ],
    category: "ユーティリティ",
    examples: [
      { cmd: "terraform graph | dot -Tpng > graph.png", desc: "依存関係を画像で出力" },
      { cmd: "terraform graph -type=destroy", desc: "削除順序のグラフを出力" },
    ],
  },
  {
    name: "terraform taint / untaint",
    description: "リソースを「汚染」マークし、次回applyで再作成を強制。v0.15.2+では -replace オプションが推奨。",
    usage: "terraform taint ADDRESS",
    flags: [],
    category: "State",
    examples: [
      { cmd: "terraform taint aws_instance.web", desc: "リソースをtaint（非推奨）" },
      { cmd: "terraform apply -replace=aws_instance.web", desc: "推奨: -replaceオプション" },
    ],
    tips: ["-replace の方が安全（planで確認できる）"],
  },
];

export function Commands() {
  const [search, setSearch] = useState("");
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState("すべて");
  const [expandedCmd, setExpandedCmd] = useState<string | null>(null);

  const categories = ["すべて", ...Array.from(new Set(commands.map((c) => c.category)))];

  const filtered = commands.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.includes(search);
    const matchCat = filterCat === "すべて" || c.category === filterCat;
    return matchSearch && matchCat;
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1>コマンドリファレンス</h1>
        <p className="text-muted-foreground mt-1">
          よく使うTerraformコマンドの一覧（{commands.length}コマンド）
        </p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="コマンドを検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-input-background border border-border rounded-lg text-[14px]"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`px-3 py-2 rounded-lg text-[13px] border transition-colors ${
                filterCat === cat
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-card border-border text-muted-foreground hover:border-purple-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Command list */}
      <div className="space-y-4">
        {filtered.map((cmd) => {
          const isOpen = expandedCmd === cmd.name;
          return (
            <div
              key={cmd.name}
              className="bg-card border border-border rounded-xl overflow-hidden"
            >
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-[15px] text-purple-600">{cmd.name}</code>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {cmd.category}
                      </span>
                    </div>
                    <p className="text-[14px] text-muted-foreground mt-1">{cmd.description}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(cmd.name)}
                    className="p-2 rounded-lg hover:bg-muted transition-colors shrink-0"
                    title="コピー"
                  >
                    {copiedCmd === cmd.name ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <div className="bg-[#1e1e2e] text-[#cdd6f4] text-[13px] px-4 py-2.5 rounded-lg">
                  <code>$ {cmd.usage}</code>
                </div>
                <button
                  onClick={() => setExpandedCmd(isOpen ? null : cmd.name)}
                  className="flex items-center gap-1 text-[13px] text-purple-600 hover:text-purple-700"
                >
                  {isOpen ? "詳細を閉じる" : "詳細を表示"}
                  {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {isOpen && (
                <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                  {/* Flags */}
                  {cmd.flags && cmd.flags.length > 0 && (
                    <div>
                      <p className="text-[13px] text-muted-foreground mb-2">オプション</p>
                      <div className="space-y-1.5">
                        {cmd.flags.map((f) => (
                          <div key={f.flag} className="flex items-start gap-3 text-[13px]">
                            <code className="bg-muted px-2 py-0.5 rounded text-purple-600 shrink-0 min-w-[180px]">
                              {f.flag}
                            </code>
                            <span className="text-muted-foreground">{f.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Examples */}
                  {cmd.examples && cmd.examples.length > 0 && (
                    <div>
                      <p className="text-[13px] text-muted-foreground mb-2">使用例</p>
                      <div className="space-y-2">
                        {cmd.examples.map((ex) => (
                          <div key={ex.cmd} className="flex items-start gap-2">
                            <div className="flex-1 bg-[#1e1e2e] text-[#cdd6f4] text-[12px] px-3 py-2 rounded-lg">
                              <code>$ {ex.cmd}</code>
                            </div>
                            <span className="text-[12px] text-muted-foreground shrink-0 mt-1.5">
                              {ex.desc}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tips */}
                  {cmd.tips && cmd.tips.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-[12px] text-amber-700 mb-1">Tips</p>
                      {cmd.tips.map((tip) => (
                        <p key={tip} className="text-[12px] text-amber-800">
                          {tip}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            該当するコマンドが見つかりません
          </p>
        )}
      </div>
    </div>
  );
}
