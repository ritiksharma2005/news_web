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
  placeholder: "#e2e8f0",
};

interface SummaryWord {
  text: string;
  isHighlighted: boolean;
}

interface SummaryLine {
  words: SummaryWord[];
}

function parseSummaryTokens(text: string): { text: string; isHighlighted: boolean }[] {
  const tokens: { text: string; isHighlighted: boolean }[] = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        text: text.slice(lastIndex, match.index),
        isHighlighted: false,
      });
    }
    const cleanText = match[0].replace(/^\*+|\*+$/g, "");
    tokens.push({
      text: cleanText,
      isHighlighted: true,
    });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    tokens.push({
      text: text.slice(lastIndex),
      isHighlighted: false,
    });
  }
  return tokens;
}

function getSummaryWords(text: string): SummaryWord[] {
  const tokens = parseSummaryTokens(text);
  const words: SummaryWord[] = [];
  for (const t of tokens) {
    const splitWords = t.text.trim().split(/\s+/);
    for (const w of splitWords) {
      if (w) {
        words.push({ text: w, isHighlighted: t.isHighlighted });
      }
    }
  }
  return words;
}

function wrapSummaryWords(
  ctx: CanvasRenderingContext2D,
  words: SummaryWord[],
  font: string,
  maxWidth: number
): SummaryLine[] {
  ctx.font = font;
  const spaceWidth = ctx.measureText(" ").width;
  const lines: SummaryLine[] = [];
  let currentLine: SummaryWord[] = [];
  let currentLineWidth = 0;

  for (const w of words) {
    const wordWidth = ctx.measureText(w.text).width;
    const addedWidth = currentLine.length === 0 ? wordWidth : spaceWidth + wordWidth;

    if (currentLineWidth + addedWidth <= maxWidth || currentLine.length === 0) {
      currentLine.push(w);
      currentLineWidth += addedWidth;
    } else {
      lines.push({ words: currentLine });
      currentLine = [w];
      currentLineWidth = wordWidth;
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
  const [sitePassword, setSitePassword] = useState("");
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

  // Password verification (1020)
  const isUnlocked = sitePassword.trim() === "1020";

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isUnlocked) return;
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
    if (!isUnlocked) {
      setGenStatus("Enter password to unlock.");
      return;
    }
    if (!headline.trim()) {
      setGenStatus("Add a headline first (generate text or type one), then generate an image.");
      return;
    }
    setIsGeneratingImage(true);
    setGenStatus("Generating illustration...");
    try {
      const resp = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-site-password": sitePassword.trim() },
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

    // Clean dummy defaults
    const displayHeadline = headline || "Sample News Headline — Catchy Large Title for Full Context";
    const displaySummary =
      summary ||
      "This is a **sample summary**. Add key details here to highlight **important updates** and **numbers** in cyan.";
    const fontFamily = language === "hi" ? '"Nirmala UI","Noto Sans Devanagari",sans-serif' : "-apple-system,\"Segoe UI\",Roboto,sans-serif";

    // Strictly fixed 1:1 Aspect Ratio (1080 x 1080 px Square)
    const W = 1080;
    const H = 1080;
    const paddingX = 40;

    canvas.width = W;
    canvas.height = H;

    // Background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // 1. Top Accent Stripe
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(0, 0, W, 14);

    // 2. Top Header Bar
    let cy = 14;
    const barHeight = 46;
    ctx.font = `bold 32px ${fontFamily}`;
    ctx.fillStyle = COLORS.text;
    ctx.textBaseline = "middle";

    // Top Left: 2026
    ctx.textAlign = "left";
    ctx.fillText("2026", paddingX, cy + barHeight / 2);

    // Top Right: news.nit_iit
    ctx.textAlign = "right";
    ctx.fillText("news.nit_iit", W - paddingX, cy + barHeight / 2);

    cy += barHeight;
    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(W, cy);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, cy + 8);
    ctx.lineTo(W, cy + 8);
    ctx.stroke();

    // 3. CENTER-ALIGNED HEADLINE SLOT (Starts at y = 75px, Underline at y = 224px)
    const headlineSlotTop = 75;
    const underlineY = 224;
    const availableSlotH = underlineY - headlineSlotTop; // 149px
    const maxHeadlineWidth = W - paddingX * 2; // 1000px

    let headlineFontSize = 44;
    let headlineLines: string[] = [];

    while (headlineFontSize >= 28) {
      const testFont = `900 ${headlineFontSize}px ${fontFamily}`;
      headlineLines = wrapText(ctx, displayHeadline, testFont, maxHeadlineWidth);
      if (headlineLines.length <= 3) break;
      headlineFontSize -= 2;
    }

    if (headlineLines.length > 3) {
      headlineLines = headlineLines.slice(0, 3);
      let thirdLine = headlineLines[2];
      const testFont = `900 ${headlineFontSize}px ${fontFamily}`;
      ctx.font = testFont;
      while (thirdLine.length > 0 && ctx.measureText(thirdLine + "...").width > maxHeadlineWidth) {
        thirdLine = thirdLine.slice(0, -1);
      }
      headlineLines[2] = thirdLine.trim() + "...";
    }

    const selectedHeadlineFont = `900 ${headlineFontSize}px ${fontFamily}`;
    const headlineLineHeight = headlineFontSize + 8;
    const headlineEmoji = emoji || "📩";

    const totalHeadlineH = (headlineLines.length - 1) * headlineLineHeight + headlineFontSize;
    const startY = headlineSlotTop + Math.max(0, (availableSlotH - totalHeadlineH) / 2);

    ctx.textBaseline = "top";

    if (headlineLines.length > 0) {
      const emojiFontSize = Math.min(headlineFontSize, 42);
      ctx.font = `${emojiFontSize}px sans-serif`;
      const emojiW = ctx.measureText(headlineEmoji).width;
      const emojiGap = 12;

      ctx.font = selectedHeadlineFont;
      const text0W = ctx.measureText(headlineLines[0]).width;
      const line0TotalW = emojiW + emojiGap + text0W;
      const line0StartX = (W - line0TotalW) / 2;

      // Draw Emoji for line 0
      ctx.font = `${emojiFontSize}px sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(headlineEmoji, line0StartX, startY);

      // Draw Line 0 text
      ctx.font = selectedHeadlineFont;
      ctx.fillStyle = COLORS.text;
      ctx.fillText(headlineLines[0], line0StartX + emojiW + emojiGap, startY);

      // Lines 1 & 2 centered at W / 2
      for (let i = 1; i < headlineLines.length; i++) {
        const yPos = startY + i * headlineLineHeight;
        ctx.font = selectedHeadlineFont;
        ctx.textAlign = "center";
        ctx.fillStyle = COLORS.text;
        ctx.fillText(headlineLines[i], W / 2, yPos);
      }
    }

    // Accent Underline Bar at y = 224 (Centered)
    const centerBarW = 260;
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo((W - centerBarW) / 2, underlineY);
    ctx.lineTo((W + centerBarW) / 2, underlineY);
    ctx.stroke();

    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(paddingX, underlineY);
    ctx.lineTo((W - centerBarW) / 2 - 15, underlineY);
    ctx.moveTo((W + centerBarW) / 2 + 15, underlineY);
    ctx.lineTo(W - paddingX, underlineY);
    ctx.stroke();

    // 4. FIXED IMAGE BLOCK (Y: 236 to 716, Height: 480px, Width: 1080px)
    const imageBlockY = 236;
    const imageBlockHeight = 480;

    if (uploadedImage) {
      drawImageCover(ctx, uploadedImage, 0, imageBlockY, W, imageBlockHeight);
    } else {
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(0, imageBlockY, W, imageBlockHeight);
    }

    // 5. CLEAN LEFT-ALIGNED SUMMARY BOX (Y: 730 to 995, Height: 265px, Width: 1000px)
    const summaryBoxTop = 730;
    const summaryBoxHeight = 265;
    const boxWidth = W - paddingX * 2;

    roundRect(ctx, paddingX, summaryBoxTop, boxWidth, summaryBoxHeight, 14);
    ctx.fillStyle = COLORS.accentTint;
    ctx.fill();
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.stroke();

    roundRect(ctx, paddingX, summaryBoxTop, 18, summaryBoxHeight, 14);
    ctx.fillStyle = COLORS.accent;
    ctx.fill();
    ctx.fillRect(paddingX + 6, summaryBoxTop, 12, summaryBoxHeight);

    const summaryFont = `bold 28px ${fontFamily}`;
    const summaryMaxWidth = boxWidth - 56;
    const words = getSummaryWords(displaySummary);
    const summaryLines = wrapSummaryWords(ctx, words, summaryFont, summaryMaxWidth);
    const summaryLineHeight = 38;

    ctx.font = summaryFont;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let ty = summaryBoxTop + 24;
    const maxSummaryLines = Math.floor((summaryBoxHeight - 32) / summaryLineHeight);

    summaryLines.slice(0, maxSummaryLines).forEach((line) => {
      let tx = paddingX + 36; // Clean left alignment at x = 76px
      line.words.forEach((w) => {
        ctx.font = summaryFont;
        const isPunctuation = /^[.,!?:;)]+$/.test(w.text);
        const spaceW = ctx.measureText(" ").width;
        if (isPunctuation && tx > paddingX + 36 + 10) {
          tx -= spaceW;
        }
        ctx.fillStyle = w.isHighlighted ? COLORS.accent : COLORS.text;
        ctx.fillText(w.text, tx, ty);
        const wordW = ctx.measureText(w.text).width;
        tx += wordW + spaceW;
      });
      ty += summaryLineHeight;
    });

    // 6. STRICTLY FIXED FOOTER (Separator Y: 1014, Text Y: 1042)
    const footerSeparatorY = 1014;
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, footerSeparatorY);
    ctx.lineTo(W - 80, footerSeparatorY);
    ctx.stroke();

    const footerTextY = 1042;
    const footerEmoji = "📷";
    const handle = "@news.nit_iit";
    ctx.font = "bold 28px " + fontFamily;
    const handleWidth = ctx.measureText(handle).width;
    ctx.font = "28px sans-serif";
    const footerEmojiWidth = ctx.measureText(footerEmoji).width;
    const footerGap = 10;
    const footerTotalWidth = footerEmojiWidth + footerGap + handleWidth;
    const footerStartX = (W - footerTotalWidth) / 2;

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "28px sans-serif";
    ctx.fillText(footerEmoji, footerStartX, footerTextY);
    ctx.font = "bold 28px " + fontFamily;
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(handle, footerStartX + footerEmojiWidth + footerGap, footerTextY);
  }, [headline, summary, language, emoji, uploadedImage]);

  useEffect(() => {
    renderCard();
  }, [renderCard]);

  const handleGenerate = async () => {
    if (!isUnlocked) {
      setGenStatus("Enter password to unlock.");
      return;
    }
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
          "x-site-password": sitePassword.trim(),
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
    if (!isUnlocked) return;
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
    if (!isUnlocked) return;
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
          <p style={{ color: COLORS.muted, fontSize: 13, margin: "0 0 20px" }}>Enter password to unlock the system.</p>

          <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: isUnlocked ? "#047857" : "#b91c1c" }}>
            Site password {isUnlocked ? "🔑 (Unlocked)" : "🔒"}
          </label>
          <input
            type="password"
            value={sitePassword}
            onChange={(e) => setSitePassword(e.target.value)}
            placeholder="Enter site password..."
            style={{
              width: "100%",
              padding: "10px 12px",
              border: `2px solid ${isUnlocked ? "#059669" : sitePassword ? "#dc2626" : COLORS.border}`,
              borderRadius: 8,
              marginBottom: 4,
              outline: "none",
              fontSize: 14,
            }}
          />
          <div style={{ fontSize: 12, marginBottom: 16, fontWeight: 600, color: isUnlocked ? "#059669" : sitePassword ? "#dc2626" : "#d97706" }}>
            {isUnlocked
              ? "✅ Password correct — all controls unlocked!"
              : sitePassword
              ? "❌ Incorrect password."
              : "🔒 Enter password to activate controls."}
          </div>

          <div style={{ opacity: isUnlocked ? 1 : 0.45, pointerEvents: isUnlocked ? "auto" : "none", transition: "opacity 0.2s" }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Paste news article or key details</label>
            <textarea
              value={rawText}
              disabled={!isUnlocked}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={isUnlocked ? "Paste the raw news text..." : "🔒 Enter password first..."}
              style={{ width: "100%", minHeight: 90, padding: "10px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8 }}
            />

            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Language</label>
                <select
                  value={language}
                  disabled={!isUnlocked}
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
                  disabled={!isUnlocked}
                  onChange={(e) => setEmoji(e.target.value)}
                  maxLength={4}
                  style={{ width: 70, textAlign: "center", padding: "10px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8 }}
                />
              </div>
            </div>

            <label style={{ display: "block", fontSize: 13, fontWeight: 600, margin: "16px 0 6px" }}>Upload image (optional)</label>
            <input type="file" accept="image/*" disabled={!isUnlocked} onChange={handleImageUpload} />

            {uploadedImageBase64 && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 10 }}>
                <input
                  type="checkbox"
                  disabled={!isUnlocked}
                  checked={extractTextFromImage}
                  onChange={(e) => setExtractTextFromImage(e.target.checked)}
                />
                This image is a news article/poster — read the text from it
              </label>
            )}

            <button
              onClick={handleGenerateImage}
              disabled={!isUnlocked || isGeneratingImage}
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
                cursor: !isUnlocked || isGeneratingImage ? "not-allowed" : "pointer",
                opacity: !isUnlocked || isGeneratingImage ? 0.6 : 1,
              }}
            >
              🎨 Or generate an image with AI (uses current headline)
            </button>

            <button
              onClick={handleGenerate}
              disabled={!isUnlocked || isGenerating}
              style={{
                background: COLORS.accent,
                color: "white",
                width: "100%",
                marginTop: 10,
                padding: "11px 18px",
                borderRadius: 8,
                border: "none",
                fontWeight: 600,
                cursor: !isUnlocked || isGenerating ? "not-allowed" : "pointer",
                opacity: !isUnlocked || isGenerating ? 0.6 : 1,
              }}
            >
              ✨ Generate headline, summary & caption with AI
            </button>
            <div style={{ fontSize: 12.5, color: COLORS.muted, marginTop: 8, minHeight: 16 }}>{genStatus}</div>

            <label style={{ display: "block", fontSize: 13, fontWeight: 600, margin: "16px 0 6px" }}>Headline</label>
            <textarea value={headline} disabled={!isUnlocked} onChange={(e) => setHeadline(e.target.value)} style={{ width: "100%", minHeight: 50, padding: "10px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8 }} />

            <label style={{ display: "block", fontSize: 13, fontWeight: 600, margin: "16px 0 6px" }}>
              Summary (use **word** to highlight in cyan)
            </label>
            <textarea value={summary} disabled={!isUnlocked} onChange={(e) => setSummary(e.target.value)} style={{ width: "100%", minHeight: 70, padding: "10px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8 }} />

            <label style={{ display: "block", fontSize: 13, fontWeight: 600, margin: "16px 0 6px" }}>Caption</label>
            <textarea value={caption} disabled={!isUnlocked} onChange={(e) => setCaption(e.target.value)} style={{ width: "100%", minHeight: 70, padding: "10px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8 }} />

            <label style={{ display: "block", fontSize: 13, fontWeight: 600, margin: "16px 0 6px" }}>Hashtags</label>
            <textarea value={hashtags} disabled={!isUnlocked} onChange={(e) => setHashtags(e.target.value)} style={{ width: "100%", minHeight: 50, padding: "10px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8 }} />
          </div>
        </div>

        <div style={{ flex: "1 1 420px", minWidth: 340, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <canvas
            ref={canvasRef}
            style={{ width: "100%", maxWidth: 420, aspectRatio: "1 / 1", borderRadius: 8, border: `1px solid ${COLORS.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
          />
          <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 420 }}>
            <button onClick={handleDownload} disabled={!isUnlocked} style={{ flex: 1, background: isUnlocked ? COLORS.text : "#9ca3af", color: "white", padding: "11px 18px", borderRadius: 8, border: "none", fontWeight: 600, cursor: isUnlocked ? "pointer" : "not-allowed" }}>
              ⬇ Download poster
            </button>
            <button onClick={handleCopyCaption} disabled={!isUnlocked} style={{ flex: 1, background: "#e0f2fe", color: COLORS.accentDark, padding: "11px 18px", borderRadius: 8, border: "none", fontWeight: 600, cursor: isUnlocked ? "pointer" : "not-allowed" }}>
              📋 Copy caption
            </button>
          </div>
          <div style={{ fontSize: 12.5, color: COLORS.muted, minHeight: 16 }}>{downloadStatus}</div>
        </div>
      </div>
    </div>
  );
}
