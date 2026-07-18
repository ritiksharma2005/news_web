import { NextRequest, NextResponse } from "next/server";

const GROQ_MODEL = "llama-3.1-8b-instant";
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

export async function POST(request: NextRequest) {
  // Simple shared-password gate so random visitors can't burn your API budget.
  const providedPassword = request.headers.get("x-site-password");
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword && providedPassword !== sitePassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { rawText, language } = await request.json();

    if (!rawText || typeof rawText !== "string") {
      return NextResponse.json({ error: "rawText is required" }, { status: 400 });
    }

    const prompt = buildPrompt(rawText, language || "en");
    const responseText = await callAi(prompt);
    const parsed = parseAiJson(responseText);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Generate API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
