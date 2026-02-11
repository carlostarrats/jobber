# Jobber

Free design job board that scrapes listings from Greenhouse, Lever, and Ashby.

## Architecture

- **scraper/** — Python scripts that discover companies and scrape job listings
  - `discover_companies.py` — Uses SerpAPI to find company slugs via Google dorking
  - `scrape_jobs.py` — Hits public JSON APIs for Greenhouse, Lever, Ashby; filters for design roles; outputs `jobs.json`
  - No database — everything is flat JSON files (`companies.json`, `jobs.json`)

- **web/** — Next.js 16 + shadcn/ui static site
  - Reads `jobs.json` at build time (copied from scraper via `prebuild` script)
  - Client-side search and filtering (role, platform, remote)
  - Deployed on Vercel (free tier)

- **.github/workflows/** — GitHub Actions automation
  - `discover.yml` — Monthly company discovery via SerpAPI
  - `scrape.yml` — Weekly job scraping, commits updated data, triggers Vercel rebuild

## Key decisions

- Zero cost — no paid APIs for scraping (Greenhouse/Lever/Ashby endpoints are public), free tiers for SerpAPI, GitHub Actions, and Vercel
- Static site — jobs.json is baked in at build time, no server or database needed
- Company slugs are the key identifier — extracted from URLs like `boards.greenhouse.io/{slug}`

## Development

```bash
# Scraper
cd scraper && pip install -r requirements.txt
export SERPAPI_KEY="your_key"
python discover_companies.py   # find companies
python scrape_jobs.py          # scrape jobs

# Web
cd web && npm install && npm run dev   # localhost:3000
npm run refresh                        # copy latest jobs.json from scraper
```

## Tech stack

- Python 3.12, requests, serpapi
- Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui
