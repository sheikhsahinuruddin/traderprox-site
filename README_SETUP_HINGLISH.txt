TraderProX AI for GitHub Pages + Cloudflare Worker backend

WHY THIS SETUP
GitHub Pages only serves static files. It cannot securely hide a Gemini API key or run a private backend. This package keeps index.html on GitHub Pages and uses a Cloudflare Worker as the secure API proxy.

FILES
- index.html: frontend UI; no Gemini API key inside it.
- worker.js: backend code to paste into Cloudflare Workers.
- README_SETUP_HINGLISH.txt: instructions.

ONE-TIME SETUP
1. Revoke the API key previously shared in chat. Create a fresh key in Google AI Studio.
2. Go to https://dash.cloudflare.com/ and create a Worker (Workers & Pages -> Create -> Worker).
3. Open the Worker editor, replace its sample code with the full contents of worker.js, and Deploy.
4. In the Worker settings, add a SECRET named GEMINI_API_KEY with your NEW Gemini key.
5. Optional: add a plain-text variable GEMINI_MODEL with a model ID that is available to your Google AI Studio API project. Default is gemini-2.5-flash; fallback is gemini-2.0-flash. Model availability changes, so check the model list shown by your API project if it errors.
6. Copy the Worker URL, usually like https://your-worker-name.your-account.workers.dev
7. Open index.html in a text editor and find:
   PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE
   Replace that exact text with your Worker URL. Do not add the Gemini key to this file.
8. Upload the updated index.html to the root of the GitHub repository used by GitHub Pages and commit it.
9. Open https://traderprox.site over HTTPS and test chat. Do not test from content:// local file.
10. If it fails, open the Worker dashboard logs and inspect the error. The UI will show an error rather than wait forever.

SECURITY / LIMITATIONS
- Visitors do not need their own API key.
- Gemini key must exist only as a Cloudflare Worker Secret.
- The Worker endpoint is public; consider adding rate limiting / Cloudflare Turnstile before sharing widely, otherwise strangers can consume your API quota.
- This package does not connect live NSE, crypto, or gold prices. Market cards are sample-only.
- Gemini free tier, model availability, and quotas may change.
