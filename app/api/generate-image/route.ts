import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const providedPassword = request.headers.get("x-site-password");
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword && providedPassword !== sitePassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { headline } = await request.json();
    if (!headline || typeof headline !== "string") {
      return NextResponse.json({ error: "headline is required" }, { status: 400 });
    }

    const stylePrompt =
      `${headline}, photorealistic photography style, natural lighting, high detail, ` +
      "professional news photography aesthetic, documentary style, generic anonymous " +
      "people only (no specific recognizable individuals, no celebrity or politician " +
      "likenesses), focus on setting/scene/objects rather than close-up faces, no text, " +
      "no words, no letters, no logos, no watermark";

    const encodedPrompt = encodeURIComponent(stylePrompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=480&nologo=true`;

    const imageResp = await fetch(url);
    if (!imageResp.ok) {
      throw new Error(`Pollinations error: ${imageResp.status}`);
    }

    const arrayBuffer = await imageResp.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return NextResponse.json({ imageBase64: base64, mimeType: "image/jpeg" });
  } catch (error) {
    console.error("Generate-image API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
