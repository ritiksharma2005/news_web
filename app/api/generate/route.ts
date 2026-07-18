import { NextRequest, NextResponse } from "next/server";

// llama-3.1-8b-instant was deprecated by Groq — switched to their
// recommended replacement.
const GROQ_MODEL = "openai/gpt-oss-20b";
const GROQ_VISION_MODEL = "qwen/qwen3.6-27b";
const GEMINI_MODEL = "gemini-3.1-flash-lite";

function buildPrompt(rawText: string, language: string) {
  const languageInstruction =
    language === "hi"
      ? "Write the headline and summary in Hindi (Devanagari script). Write the caption in Hinglish or Hindi, whichever reads more naturally for an Instagram audience."
      : "Write everything in English.";

  return `You are a news editor for an Indian college/student-focused Instagram news page called @news.nit_iit.

Given this raw news text:
"""
${rawText}
"""

${languageInstruction}

Write, in your own original words (do not copy phrasing from the input):
1. A short punchy headline (under 15 words)
2. A 2-3 line summary (max 50 words)
3. A short Instagram caption (2-4 lines, 1-2 emojis, engaging tone, maybe a question to invite comments)
4. 8-10 relevant hashtags as a single space-separated string

Return ONLY a JSON object, nothing else, no markdown fences:
{"headline": "...", "summary": "...", "caption": "...", "hashtags": "..."}`;
}

function parseAiJson(raw: string) {
  const cleaned = raw
    .trim()
    .replace(/^```json/, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(cleaned);
}

async function callGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured on server");

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Groq error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured on server");

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gemini error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  return data.candidates[0].content.parts[0].text;
}

async function callAi(prompt: string): Promise<string> {
  try {
    return await callGemini(prompt);
  } catch (geminiError) {
    console.log("Gemini failed, falling back to Groq:", geminiError);
    return await callGroq(prompt);
  }
}

const EXTRACTION_PROMPT =
  "This image shows a news article, poster, screenshot, or clipping. " +
  "Carefully read and transcribe ALL the news-relevant text visible in the image " +
  "(headline, body text, captions — ignore unrelated UI chrome like app icons or " +
  "browser bars). Return ONLY the transcribed text, nothing else — no commentary, " +
  "no markdown, no quotes around it.";

async function extractTextFromImageGemini(base64Image: string, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured on server");

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: EXTRACTION_PROMPT },
              { inline_data: { mime_type: mimeType, data: base64Image } },
            ],
          },
        ],
      }),
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gemini vision error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  return data.candidates[0].content.parts[0].text;
}

async function extractTextFromImageGroq(base64Image: string, mimeType: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured on server");

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_PROMPT },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Groq vision error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}

async function extractTextFromImage(base64Image: string, mimeType: string): Promise<string> {
  try {
    return await extractTextFromImageGemini(base64Image, mimeType);
  } catch (geminiError) {
    console.log("Gemini vision failed, falling back to Groq vision:", geminiError);
    return await extractTextFromImageGroq(base64Image, mimeType);
  }
}

export async function POST(request: NextRequest) {
  // Simple shared-password gate so random visitors can't burn your API budget.
  const providedPassword = request.headers.get("x-site-password");
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword && providedPassword !== sitePassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { rawText, language, imageBase64, imageMimeType } = await request.json();

    let sourceText = typeof rawText === "string" ? rawText : "";

    if (imageBase64 && typeof imageBase64 === "string") {
      console.log("Extracting text from uploaded image...");
      const extracted = await extractTextFromImage(imageBase64, imageMimeType || "image/jpeg");
      sourceText = sourceText ? `${sourceText}\n\n${extracted}` : extracted;
    }

    if (!sourceText.trim()) {
      return NextResponse.json(
        { error: "Provide either rawText or an image to extract text from" },
        { status: 400 }
      );
    }

    const prompt = buildPrompt(sourceText, language || "en");
    const responseText = await callAi(prompt);
    const parsed = parseAiJson(responseText);
    parsed.extractedText = sourceText;

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Generate API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
