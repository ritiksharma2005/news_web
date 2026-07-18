# News.nit_iit — Poster Maker (Web)

A private web app: paste any news text (and optionally upload an image), get an AI-drafted headline/summary/caption, preview the poster live, and download it — same design as the Telegram pipeline.

## Local development

```bash
npm install
cp .env.example .env.local
# edit .env.local with your real keys
npm run dev
```

Open http://localhost:3000

## Deploying to Vercel

1. Push this folder to a GitHub repo (a **new, separate** repo from your Python pipeline repo — this is a different project)
2. Go to **vercel.com**, sign in (GitHub login works), click **"Add New" → "Project"**
3. Import your GitHub repo
4. Before deploying, expand **"Environment Variables"** and add:
   - `GEMINI_API_KEY` — your Gemini key
   - `GROQ_API_KEY` — your Groq key
   - `SITE_PASSWORD` — any password you choose (this is what protects the site since it's just for you)
5. Click **Deploy**

Vercel will build and give you a live URL (something like `your-project.vercel.app`) within a minute or two.

## Using the site

1. Open your Vercel URL
2. Enter the site password you set (top of the form)
3. Paste a news article or a few bullet points
4. Choose language (English/Hindi)
5. Optionally upload a real image
6. Click **"Generate headline, summary & caption with AI"**
7. Edit any field if you want
8. **Download poster** to save the image, **Copy caption** to grab the caption + hashtags for posting

## Updating later

Any time you want to change the design or add features, edit the files and push to GitHub — Vercel automatically redeploys on every push to your main branch.

## Notes

- The password check is basic (not full authentication) — good enough for personal/private use, not for a public product.
- If you ever want stronger security (real login), that's a bigger addition — ask if you want that built.
