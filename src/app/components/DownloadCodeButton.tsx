import { Download } from "lucide-react";

interface DownloadCodeButtonProps {
  code: string;
  filename: string;
  label?: string;
}

export function DownloadCodeButton({
  code,
  filename,
  label = "サンプルをダウンロード",
}: DownloadCodeButtonProps) {
  const handleDownload = () => {
    const cleanedCode = code
      .split("\n")
      .filter((line) => !line.startsWith("#") || line.startsWith("#!"))
      .join("\n")
      .trim();

    const content = cleanedCode.length > 0 ? cleanedCode : code;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] text-muted-foreground hover:bg-purple-50 hover:text-purple-600 hover:border-purple-300 transition-colors"
    >
      <Download className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

export function downloadAllAsZip(
  files: { filename: string; content: string }[],
  zipName: string
) {
  // Download individual files in a folder-like structure
  files.forEach((file, i) => {
    setTimeout(() => {
      const blob = new Blob([file.content], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, i * 200);
  });
}
