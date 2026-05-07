import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

function buildPrompt(theme: string, genre: string): string {
  return `あなたはKDP（Kindle Direct Publishing）向けの電子書籍を執筆する日本人著者です。
以下の条件で高品質な電子書籍の原稿を作成してください。

テーマ: ${theme}
ジャンル: ${genre}

【執筆条件】
- 日本語で書くこと
- 総文字数: 5000〜8000字
- Markdown形式で構造化すること
- 書式: # タイトル, ## 章タイトル, ### 節タイトル
- 章数: 5〜7章構成
- KDP向けの読み物として成立する品質
- 読者に価値を提供する実践的な内容
- 具体例や事例を盛り込む
- はじめにと終わりに（まとめ）を含める

【禁止事項】
- 英語の見出しを使用しない
- 架空の統計データを使用しない
- 内容の薄い章を作らない

原稿のみを出力してください。説明文や前置きは不要です。`;
}

function generateKdpMetadata(
  title: string,
  theme: string,
  genre: string
): object {
  return {
    タイトル: title,
    サブタイトル: `${theme}の完全ガイド`,
    著者名: "NextraLabs著",
    シリーズ名: "",
    出版社: "NextraLabs",
    言語: "日本語",
    カテゴリ1: genre,
    カテゴリ2: "自己啓発",
    キーワード1: theme,
    キーワード2: genre,
    キーワード3: "日本語電子書籍",
    キーワード4: "KDP",
    キーワード5: "実践ガイド",
    キーワード6: "入門",
    キーワード7: "完全マニュアル",
    内容紹介: `本書は「${theme}」について、初心者から中級者まで理解できるよう丁寧に解説した実践的なガイドブックです。${genre}分野の基礎知識から応用テクニックまでを網羅し、読者が即実践できる内容を提供します。`,
    DRM: "有効",
    価格_円: 490,
    ロイヤリティ率: "70%（350円以上の場合）",
    出版タイプ: "電子書籍のみ",
    成人向けコンテンツ: "いいえ",
    注意事項:
      "カバー画像は別途Canvaまたはmidjourney等で作成してください（推奨サイズ: 2560×1600px）",
  };
}

function markdownToDocxParagraphs(markdown: string): Paragraph[] {
  const lines = markdown.split("\n");
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      paragraphs.push(new Paragraph({ text: "" }));
      continue;
    }

    if (trimmed.startsWith("### ")) {
      paragraphs.push(
        new Paragraph({
          text: trimmed.slice(4),
          heading: HeadingLevel.HEADING_3,
        })
      );
    } else if (trimmed.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          text: trimmed.slice(3),
          heading: HeadingLevel.HEADING_2,
        })
      );
    } else if (trimmed.startsWith("# ")) {
      paragraphs.push(
        new Paragraph({
          text: trimmed.slice(2),
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        })
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "• " + trimmed.slice(2),
            }),
          ],
          indent: { left: 720 },
        })
      );
    } else {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed,
            }),
          ],
        })
      );
    }
  }

  return paragraphs;
}

function extractTitle(markdown: string): string {
  const lines = markdown.split("\n");
  for (const line of lines) {
    if (line.startsWith("# ")) {
      return line.slice(2).trim();
    }
  }
  return "Kindle本原稿";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { theme, genre } = body;

    if (!theme || !genre) {
      return NextResponse.json(
        { error: "テーマとジャンルを入力してください。" },
        { status: 400 }
      );
    }

    if (theme.length > 200 || genre.length > 100) {
      return NextResponse.json(
        { error: "テーマまたはジャンルが長すぎます。" },
        { status: 400 }
      );
    }

    // Gemini API で原稿生成
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = buildPrompt(theme, genre);
    const result = await model.generateContent(prompt);
    const manuscript = result.response.text();

    if (!manuscript || manuscript.length < 1000) {
      return NextResponse.json(
        { error: "原稿の生成に失敗しました。もう一度お試しください。" },
        { status: 500 }
      );
    }

    // DOCX 生成
    const title = extractTitle(manuscript);
    const docParagraphs = markdownToDocxParagraphs(manuscript);

    const doc = new Document({
      title: title,
      creator: "NextraLabs Kindle Factory",
      description: `${theme} - KDP原稿`,
      sections: [
        {
          properties: {},
          children: docParagraphs,
        },
      ],
    });

    const docxBuffer = await Packer.toBuffer(doc);
    const docxBase64 = docxBuffer.toString("base64");

    // KDP メタデータ
    const kdpMetadata = generateKdpMetadata(title, theme, genre);

    return NextResponse.json({
      success: true,
      title,
      manuscript,
      preview: manuscript.slice(0, 1000),
      docxBase64,
      kdpMetadata,
      charCount: manuscript.length,
    });
  } catch (error) {
    console.error("Generate API Error:", error);
    const message =
      error instanceof Error ? error.message : "不明なエラーが発生しました。";
    return NextResponse.json(
      { error: `生成中にエラーが発生しました: ${message}` },
      { status: 500 }
    );
  }
}
