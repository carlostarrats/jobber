# Jobber

Free job board for designers. Automatically scrapes design roles from Greenhouse, Lever, and Ashby — no accounts, no fees.

## How it works

1. **Discovery** — A monthly script uses SerpAPI to find companies posting design jobs across Greenhouse, Lever, and Ashby
2. **Scraping** — A weekly script hits the free public APIs for each platform, filters for design roles, and outputs `jobs.json`
3. **Website** — A static Next.js site reads `jobs.json` at build time and deploys to Vercel for free

The whole thing runs hands-free via GitHub Actions.

## Project structure

```
scraper/
  discover_companies.py   # Phase 1: find companies via SerpAPI
  scrape_jobs.py          # Phase 2: scrape jobs from public APIs
  companies.json          # discovered company slugs
  jobs.json               # scraped job listings

web/
  src/app/page.tsx        # job board UI (Next.js + shadcn/ui)
  src/data/jobs.json      # copied from scraper at build time

.github/workflows/
  discover.yml            # monthly company discovery
  scrape.yml              # weekly job scraping + deploy
```

## Setup

### Scraper

```bash
cd scraper
pip install -r requirements.txt

# Discover companies (needs free SerpAPI key from serpapi.com)
export SERPAPI_KEY="your_key"
python discover_companies.py

# Scrape jobs (no key needed)
python scrape_jobs.py
```

### Website

```bash
cd web
npm install
npm run dev       # localhost:3000
npm run build     # production build (auto-copies jobs.json from scraper)
```

### Automation

1. Add `SERPAPI_KEY` as a GitHub repository secret
2. Connect the repo to Vercel
3. GitHub Actions handles the rest — discovers companies monthly, scrapes jobs weekly, and pushes updates that trigger Vercel rebuilds
