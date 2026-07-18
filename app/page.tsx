"use client";

import { useRef, useState, useCallback, useEffect } from "react";

const COLORS = {
  bg: "#f7f0dc",
  text: "#141414",
  muted: "#5a5a5a",
  accent: "#d85a30",
  accentDark: "#993c1d",
  accentTint: "#faece7",
  border: "#e6e6e6",
  placeholder: "#e1e1e1",
};

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
  const [genStatus, setGenStatus] = useState("");
  const [downloadStatus, setDownloadStatus] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [sitePassword, setSitePassword] = useState("");

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setUploadedImage(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => setUploadedImage(img);
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const renderCard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const displayHeadline = headline || "Your headline goes here";
    const displaySummary = summary || "Your 2-3 line summary will appear here once generated.";
    const fontFamily = language === "hi" ? '"Nirmala UI","Noto Sans Devanagari",sans-serif' : "-apple-system,\"Segoe UI\",Roboto,sans-serif";

    const W = 1080;
    const paddingX = 40;

    let y = 14;
    y += 70 + 20;
    const headlineFont = `bold 50px ${fontFamily}`;
    const emojiPrefixWidth = 70;
    const headlineLines = wrapText(ctx, displayHeadline, headlineFont, W - paddingX * 2 - emojiPrefixWidth);
    const headlineLineHeight = 61;
    y += 25 + headlineLines.length * headlineLineHeight + 15 + 25;

    const imageBlockHeight = 480;
    y += imageBlockHeight;

    const summaryFont = `34px ${fontFamily}`;
    const summaryMaxWidth = W - paddingX * 2 - 10 - 60;
    const summaryLines = wrapText(ctx, displaySummary, summaryFont, summaryMaxWidth);
    const summaryLineHeight = 51;
    const summaryBoxPadding = 30;
    const summaryBoxHeight = Math.min(summaryLines.length, 4) * summaryLineHeight + summaryBoxPadding * 2;
    const summaryBoxTop = y + 25;
    y = summaryBoxTop + summaryBoxHeight;

    const footerBottom = y + 45 + 45 + 40;
    const finalHeight = Math.max(1080, footerBottom + 20);

    canvas.width = W;
    canvas.height = finalHeight;

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, finalHeight);

    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(0, 0, W, 14);

    let cy = 14;
    const barHeight = 70;
    ctx.font = `bold 34px ${fontFamily}`;
    ctx.fillStyle = COLORS.text;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText("News.nit_iit", paddingX, cy + barHeight / 2);

    ctx.font = `bold 30px ${fontFamily}`;
    ctx.fillStyle = COLORS.accentDark;
    ctx.textAlign = "right";
    ctx.fillText("2026", W - paddingX, cy + barHeight / 2);

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

    cy += 25;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "48px sans-serif";
    ctx.fillText(emoji || "📩", paddingX, cy + 40);
    ctx.font = headlineFont;
    ctx.fillStyle = COLORS.text;
    headlineLines.forEach((line, i) => {
      const x = i === 0 ? paddingX + emojiPrefixWidth : paddingX;
      ctx.fillText(line, x, cy + 40);
      cy += headlineLineHeight;
    });
    cy += 15;
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(paddingX, cy);
    ctx.lineTo(paddingX + 140, cy);
    ctx.stroke();
    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(paddingX + 150, cy);
    ctx.lineTo(W - paddingX, cy);
    ctx.stroke();
    cy += 25;

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

    const boxTop = cy + 25;
    const boxRight = W - paddingX;
    roundRect(ctx, paddingX, boxTop, boxRight - paddingX, summaryBoxHeight, 16);
    ctx.fillStyle = COLORS.accentTint;
    ctx.fill();
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    roundRect(ctx, paddingX, boxTop, 26, summaryBoxHeight, 16);
    ctx.fillStyle = COLORS.accent;
    ctx.fill();
    ctx.fillRect(paddingX + 10, boxTop, 16, summaryBoxHeight);

    ctx.font = summaryFont;
    ctx.fillStyle = COLORS.accentDark;
    ctx.textBaseline = "alphabetic";
    let ty = boxTop + summaryBoxPadding + 24;
    summaryLines.slice(0, 4).forEach((line) => {
      ctx.fillText(line, paddingX + 40, ty);
      ty += summaryLineHeight;
    });

    const summaryBottom = boxTop + summaryBoxHeight;
    const separatorY = summaryBottom + 45;
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, separatorY);
    ctx.lineTo(W - 80, separatorY);
    ctx.stroke();

    const footerTextY = separatorY + 45;
    const footerEmoji = "📸";
    const handle = "@news.nit_iit";
    ctx.font = "bold 32px " + fontFamily;
    const handleWidth = ctx.measureText(handle).width;
    ctx.font = "36px sans-serif";
    const emojiWidth = ctx.measureText(footerEmoji).width;
    const gap = 12;
    const totalWidth = emojiWidth + gap + handleWidth;
    const startX = (W - totalWidth) / 2;

    ctx.textAlign = "left";
    ctx.font = "36px sans-serif";
    ctx.fillText(footerEmoji, startX, footerTextY + 10);
    ctx.font = "bold 32px " + fontFamily;
    ctx.fillStyle = COLORS.accentDark;
    ctx.fillText(handle, startX + emojiWidth + gap, footerTextY + 10);
  }, [headline, summary, language, emoji, uploadedImage]);

  useEffect(() => {
    renderCard();
  }, [renderCard]);

  const handleGenerate = async () => {
    if (!rawText.trim()) {
      setGenStatus("Paste some news text first.");
      return;
    }
    setIsGenerating(true);
    setGenStatus("Generating...");

    try {
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-site-password": sitePassword,
        },
        body: JSON.stringify({ rawText, language }),
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

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{
              background: COLORS.accent,
              color: "white",
              width: "100%",
              marginTop: 18,
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

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, margin: "16px 0 6px" }}>Summary</label>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} style={{ width: "100%", minHeight: 70, padding: "10px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8 }} />

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, margin: "16px 0 6px" }}>Caption</label>
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} style={{ width: "100%", minHeight: 70, padding: "10px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8 }} />

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, margin: "16px 0 6px" }}>Hashtags</label>
          <textarea value={hashtags} onChange={(e) => setHashtags(e.target.value)} style={{ width: "100%", minHeight: 50, padding: "10px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8 }} />
        </div>

        <div style={{ flex: "1 1 420px", minWidth: 340, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <canvas
            ref={canvasRef}
            style={{ width: "100%", maxWidth: 420, borderRadius: 8, border: `1px solid ${COLORS.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
          />
          <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 420 }}>
            <button onClick={handleDownload} style={{ flex: 1, background: COLORS.text, color: "white", padding: "11px 18px", borderRadius: 8, border: "none", fontWeight: 600, cursor: "pointer" }}>
              ⬇ Download poster
            </button>
            <button onClick={handleCopyCaption} style={{ flex: 1, background: COLORS.accentTint, color: COLORS.accentDark, padding: "11px 18px", borderRadius: 8, border: "none", fontWeight: 600, cursor: "pointer" }}>
              📋 Copy caption
            </button>
          </div>
          <div style={{ fontSize: 12.5, color: COLORS.muted, minHeight: 16 }}>{downloadStatus}</div>
        </div>
      </div>
    </div>
  );
}
