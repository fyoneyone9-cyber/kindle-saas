"use client";

import { useState, useCallback } from "react";

interface GenerateResult {
  success: boolean;
  title: string;
  manuscript: string;
  preview: string;
  docxBase64: string;
  kdpMetadata: Record<string, unknown>;
  charCount: number;
}

const DAILY_LIMIT = 3;
const STORAGE_KEY = "kindle_saas_usage";

function getUsageData(): { date: string; count: number } {
  if (typeof window === "undefined") return { date: "", count: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: "", count: 0 };
    return JSON.parse(raw);
  } catch {
    return { date: "", count: 0 };
  }
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getRemainingCount(): number {
  const data = getUsageData();
  const today = getTodayStr();
  if (data.date !== today) return DAILY_LIMIT;
  return Math.max(0, DAILY_LIMIT - data.count);
}

function incrementUsage(): void {
  const today = getTodayStr();
  const data = getUsageData();
  if (data.date !== today) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count: 1 }));
  } else {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date: today, count: data.count + 1 })
    );
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64);
  const byteNumbers = Array.from({ length: byteChars.length }, (_, i) =>
    byteChars.charCodeAt(i)
  );
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export default function Home() {
  const [theme, setTheme] = useState("");
  const [genre, setGenre] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [remaining, setRemaining] = useState<number>(() => getRemainingCount());
  const [step, setStep] = useState<string>("");

  const handleGenerate = useCallback(async () => {
    if (loading) return;

    const currentRemaining = getRemainingCount();
    if (currentRemaining <= 0) {
      setError(
        "本日の生成回数制限（3回）に達しました。明日また生成できます。"
      );
      return;
    }

    if (!theme.trim()) {
      setError("テーマを入力してください。");
      return;
    }
    if (!genre.trim()) {
      setError("ジャンルを入力してください。");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setStep("AIが原稿を生成中...");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: theme.trim(), genre: genre.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "生成に失敗しました。");
      }

      incrementUsage();
      setRemaining(getRemainingCount());
      setResult(data);
      setStep("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "不明なエラーが発生しました。";
      setError(msg);
      setStep("");
    } finally {
      setLoading(false);
    }
  }, [theme, genre, loading]);

  const handleDownloadDocx = useCallback(() => {
    if (!result) return;
    const blob = base64ToBlob(
      result.docxBase64,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.title}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  const handleDownloadKdp = useCallback(() => {
    if (!result) return;
    const json = JSON.stringify(result.kdpMetadata, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.title}_KDP入稿情報.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-emerald-500 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📚</span>
            <div>
              <h1 className="text-2xl font-bold">Kindle本ファクトリー</h1>
              <p className="text-emerald-100 text-sm mt-1">
                by NextraLabs — AIが5分でKindle本原稿を自動生成
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 使用制限バッジ */}
        <div className="flex justify-end mb-4">
          <span
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
              remaining > 0
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            <span>⚡</span>
            本日の残り生成回数: {remaining} / {DAILY_LIMIT}
          </span>
        </div>

        {/* 入力フォーム */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            📝 本の設定
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                テーマ
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="例: 副業で月10万円を稼ぐ方法、ChatGPTで業務効率化"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-800 placeholder-gray-400"
                disabled={loading}
                maxLength={200}
              />
              <p className="text-xs text-gray-500 mt-1">
                {theme.length}/200文字
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ジャンル
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {[
                  "副業・収入アップ",
                  "AI活用",
                  "家計管理・節約",
                  "自己啓発",
                  "ビジネス",
                  "健康・美容",
                  "育児・教育",
                  "投資・資産運用",
                ].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenre(g)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      genre === g
                        ? "bg-emerald-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700"
                    }`}
                    disabled={loading}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="または直接入力してください"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-800 placeholder-gray-400"
                disabled={loading}
                maxLength={100}
              />
            </div>
          </div>

          {/* エラーメッセージ */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <span className="text-red-500 text-lg">⚠️</span>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* 生成ボタン */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || remaining <= 0}
            className={`mt-6 w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-200 ${
              loading || remaining <= 0
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 shadow-md hover:shadow-lg"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <svg
                  className="animate-spin h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {step || "生成中..."}
              </span>
            ) : remaining <= 0 ? (
              "本日の利用制限に達しました"
            ) : (
              "🚀 AIで原稿を生成する"
            )}
          </button>

          <p className="text-xs text-gray-500 text-center mt-3">
            ※ 生成には30〜60秒かかります。しばらくお待ちください。
          </p>
        </div>

        {/* 生成結果 */}
        {result && (
          <div className="space-y-4">
            {/* 成功バナー */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">✅</span>
                <h2 className="text-lg font-bold text-emerald-800">
                  原稿の生成が完了しました！
                </h2>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-emerald-700">
                <span>📖 タイトル: {result.title}</span>
                <span>
                  📊 文字数: {result.charCount.toLocaleString()}字
                </span>
              </div>
            </div>

            {/* ダウンロードボタン */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-base font-bold text-gray-800 mb-4">
                📥 ダウンロード
              </h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleDownloadDocx}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white py-3 px-6 rounded-xl font-medium hover:bg-emerald-600 transition-colors shadow-sm"
                >
                  <span>📄</span>
                  DOCX原稿ダウンロード
                </button>
                <button
                  type="button"
                  onClick={handleDownloadKdp}
                  className="flex-1 flex items-center justify-center gap-2 bg-white text-emerald-700 border-2 border-emerald-500 py-3 px-6 rounded-xl font-medium hover:bg-emerald-50 transition-colors"
                >
                  <span>📋</span>
                  KDP入稿チートシート
                </button>
              </div>
            </div>

            {/* プレビュー */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-base font-bold text-gray-800 mb-3">
                👁️ 原稿プレビュー（最初の1000字）
              </h3>
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-mono max-h-64 overflow-y-auto border border-gray-200">
                {result.preview}
                {result.charCount > 1000 && (
                  <span className="text-gray-400">
                    {"\n\n"}... （続きはDOCXファイルでご確認ください）
                  </span>
                )}
              </div>
            </div>

            {/* KDPメタデータプレビュー */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-base font-bold text-gray-800 mb-3">
                📑 KDP入稿情報プレビュー
              </h3>
              <div className="bg-gray-50 rounded-xl p-4 max-h-64 overflow-y-auto border border-gray-200">
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(result.kdpMetadata).map(([key, value]) => (
                      <tr
                        key={key}
                        className="border-b border-gray-200 last:border-0"
                      >
                        <td className="py-2 pr-4 font-medium text-gray-600 whitespace-nowrap w-40">
                          {key}
                        </td>
                        <td className="py-2 text-gray-800">
                          {String(value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 次のステップ */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <h3 className="font-bold text-amber-800 mb-3">
                📌 次のステップ
              </h3>
              <ol className="space-y-2 text-sm text-amber-800">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-amber-600 min-w-[24px]">1.</span>
                  DOCXファイルをWordまたはGoogleドキュメントで開き、内容を確認・加筆修正
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-amber-600 min-w-[24px]">2.</span>
                  Canva等でカバー画像を作成（推奨: 2560×1600px）
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-amber-600 min-w-[24px]">3.</span>
                  KDP入稿チートシートを参考にKDPダッシュボードで登録
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-amber-600 min-w-[24px]">4.</span>
                  審査後（24〜72時間）に販売開始！
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* フッター */}
        <footer className="mt-12 text-center text-xs text-gray-400 pb-8">
          <p>Kindle本ファクトリー by NextraLabs</p>
          <p className="mt-1">
            本ツールで生成した原稿の著作権はご利用者様に帰属します。
          </p>
        </footer>
      </div>
    </main>
  );
}
