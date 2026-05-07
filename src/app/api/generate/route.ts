import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";

export const maxDuration = 60;

const GEMINI_API_KEY = "AIzaSyCMbtu9IJIGbml2KOv1Yjit9QP7TkmIgiA";

// プラン別制限（サーバー側で強制）
const PLAN_LIMITS: Record<string, { dailyLimit: number; maxChars: number }> = {
  free:     { dailyLimit: 1,  maxChars: 3000 },
  light:    { dailyLimit: 2,  maxChars: 5000 },
  standard: { dailyLimit: 3,  maxChars: 8000 },
  premium:  { dailyLimit: 10, maxChars: 10000 },
};
const ADMIN_EMAIL = "f.yoneyone9@gmail.com";

// ========================
// Supabaseによるサーバー側使用回数チェック
// ========================
async function checkAndIncrementUsage(
  userId: string,
  userEmail: string,
  userPlan: string
): Promise<{ allowed: boolean; remaining: number; error?: string }> {
  // 管理者は無制限
  if (userEmail === ADMIN_EMAIL) return { allowed: true, remaining: 999 };

  const limit = PLAN_LIMITS[userPlan]?.dailyLimit ?? 1;
  if (limit >= 999) return { allowed: true, remaining: 999 };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = new Date().toISOString().slice(0, 10);

  // 今日の使用回数を取得
  const { data, error } = await supabase
    .from("api_usage")
    .select("count")
    .eq("user_id", userId)
    .eq("tool_id", "kindle-factory")
    .eq("date", today)
    .maybeSingle();

  if (error) {
    console.error("[USAGE_CHECK_ERROR]", error);
    // DBエラー時はフリープランの制限で続行
    return { allowed: true, remaining: limit };
  }

  const currentCount = data?.count ?? 0;
  if (currentCount >= limit) {
    return { allowed: false, remaining: 0, error: `本日の生成回数制限（${limit}回）に達しました。` };
  }

  // カウントをインクリメント（upsert）
  await supabase.from("api_usage").upsert(
    { user_id: userId, tool_id: "kindle-factory", date: today, count: currentCount + 1 },
    { onConflict: "user_id,tool_id,date" }
  );

  return { allowed: true, remaining: limit - currentCount - 1 };
}

function buildPrompt(theme: string, genre: string, maxChars: number): string {
  return `あなたはKDP（Kindle Direct Publishing）向けの電子書籍を執筆する日本人著者です。
以下の条件で高品質な電子書籍の原稿を作成してください。

テーマ: ${theme}
ジャンル: ${genre}

【執筆条件】
- 日本語で書くこと
- 総文字数: ${Math.floor(maxChars * 0.6)}〜${maxChars}字
- Markdown形式で構造化すること
- 書式: # タイトル, ## 章タイトル, ### 節タイトル
- 章数: 5〜7章構成
- KDP向けの読み物として成立する品質
- 読者に価値を提供する実践的な内容

【禁止事項】
- 英語の見出しや単語を使わない
- 架空のデータを使わない
- 内容の繰り返しはしない

内容のみを出力してください。前置きや説明文は不要です。`;
}

function generateKdpMetadata(title: string, theme: string, genre: string): object {
  return {
    タイトル: title,
    サブタイトル: `${theme}の完全ガイド`,
    著者名: "NextraLabs著",
    シリーズ名: "",
    出版社: "NextraLabs",
    言語: "日本語",
    カテゴリ1: genre,
    カテゴリ2: "実用書・教養",
    キーワード1: theme,
    キーワード2: genre,
    キーワード3: "日本語電子書籍",
    キーワード4: "KDP",
    キーワード5: "実用ガイド",
    キーワード6: "初心者",
    キーワード7: "完全マニュアル",
    内容紹介: `本書は「${theme}」について、初心者から中級者まで役立てるよう丁寧に解説したガイドブックです。${genre}分野の基礎知識から応用テクニックまでを網羅し、読者が即日実践できる内容を提供します。`,
    DRM: "有効",
    価格_円: 490,
    ロイヤリティ率: "70%（350円以上の場合）",
    出版タイプ: "電子書籍のみ",
    成人向けコンテンツ: "なし",
    注意事項: "カバー画像は別途CanvaまたはMidjourneyで作成してください（推奨サイズ: 2560×1600px）",
  };
}

