# jamwithme.lol

Single-page demo reel and riff archive built for Cloudflare Pages + Cloudflare R2 (supports both video and audio clips).

## Project Structure

```text
jamwithme/
├── index.html              # Full Trinitron CRT & J-Card UI + mobile upload drawer
├── functions/
│   └── api/
│       └── tapes.js        # Cloudflare Pages Function for R2 listing, streaming, upload, and delete
└── README.md
```

## Setup on Cloudflare

1. **Create R2 Bucket:** In Cloudflare Dashboard -> **R2 Object Storage**, create a bucket named `jamwithme-clips`.
2. **Deploy to Pages:** Unzip and drag the `jamwithme` folder into **Workers & Pages -> Create -> Pages -> Direct Upload** (or push to GitHub with Framework preset: `None`, Build command: empty, Output directory: `/`).
3. **Configure Bindings & Secrets:**
   - **Settings -> Bindings:** Add an **R2 bucket** binding named `CLIPS_BUCKET` pointing to `jamwithme-clips`.
   - **Settings -> Variables and Secrets:** Add a Secret named `UPLOAD_PIN` with your chosen PIN.
4. **Redeploy & Connect Domain:** Trigger a redeploy so the bindings take effect, then add `jamwithme.lol` under **Custom domains**.
