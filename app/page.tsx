"use client";

import { useRef, useState, useCallback, useEffect } from "react";

const COLORS = {
  bg: "#f7f0dc",
  text: "#141414",
  muted: "#5a5a5a",
  accent: "#0284c7",
  accentDark: "#0369a1",
  accentTint: "#ffffff",
  border: "#0284c7",
  placeholder: "#e1e1e1",
};

interface RichWord {
  text: string;
  isHighlighted: boolean;
}

interface RichLine {
  words: RichWord[];
}

function parseFormattedTextToWords(text: string): RichWord[] {
  const words: RichWord[] = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const normalPart = text.slice(lastIndex, match.index);
      const splitNormal = normalPart.split(/(\s+)/);
      for (const w of splitNormal) {
        if (w) words.push({ text: w, isHighlighted: false });
      }
    }
    const rawMatch = match[0];
    const cleanText = rawMatch.replace(/^\*+|\*+$/g, "");
    const splitClean = cleanText.split(/(\s+)/);
    for (const w of splitClean) {
      if (w) words.push({ text: w, isHighlighted: true });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    const normalPart = text.slice(lastIndex);
    const splitNormal = normalPart.split(/(\s+)/);
    for (const w of splitNormal) {
      if (w) words.push({ text: w, isHighlighted: false });
    }
  }

  return words;
}