function markdownToDocxParagraphs(markdown: string): Paragraph[] {
  const lines = markdown.split("\n");
  const paragraphs: Paragraph[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { paragraphs.push(new Paragraph({ text: "" })); continue; }
    if (trimmed.startsWith("### ")) {
      paragraphs.push(new Paragraph({ text: trimmed.slice(4), heading: HeadingLevel.HEADING_3 }));
    } else if (trimmed.startsWith("## ")) {
      paragraphs.push(new Paragraph({ text: trimmed.slice(3), heading: HeadingLevel.HEADING_2 }));
    } else if (trimmed.startsWith("# ")) {
      paragraphs.push(new Paragraph({ text: trimmed.slice(2), heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }));
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: "・ " + trimmed.slice(2) })], indent: { left: 720 } }));
    } else {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: trimmed })] }));
    }
  }
  return paragraphs;
}

function extractTitle(markdown: string): string {
  const lines = markdown.split("\n");
  for (const line of lines) {
    if (line.startsWith("# ")) return line.slice(2).trim();
  }
  return "Kindle本原稿";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { theme, genre } = body;

    if (!theme || !genre) {
      return NextResponse.json({ error: "テーマとジャンルを入力してください。" }, { status: 400 });
    }
    if (theme.length > 200 || genre.length > 100) {
      return NextResponse.json({ error: "テーマまたはジャンルが長すぎます。" }, { status: 400 });
    }

    // ========================
    // Supabaseでユーザー認証・プラン取得・使用回数チェック
    // ========================
    let userId = "anonymous";
    let userEmail = "";
    let userPlan = "free";

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace("Bearer ", "");

      if (token) {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          userId = user.id;
          userEmail = user.email ?? "";

          if (userEmail !== ADMIN_EMAIL) {
            const { data: sub } = await supabase
              .from("subscriptions")
              .select("plan")
              .eq("user_id", userId)
              .eq("status", "active")
              .maybeSingle();
            userPlan = sub?.plan ?? "free";
          } else {
            userPlan = "premium";
          }
        }
      }
    } catch (authErr) {
      console.warn("[AUTH_WARN] Supabase auth failed, using free plan limits", authErr);
    }

    // サーバー側制限チェック
    const usageCheck = await checkAndIncrementUsage(userId, userEmail, userPlan);
    if (!usageCheck.allowed) {
      return NextResponse.json({ error: usageCheck.error }, { status: 429 });
    }

    const maxChars = PLAN_LIMITS[userPlan]?.maxChars ?? 3000;

    // Gemini API で原稿生成
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = buildPrompt(theme, genre, maxChars);
    const result = await model.generateContent(prompt);
    const manuscript = result.response.text();

    if (!manuscript || manuscript.length < 500) {
      return NextResponse.json({ error: "原稿の生成に失敗しました。再度お試しください。" }, { status: 500 });
    }

    // DOCX 生成
    const title = extractTitle(manuscript);
    const doc = new Document({
      title,
      creator: "NextraLabs Kindle Factory",
      description: `${theme} - KDP原稿`,
      sections: [{ properties: {}, children: markdownToDocxParagraphs(manuscript) }],
    });
    const docxBuffer = await Packer.toBuffer(doc);
    const docxBase64 = docxBuffer.toString("base64");
    const kdpMetadata = generateKdpMetadata(title, theme, genre);

    return NextResponse.json({
      success: true,
      title,
      manuscript,
      preview: manuscript.slice(0, 1000),
      docxBase64,
      kdpMetadata,
      charCount: manuscript.length,
      remaining: usageCheck.remaining,
    });
  } catch (error) {
    console.error("Generate API Error:", error);
    const message = error instanceof Error ? error.message : "不明なエラーが発生しました。";
    return NextResponse.json({ error: `生成中にエラーが発生しました: ${message}` }, { status: 500 });
  }
}
