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

const GENRES = [
  "副業・収入アップ", "AI活用", "家計管理・節約", "自己啓発",
  "ビジネス", "健康・美容", "育児・教育", "投資・資産運用",
];

const ALL_GENRES = [
  ...GENRES,
  "料理・レシピ", "旅行・体験記", "転職・キャリア", "英語学習",
];

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
      setError("本日の生成回数制限（3回）に達しました。明日また生成できます。");
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
      const serverRemaining = typeof data.remaining === "number" ? data.remaining : getRemainingCount();
      setRemaining(Math.min(getRemainingCount(), serverRemaining));
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
    <main className="min-h-screen" style={{ background: "var(--bg-base)" }}>

      {/* ヘッダー */}
      <header style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ background: "var(--emerald)" }}
            >
              K
            </div>
            <div>
              <span
                className="text-base font-semibold"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--text-primary)" }}
              >
                Kindle本ファクトリー
              </span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(16,185,129,0.15)", color: "var(--emerald-light)" }}>
                by NextraLabs
              </span>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              remaining > 0 ? "" : ""
            }`}
            style={{
              background: remaining > 0 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
              color: remaining > 0 ? "var(--emerald-light)" : "#f87171",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full badge-pulse"
              style={{ background: remaining > 0 ? "var(--emerald)" : "#ef4444", display: "inline-block" }}
            />
            残り {remaining} / {DAILY_LIMIT} 回
          </span>
          <a
            href="https://membership-site-nextralabos.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium hidden sm:inline-flex items-center gap-1"
            style={{
              color: "#10b981",
              textDecoration: "none",
              border: "1px solid rgba(16,185,129,0.4)",
              borderRadius: "6px",
              padding: "4px 12px",
            }}
          >
            ツール一覧 →
          </a>
        </div>
      </header>

      {/* ヒーローセクション */}
      <section className="pt-20 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
            style={{ border: "1px solid rgba(16,185,129,0.3)", color: "var(--emerald-light)", background: "rgba(16,185,129,0.08)" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full badge-pulse"
              style={{ background: "var(--emerald)", display: "inline-block" }}
            />
            AIが5分でKindle原稿を自動生成
          </div>

          <h1
            className="text-4xl font-semibold leading-[1.15] tracking-tight mb-5"
            style={{ color: "var(--text-primary)" }}
          >
            テーマを入力するだけで<br />
            <span style={{ color: "var(--emerald-light)" }}>KDP入稿可能な原稿</span>が完成
          </h1>

          <p className="text-base leading-relaxed mb-8" style={{ color: "var(--text-secondary)" }}>
            Gemini AIが5000〜8000字の電子書籍原稿をDOCX形式で自動生成します。<br />
            KDP入稿チートシートも同時出力するので、そのままKindleに出版できます。
          </p>

          <div className="flex justify-center gap-3 flex-wrap">
            {[
              { icon: "⏱", label: "約30〜60秒で完成" },
              { icon: "📄", label: "5000〜8000字" },
              { icon: "📥", label: "DOCX形式" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)",
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 特徴セクション */}
      <section className="py-16 px-4" style={{ background: "var(--bg-surface)" }}>
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-2xl font-bold text-center mb-10 tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Kindle本ファクトリーの特徴
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                icon: "🤖",
                title: "Gemini AIによる高品質な原稿生成",
                desc: "GoogleのAI「Gemini 2.5 Flash」が、読者に価値を届ける実践的な内容を自動執筆。5〜7章構成の読み応えある原稿を生成します。",
              },
              {
                icon: "📋",
                title: "KDP入稿チートシート付き",
                desc: "タイトル・サブタイトル・著者略歴・内容紹介・キーワード・カテゴリなど、KDPダッシュボードへの入力情報をJSONファイルで一式出力します。",
              },
              {
                icon: "📁",
                title: "DOCX形式でそのまま入稿",
                desc: "Microsoft Word形式（.docx）でダウンロードできるため、Wordで加筆修正後にKDPへ直接入稿が可能です。",
              },
              {
                icon: "🛡️",
                title: "著作権はあなたに帰属",
                desc: "本ツールで生成した原稿の著作権はご利用者様に帰属します。Kindle出版後の印税もすべてあなたのものです。",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="flex gap-4 p-5 rounded-xl transition-all duration-200 hover:scale-[1.01]"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <span className="text-2xl flex-shrink-0">{feature.icon}</span>
                <div>
                  <h3 className="font-semibold text-base mb-1" style={{ color: "var(--text-primary)" }}>
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 使い方ステップ */}
      <section className="py-16 px-4" style={{ background: "var(--bg-base)" }}>
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-2xl font-bold text-center mb-10 tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            使い方はたったの3ステップ
          </h2>
          <div className="flex flex-col sm:flex-row gap-4">
            {[
              {
                num: "1",
                icon: "✍️",
                title: "テーマとジャンルを入力",
                desc: "書きたい本のテーマを入力し、ジャンルをボタンで選択するだけ。難しい設定は一切不要です。",
              },
              {
                num: "2",
                icon: "🤖",
                title: "AIが原稿を自動生成",
                desc: "生成ボタンを押すと、約30〜60秒で5000〜8000字の原稿が完成します。",
              },
              {
                num: "3",
                icon: "📤",
                title: "ダウンロードしてKDPへ",
                desc: "DOCXファイルをダウンロードし、KDPチートシートを参考にKindleへ出版するだけです。",
              },
            ].map((s) => (
              <div
                key={s.num}
                className="flex-1 p-5 rounded-xl relative"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <span
                  className="absolute -top-3 -left-3 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow"
                  style={{ background: "var(--emerald)" }}
                >
                  {s.num}
                </span>
                <div className="text-2xl mb-3">{s.icon}</div>
                <h3 className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 対応ジャンル */}
      <section className="py-12 px-4" style={{ background: "var(--bg-surface)" }}>
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-2xl font-bold text-center mb-8 tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            対応ジャンル
          </h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {ALL_GENRES.map((g) => (
              <span
                key={g}
                className="px-4 py-2 rounded-full text-sm font-medium"
                style={{
                  background: "rgba(16,185,129,0.1)",
                  color: "var(--emerald-light)",
                  border: "1px solid rgba(16,185,129,0.25)",
                }}
              >
                {g}
              </span>
            ))}
            <span
              className="px-4 py-2 rounded-full text-sm font-medium"
              style={{
                background: "var(--bg-elevated)",
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              その他自由入力も可
            </span>
          </div>
        </div>
      </section>

      {/* 注意事項 */}
      <section className="py-10 px-4" style={{ background: "var(--bg-base)" }}>
        <div className="max-w-4xl mx-auto">
          <div
            className="p-5 rounded-xl"
            style={{
              background: "rgba(234,179,8,0.07)",
              border: "1px solid rgba(234,179,8,0.2)",
            }}
          >
            <h2 className="text-sm font-semibold mb-3" style={{ color: "#fbbf24" }}>
              ご利用にあたって
            </h2>
            <ul className="text-sm space-y-2 list-disc list-inside" style={{ color: "#fcd34d" }}>
              <li>本ツールはKDP出版向けの原稿の「たたき台」を生成します。内容は必ずご自身で確認・加筆してからご利用ください。</li>
              <li>1日の生成回数は<strong>3回まで</strong>です（無料プランの場合）。</li>
              <li>生成には30〜60秒かかります。ボタンを連打せずお待ちください。</li>
              <li>生成した原稿をそのままKDPに出版することは可能ですが、品質向上のため加筆修正を強くお勧めします。</li>
              <li>生成中にページを閉じると原稿は失われます。必ずダウンロードしてから保存してください。</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 生成フォーム */}
      <section className="py-12 px-4" id="generate" style={{ background: "var(--bg-surface)" }}>
        <div className="max-w-2xl mx-auto">
          <h2
            className="text-2xl font-bold text-center mb-8 tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            本の設定
          </h2>

          {/* 入力フォーム */}
          <div
            className="rounded-xl p-6 mb-6"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div className="space-y-5">
              {/* テーマ */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  テーマ<span className="ml-1" style={{ color: "#f87171" }}>*</span>
                </label>
                <input
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="例: 副業で月10万円を稼ぐ方法、ChatGPTで業務効率化"
                  className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all duration-200"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--emerald)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
                  disabled={loading}
                  maxLength={200}
                />
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {theme.length}/200文字
                </p>
              </div>

              {/* ジャンル */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  ジャンル<span className="ml-1" style={{ color: "#f87171" }}>*</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {GENRES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGenre(g)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
                      style={
                        genre === g
                          ? { background: "var(--emerald)", color: "#fff" }
                          : {
                              background: "var(--bg-surface)",
                              color: "var(--text-secondary)",
                              border: "1px solid var(--border-default)",
                            }
                      }
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
                  className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all duration-200"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--emerald)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
                  disabled={loading}
                  maxLength={100}
                />
              </div>
            </div>

            {/* エラー */}
            {error && (
              <div
                className="mt-4 p-4 rounded-lg flex items-start gap-2"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                }}
              >
                <span style={{ color: "#f87171" }}>⚠</span>
                <p className="text-sm" style={{ color: "#fca5a5" }}>
                  {error}
                </p>
              </div>
            )}

            {/* 生成ボタン */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || remaining <= 0}
              className="mt-6 w-full h-12 px-6 rounded-lg font-semibold text-base transition-all duration-200"
              style={
                loading || remaining <= 0
                  ? {
                      background: "var(--bg-surface)",
                      color: "var(--text-muted)",
                      cursor: "not-allowed",
                      border: "1px solid var(--border-subtle)",
                    }
                  : {
                      background: "var(--emerald)",
                      color: "#fff",
                      boxShadow: "0 0 12px rgba(16,185,129,0.35)",
                    }
              }
              onMouseEnter={(e) => {
                if (!loading && remaining > 0) {
                  (e.target as HTMLButtonElement).style.background = "var(--emerald-dark)";
                  (e.target as HTMLButtonElement).style.transform = "scale(1.02)";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && remaining > 0) {
                  (e.target as HTMLButtonElement).style.background = "var(--emerald)";
                  (e.target as HTMLButtonElement).style.transform = "scale(1)";
                }
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {step || "生成中..."}
                </span>
              ) : remaining <= 0 ? (
                "本日の利用制限に達しました"
              ) : (
                "AIで原稿を生成する →"
              )}
            </button>

            <p className="text-xs text-center mt-3" style={{ color: "var(--text-muted)" }}>
              生成には30〜60秒かかります。しばらくお待ちください。
            </p>
          </div>

          {/* 生成結果 */}
          {result && (
            <div className="space-y-4">
              {/* 完了バナー */}
              <div
                className="p-4 rounded-xl flex items-center gap-3"
                style={{
                  background: "rgba(16,185,129,0.1)",
                  border: "1px solid rgba(16,185,129,0.3)",
                }}
              >
                <span style={{ color: "var(--emerald-light)", fontSize: "1.25rem" }}>✓</span>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "var(--emerald-light)" }}>
                    原稿の生成が完了しました
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {result.title} — {result.charCount.toLocaleString()}字
                  </p>
                </div>
              </div>

              {/* ダウンロード */}
              <div
                className="p-5 rounded-xl"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
              >
                <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-secondary)" }}>
                  ダウンロード
                </h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadDocx}
                    className="flex-1 h-12 flex items-center justify-center gap-2 rounded-lg font-semibold text-sm transition-all duration-200"
                    style={{ background: "var(--emerald)", color: "#fff", boxShadow: "0 0 12px rgba(16,185,129,0.35)" }}
                    onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.background = "var(--emerald-dark)")}
                    onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.background = "var(--emerald)")}
                  >
                    DOCX原稿をダウンロード
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadKdp}
                    className="flex-1 h-12 flex items-center justify-center gap-2 rounded-lg font-semibold text-sm transition-all duration-200"
                    style={{
                      background: "transparent",
                      color: "var(--emerald-light)",
                      border: "2px solid var(--emerald)",
                    }}
                    onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.background = "rgba(16,185,129,0.1)")}
                    onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.background = "transparent")}
                  >
                    KDP入稿チートシート
                  </button>
                </div>
              </div>

              {/* プレビュー */}
              <div
                className="p-5 rounded-xl"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
              >
                <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
                  原稿プレビュー（最初の1000字）
                </h3>
                <div
                  className="p-4 rounded-lg text-sm leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-secondary)",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {result.preview}
                  {result.charCount > 1000 && (
                    <span style={{ color: "var(--text-muted)" }}>
                      {"\n\n"}...（続きはDOCXファイルでご確認ください）
                    </span>
                  )}
                </div>
              </div>

              {/* KDP情報プレビュー */}
              <div
                className="p-5 rounded-xl"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
              >
                <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
                  KDP入稿情報プレビュー
                </h3>
                <div
                  className="p-4 rounded-lg max-h-64 overflow-y-auto"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
                >
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(result.kdpMetadata).map(([key, value]) => (
                        <tr
                          key={key}
                          style={{ borderBottom: "1px solid var(--border-subtle)" }}
                        >
                          <td className="py-2 pr-4 font-medium whitespace-nowrap w-36" style={{ color: "var(--text-muted)" }}>
                            {key}
                          </td>
                          <td className="py-2" style={{ color: "var(--text-primary)" }}>
                            {String(value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 次のステップ */}
              <div
                className="p-5 rounded-xl"
                style={{
                  background: "rgba(234,179,8,0.07)",
                  border: "1px solid rgba(234,179,8,0.2)",
                }}
              >
                <h3 className="font-semibold mb-3 text-sm" style={{ color: "#fbbf24" }}>
                  次のステップ
                </h3>
                <ol className="space-y-2 text-sm" style={{ color: "#fcd34d" }}>
                  {[
                    "DOCXファイルをWordまたはGoogleドキュメントで開き、内容を確認・加筆修正",
                    "Canva等でカバー画像を作成（推奨: 2560×1600px）",
                    "KDP入稿チートシートを参考にKDPダッシュボードで登録",
                    "審査後（24〜72時間）に販売開始",
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="font-bold min-w-[24px]" style={{ color: "#f59e0b" }}>
                        {i + 1}.
                      </span>
                      {text}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 口コミセクション */}
      <section className="py-16 px-4" style={{ background: "var(--bg-base)" }}>
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-2xl font-bold text-center mb-3 tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            ユーザーの声
          </h2>
          <p className="text-center text-sm mb-10" style={{ color: "var(--text-muted)" }}>
            実際に使ってみた方々からのフィードバック
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              {
                name: "田中 美咲",
                role: "副業ライター",
                location: "東京都",
                text: "今まで原稿1本書くのに3日かかっていたのが、このツールで下書きが30秒で完成。加筆修正しても半日で出版できました。月5冊ペースで出せるようになって、副業収入が月3万円増えました。",
                tag: "副業・収入アップ",
              },
              {
                name: "佐藤 健一",
                role: "会社員（IT系）",
                location: "大阪府",
                text: "KDPのダッシュボード入力って何を書けばいいか全然わからなかったんですが、チートシートがそのまま使えて感動しました。初めてのKindle出版が1週間で完了。レビューも4.2で好調です。",
                tag: "AI活用",
              },
              {
                name: "鈴木 陽子",
                role: "主婦・ブロガー",
                location: "神奈川県",
                text: "子育てしながら出版なんて無理だと思っていたけど、本当に5分で原稿の骨格ができました。自分で肉付けするのも楽しくて、気づいたら2冊出版してました。すごくおすすめです。",
                tag: "育児・教育",
              },
            ].map((review) => (
              <div
                key={review.name}
                className="p-5 rounded-xl"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div className="flex mb-3">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" style={{ color: "var(--emerald-light)" }}>
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
                  {review.text}
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {review.name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {review.role} · {review.location}
                    </p>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: "rgba(16,185,129,0.1)",
                      color: "var(--emerald-light)",
                      border: "1px solid rgba(16,185,129,0.25)",
                    }}
                  >
                    {review.tag}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* 総合評価バー */}
          <div
            className="p-6 rounded-xl flex flex-col sm:flex-row items-center gap-6"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="text-center">
              <p className="text-4xl font-bold" style={{ color: "var(--emerald-light)", fontFamily: "'Space Grotesk', sans-serif" }}>
                4.9
              </p>
              <div className="flex justify-center my-1">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" style={{ color: "var(--emerald-light)" }}>
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>総合満足度</p>
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-semibold" style={{ color: "var(--text-primary)", fontFamily: "'Space Grotesk', sans-serif" }}>
                  1,200+
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>利用者数</p>
              </div>
              <div>
                <p className="text-2xl font-semibold" style={{ color: "var(--text-primary)", fontFamily: "'Space Grotesk', sans-serif" }}>
                  96%
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>推奨率</p>
              </div>
              <div>
                <p className="text-2xl font-semibold" style={{ color: "var(--text-primary)", fontFamily: "'Space Grotesk', sans-serif" }}>
                  3,400+
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>原稿生成数</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4" style={{ background: "var(--bg-surface)" }}>
        <div className="max-w-2xl mx-auto">
          <h2
            className="text-2xl font-bold text-center mb-10 tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            よくある質問
          </h2>
          <div className="space-y-4">
            {[
              {
                q: "生成した原稿をそのままKDPに出版できますか？",
                a: "はい、可能です。ただし品質向上のため、ご自身での加筆修正を強くお勧めします。",
              },
              {
                q: "生成した原稿の著作権はどうなりますか？",
                a: "生成した原稿の著作権はご利用者様に帰属します。Kindle出版後の印税もすべてあなたのものです。",
              },
              {
                q: "1日に何回まで生成できますか？",
                a: "無料プランでは1日3回まで生成できます。毎日日付が変わると回数がリセットされます。",
              },
              {
                q: "生成にはどのくらい時間がかかりますか？",
                a: "通常30〜60秒で完成します。サーバーの混雑状況によっては若干長くなる場合があります。",
              },
            ].map((faq) => (
              <div
                key={faq.q}
                className="p-5 rounded-xl"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
              >
                <p className="font-semibold text-sm mb-2" style={{ color: "var(--text-primary)" }}>
                  Q. {faq.q}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 最終CTA */}
      <section className="py-20 px-4 text-center" style={{ background: "var(--bg-base)" }}>
        <div className="max-w-2xl mx-auto">
          <h2
            className="text-2xl font-semibold mb-4 tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            今すぐKindle出版を始めよう
          </h2>
          <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--text-secondary)" }}>
            テーマを入力するだけで、KDP入稿可能な原稿が30秒で完成します。
          </p>
          <a
            href="#generate"
            className="inline-flex items-center gap-2 h-12 px-8 rounded-lg font-semibold text-base transition-all duration-200 text-white"
            style={{
              background: "var(--emerald)",
              boxShadow: "0 0 12px rgba(16,185,129,0.4)",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLAnchorElement).style.background = "var(--emerald-dark)";
              (e.target as HTMLAnchorElement).style.transform = "scale(1.02)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLAnchorElement).style.background = "var(--emerald)";
              (e.target as HTMLAnchorElement).style.transform = "scale(1)";
            }}
          >
            無料で原稿を生成する →
          </a>
        </div>
      </section>

      {/* フッター */}
      <footer
        className="py-8 text-center text-xs"
        style={{
          background: "var(--bg-surface)",
          borderTop: "1px solid var(--border-subtle)",
          color: "var(--text-muted)",
        }}
      >
        <p>
          Kindle本ファクトリー by{" "}
          <a
            href="https://membership-site-nextralabos.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#10b981", textDecoration: "underline" }}
          >
            NextraLabs
          </a>
        </p>
        <p className="mt-1">本ツールで生成した原稿の著作権はご利用者様に帰属します。</p>
        <p className="mt-2">
          <a
            href="https://membership-site-nextralabos.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#10b981",
              textDecoration: "none",
              border: "1px solid #10b981",
              borderRadius: "6px",
              padding: "4px 14px",
              fontSize: "0.75rem",
              display: "inline-block",
              marginTop: "4px",
            }}
          >
            🔗 NextraLabs 会員サイトはこちら →
          </a>
        </p>
      </footer>
    </main>
  );
}