function wrapRichWords(
  ctx: CanvasRenderingContext2D,
  words: RichWord[],
  font: string,
  maxWidth: number
): RichLine[] {
  ctx.font = font;
  const lines: RichLine[] = [];
  let currentLine: RichWord[] = [];
  let currentWidth = 0;

  for (const item of words) {
    if (item.text === "\n") {
      lines.push({ words: currentLine });
      currentLine = [];
      currentWidth = 0;
      continue;
    }

    const itemWidth = ctx.measureText(item.text).width;

    if (currentWidth + itemWidth <= maxWidth || currentLine.length === 0) {
      currentLine.push(item);
      currentWidth += itemWidth;
    } else {
      lines.push({ words: currentLine });
      if (item.text.trim() === "") {
        currentLine = [];
        currentWidth = 0;
      } else {
        currentLine = [item];
        currentWidth = itemWidth;
      }
    }
  }

  if (currentLine.length > 0) {
    lines.push({ words: currentLine });
  }

  return lines;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, font: string, maxWidth: number) {
  ctx.font = font;
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = (current + " " + word).trim();
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx, sy, sw, sh;
  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = sh * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rawText, setRawText] = useState("");
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [emoji, setEmoji] = useState("📩");
  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null);
  const [uploadedImageBase64, setUploadedImageBase64] = useState<string | null>(null);
  const [uploadedImageMimeType, setUploadedImageMimeType] = useState<string>("image/jpeg");
  const [extractTextFromImage, setExtractTextFromImage] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [genStatus, setGenStatus] = useState("");
  const [downloadStatus, setDownloadStatus] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [sitePassword, setSitePassword] = useState("");

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setUploadedImage(null);
      setUploadedImageBase64(null);
      return;
    }
    setUploadedImageMimeType(file.type || "image/jpeg");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const base64Only = dataUrl.split(",")[1];
      setUploadedImageBase64(base64Only);
      const img = new Image();
      img.onload = () => setUploadedImage(img);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateImage = async () => {
    if (!headline.trim()) {
      setGenStatus("Add a headline first (generate text or type one), then generate an image.");
      return;
    }
    setIsGeneratingImage(true);
    setGenStatus("Generating illustration...");
    try {
      const resp = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-site-password": sitePassword },
        body: JSON.stringify({ headline }),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed: ${resp.status}`);
      }
      const data = await resp.json();
      const img = new Image();
      img.onload = () => setUploadedImage(img);
      img.src = `data:${data.mimeType};base64,${data.imageBase64}`;
      setUploadedImageBase64(null);
      setGenStatus("Image generated!");
    } catch (err) {
      console.error(err);
      setGenStatus(err instanceof Error ? err.message : "Image generation failed.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const renderCard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Dummy headline & summary defaults as requested
    const displayHeadline = headline || "Headline Goes Here — Short One Line News Title";
    const displaySummary =
      summary ||
      "This is a **sample news summary**. Add key details here to highlight **important updates** and **numbers** in cyan.";
    const fontFamily = language === "hi" ? '"Nirmala UI","Noto Sans Devanagari",sans-serif' : "-apple-system,\"Segoe UI\",Roboto,sans-serif";

    // Strictly fixed 4:5 Aspect Ratio (1080 x 1350 px)
    const W = 1080;
    const H = 1350;
    const paddingX = 40;

    canvas.width = W;
    canvas.height = H;

    // Fill background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // 1. Top Accent Stripe
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(0, 0, W, 14);

    // 2. Top Header Bar
    let cy = 14;
    const barHeight = 70;
    ctx.font = `bold 34px ${fontFamily}`;
    ctx.fillStyle = COLORS.text;
    ctx.textBaseline = "middle";

    // Left: 2026
    ctx.textAlign = "left";
    ctx.fillText("2026", paddingX, cy + barHeight / 2);

    // Right: news.nit_iit
    ctx.textAlign = "right";
    ctx.fillText("news.nit_iit", W - paddingX, cy + barHeight / 2);

    cy += barHeight;
    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(W, cy);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, cy + 10);
    ctx.lineTo(W, cy + 10);
    ctx.stroke();
    cy += 20;

    // 3. Headline Area
    cy += 20;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "48px sans-serif";
    ctx.fillText(emoji || "📩", paddingX, cy + 40);

    const headlineFont = `bold 46px ${fontFamily}`;
    const emojiPrefixWidth = 70;
    const headlineLines = wrapText(ctx, displayHeadline, headlineFont, W - paddingX * 2 - emojiPrefixWidth);
    const headlineLineHeight = 56;

    ctx.font = headlineFont;
    ctx.fillStyle = COLORS.text;
    headlineLines.slice(0, 2).forEach((line, i) => {
      const x = i === 0 ? paddingX + emojiPrefixWidth : paddingX;
      ctx.fillText(line, x, cy + 40);
      cy += headlineLineHeight;
    });

    cy += 12;
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(paddingX, cy);
    ctx.lineTo(paddingX + 220, cy);
    ctx.stroke();
    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(paddingX + 230, cy);
    ctx.lineTo(W - paddingX, cy);
    ctx.stroke();
    cy += 20;

    // 4. Fixed Height Image Block (500px)
    const imageBlockHeight = 500;
    if (uploadedImage) {
      drawImageCover(ctx, uploadedImage, 0, cy, W, imageBlockHeight);
    } else {
      ctx.fillStyle = COLORS.placeholder;
      ctx.fillRect(0, cy, W, imageBlockHeight);
      ctx.fillStyle = COLORS.muted;
      ctx.font = "28px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("image", W / 2, cy + imageBlockHeight / 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
    cy += imageBlockHeight;

    // 5. Summary Box (Fills available space up to footer)
    const summaryBoxTop = cy + 20;
    const footerSeparatorY = H - 75;
    const summaryBoxHeight = Math.max(180, footerSeparatorY - summaryBoxTop - 25);
    const boxWidth = W - paddingX * 2;

    roundRect(ctx, paddingX, summaryBoxTop, boxWidth, summaryBoxHeight, 16);
    ctx.fillStyle = COLORS.accentTint;
    ctx.fill();
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.stroke();

    roundRect(ctx, paddingX, summaryBoxTop, 20, summaryBoxHeight, 16);
    ctx.fillStyle = COLORS.accent;
    ctx.fill();
    ctx.fillRect(paddingX + 8, summaryBoxTop, 12, summaryBoxHeight);

    const summaryFont = `bold 32px ${fontFamily}`;
    const summaryMaxWidth = boxWidth - 60;
    const richWords = parseFormattedTextToWords(displaySummary);
    const summaryLines = wrapRichWords(ctx, richWords, summaryFont, summaryMaxWidth);
    const summaryLineHeight = 48;

    ctx.font = summaryFont;
    ctx.textBaseline = "alphabetic";
    let ty = summaryBoxTop + 40;
    const maxSummaryLines = Math.floor((summaryBoxHeight - 40) / summaryLineHeight);

    summaryLines.slice(0, maxSummaryLines).forEach((line) => {
      let tx = paddingX + 44;
      line.words.forEach((w) => {
        ctx.fillStyle = w.isHighlighted ? COLORS.accent : COLORS.text;
        ctx.fillText(w.text, tx, ty);
        tx += ctx.measureText(w.text).width;
      });
      ty += summaryLineHeight;
    });

    // 6. Fixed Footer
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, footerSeparatorY);
    ctx.lineTo(W - 80, footerSeparatorY);
    ctx.stroke();

    const footerTextY = H - 35;
    const footerEmoji = "📷";
    const handle = "@news.nit_iit";
    ctx.font = "bold 32px " + fontFamily;
    const handleWidth = ctx.measureText(handle).width;
    ctx.font = "32px sans-serif";
    const emojiWidth = ctx.measureText(footerEmoji).width;
    const gap = 12;
    const totalWidth = emojiWidth + gap + handleWidth;
    const startX = (W - totalWidth) / 2;

    ctx.textAlign = "left";
    ctx.font = "32px sans-serif";
    ctx.fillText(footerEmoji, startX, footerTextY);
    ctx.font = "bold 32px " + fontFamily;
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(handle, startX + emojiWidth + gap, footerTextY);
  }, [headline, summary, language, emoji, uploadedImage]);

  useEffect(() => {
    renderCard();
  }, [renderCard]);

  const handleGenerate = async () => {
    const hasImageForExtraction = extractTextFromImage && uploadedImageBase64;
    if (!rawText.trim() && !hasImageForExtraction) {
      setGenStatus("Paste some news text, or upload an image and enable text extraction.");
      return;
    }
    setIsGenerating(true);
    setGenStatus(hasImageForExtraction ? "Reading text from image..." : "Generating...");

    try {
      const body: Record<string, string> = { rawText, language };
      if (hasImageForExtraction) {
        body.imageBase64 = uploadedImageBase64!;
        body.imageMimeType = uploadedImageMimeType;
      }

      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-site-password": sitePassword,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed: ${resp.status}`);
      }

      const parsed = await resp.json();
      setHeadline(parsed.headline || "");
      setSummary(parsed.summary || "");
      setCaption(parsed.caption || "");
      setHashtags(parsed.hashtags || "");
      if (hasImageForExtraction && parsed.extractedText) {
        setRawText(parsed.extractedText);
      }
      setGenStatus("Done! Edit any field if you want, preview updates automatically.");
    } catch (err) {
      console.error(err);
      setGenStatus(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "news_poster.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    setDownloadStatus("Downloaded!");
    setTimeout(() => setDownloadStatus(""), 2000);
  };

  const handleCopyCaption = () => {
    const full = caption + "\n\n" + hashtags;
    navigator.clipboard.writeText(full).then(() => {
      setDownloadStatus("Caption copied!");
      setTimeout(() => setDownloadStatus(""), 2000);
    });
  };

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", fontFamily: "-apple-system,Segoe UI,Roboto,sans-serif", color: COLORS.text }}>
      <div style={{ display: "flex", gap: 28, padding: 28, maxWidth: 1300, margin: "0 auto", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ background: "white", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 24, flex: "1 1 380px", minWidth: 340 }}>
          <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>News.nit_iit — Poster Maker</h1>
          <p style={{ color: COLORS.muted, fontSize: 13, margin: "0 0 20px" }}>Paste any news text, tweak the AI draft, download your poster.</p>

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Site password</label>
          <input
            type="password"
            value={sitePassword}
            onChange={(e) => setSitePassword(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8, marginBottom: 16 }}
          />

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Paste news article or key details</label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste the raw news text, or just a few bullet points of what happened..."
            style={{ width: "100%", minHeight: 90, padding: "10px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8 }}
          />

          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as "en" | "hi")}
                style={{ width: "100%", padding: "10px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8 }}
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Emoji</label>
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={4}
                style={{ width: 70, textAlign: "center", padding: "10px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8 }}
              />
            </div>
          </div>

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, margin: "16px 0 6px" }}>Upload image (optional)</label>
          <input type="file" accept="image/*" onChange={handleImageUpload} />

          {uploadedImageBase64 && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 10 }}>
              <input
                type="checkbox"
                checked={extractTextFromImage}
                onChange={(e) => setExtractTextFromImage(e.target.checked)}
              />
              This image is a news article/poster — read the text from it
            </label>
          )}

          <button
            onClick={handleGenerateImage}
            disabled={isGeneratingImage}
            style={{
              background: "#e0f2fe",
              color: COLORS.accentDark,
              width: "100%",
              marginTop: 10,
              padding: "9px 18px",
              borderRadius: 8,
              border: "none",
              fontWeight: 600,
              fontSize: 13,
              cursor: isGeneratingImage ? "not-allowed" : "pointer",
              opacity: isGeneratingImage ? 0.6 : 1,
            }}
          >
            🎨 Or generate an image with AI (uses current headline)
          </button>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{
              background: COLORS.accent,
              color: "white",
              width: "100%",
              marginTop: 10,
              padding: "11px 18px",
              borderRadius: 8,
              border: "none",
              fontWeight: 600,
              cursor: isGenerating ? "not-allowed" : "pointer",
              opacity: isGenerating ? 0.6 : 1,
            }}
          >
            ✨ Generate headline, summary & caption with AI
          </button>
          <div style={{ fontSize: 12.5, color: COLORS.muted, marginTop: 8, minHeight: 16 }}>{genStatus}</div>

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, margin: "16px 0 6px" }}>Headline</label>
          <textarea value={headline} onChange={(e) => setHeadline(e.target.value)} style={{ width: "100%", minHeight: 50, padding: "10px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8 }} />

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, margin: "16px 0 6px" }}>
            Summary (use **word** to highlight in cyan)
          </label>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} style={{ width: "100%", minHeight: 70, padding: "10px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8 }} />

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, margin: "16px 0 6px" }}>Caption</label>
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} style={{ width: "100%", minHeight: 70, padding: "10px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8 }} />

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, margin: "16px 0 6px" }}>Hashtags</label>
          <textarea value={hashtags} onChange={(e) => setHashtags(e.target.value)} style={{ width: "100%", minHeight: 50, padding: "10px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8 }} />
        </div>

        <div style={{ flex: "1 1 420px", minWidth: 340, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <canvas
            ref={canvasRef}
            style={{ width: "100%", maxWidth: 420, aspectRatio: "4 / 5", borderRadius: 8, border: `1px solid ${COLORS.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
          />
          <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 420 }}>
            <button onClick={handleDownload} style={{ flex: 1, background: COLORS.text, color: "white", padding: "11px 18px", borderRadius: 8, border: "none", fontWeight: 600, cursor: "pointer" }}>
              ⬇ Download poster
            </button>
            <button onClick={handleCopyCaption} style={{ flex: 1, background: "#e0f2fe", color: COLORS.accentDark, padding: "11px 18px", borderRadius: 8, border: "none", fontWeight: 600, cursor: "pointer" }}>
              📋 Copy caption
            </button>
          </div>
          <div style={{ fontSize: 12.5, color: COLORS.muted, minHeight: 16 }}>{downloadStatus}</div>
        </div>
      </div>
    </div>
  );
}
