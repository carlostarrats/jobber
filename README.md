# Jobber

Free job board for designers. Automatically scrapes design roles from Greenhouse, Lever, and Ashby — no accounts, no fees.

![Jobber screenshot](screenshot.png)

## How it works

1. **Discovery** — A monthly script uses SerpAPI to find companies posting design jobs across Greenhouse, Lever, and Ashby
2. **Scraping** — A weekly script hits the free public APIs for each platform, filters for design roles, and outputs `jobs.json`
3. **Website** — A static Next.js site reads `jobs.json` at build time and deploys to Vercel for free

The whole thing runs hands-free via GitHub Actions.

## Features

- **420+ design jobs** from 162 companies across Greenhouse, Lever, and Ashby
- **Search** by job title, company, or location
- **Filter by role** — Product Design, UI/UX, Visual Design, UX Research, Content Design, Design Engineering, Design Systems, Brand Design, Web Design, Design Leadership
- **Filter by location** — All, US only, or Remote
- **Filter by date** — Today, last 7 days, last 30 days, or last 90 days
- **Save jobs** — Bookmark jobs you're interested in (persisted in browser)
- **Numbered listings** — Easy reference when browsing
- **Grouped by date** — Jobs organized by posting date with clear section headers
- **Company links** — Click through to each company's job board
- **Zero cost** — No database, no paid APIs, no server

## Project structure

```
scraper/
  discover_companies.py   # find companies via SerpAPI
  scrape_jobs.py          # scrape jobs from public APIs
  companies.json          # discovered company slugs
  jobs.json               # scraped job listings

web/
  src/app/page.tsx        # job board UI (Next.js + shadcn/ui)
  src/data/jobs.json      # copied from scraper at build time

.github/workflows/
  discover.yml            # monthly company discovery
  scrape.yml              # weekly job scraping + deploy
```

## Tech stack

- **Scraper**: Python 3.12, requests, google-search-results (SerpAPI)
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- **Hosting**: Vercel (free tier)
- **Automation**: GitHub Actions

## Setup

### Scraper

```bash
cd scraper
pip install -r requirements.txt

# Discover companies (needs free SerpAPI key from serpapi.com)
export SERPAPI_KEY="your_key"
python discover_companies.py

# Scrape jobs (no key needed — all endpoints are public)
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
2. Connect the repo to Vercel (root directory set to `web`, enable "Include files outside root directory")
3. GitHub Actions handles the rest — discovers companies monthly, scrapes jobs weekly, and pushes updates that trigger Vercel rebuilds

## License

MIT
