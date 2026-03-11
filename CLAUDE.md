# Jobber

Free design job board that scrapes listings from Greenhouse, Lever, and Ashby.

## Architecture

- **scraper/** — Python scripts that discover companies and scrape job listings
  - `discover_companies.py` — Uses SerpAPI to find company slugs via Google dorking
  - `expand_companies.py` — Bulk expands companies.json with ~500 curated tech company slugs, validates each against public APIs using ThreadPoolExecutor (5 workers per platform), merges valid ones. No API keys needed.
  - `scrape_jobs.py` — Hits public JSON APIs for Greenhouse, Lever, Ashby; filters for design roles; outputs `jobs.json`
  - No database — everything is flat JSON files (`companies.json`, `jobs.json`)

- **web/** — Next.js 16 + shadcn/ui static site
  - Reads `jobs.json` at build time (copied from scraper via `prebuild` script)
  - Client-side search and filtering (role, location, date)
  - Deployed on Vercel (free tier)

- **.github/workflows/** — GitHub Actions automation
  - `discover.yml` — Monthly company discovery via SerpAPI
  - `scrape.yml` — Weekly job scraping, commits updated data, triggers Vercel rebuild

## Key decisions

- Zero cost — no paid APIs for scraping (Greenhouse/Lever/Ashby endpoints are public), free tiers for SerpAPI, GitHub Actions, and Vercel
- Static site — jobs.json is baked in at build time, no server or database needed
- Company slugs are the key identifier — extracted from URLs like `boards.greenhouse.io/{slug}`
- Jobs older than 30 days are always hidden from the UI
- Only US-based jobs are scraped (non-US locations filtered out at scrape time)
- Only two role types: UX Designer and Product Designer (with any level prefix like Senior, Lead, Principal)

## Scraper API endpoints

- **Greenhouse**: `GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs` — public JSON API, no auth
- **Lever**: `GET https://api.lever.co/v0/postings/{slug}` — public JSON API, no auth
- **Ashby**: `GET https://api.ashbyhq.com/posting-api/job-board/{slug}` — public GET endpoint, no auth
  - Note: Ashby previously used a POST endpoint with `{"jobBoardId": slug}` which now returns 401. The GET endpoint is the correct approach.

## Scraper details

- `extract_city()` strips parentheticals like "(Hybrid)", "(HQ)" and "Remote (US)" prefixes before extracting city names
- Company URLs: Greenhouse uses `boards.greenhouse.io/{slug}`, Lever uses `jobs.lever.co/{slug}`, Ashby uses `jobs.ashbyhq.com/{slug}`
- Ashby provides an `isRemote` boolean field; Greenhouse and Lever infer remote from location strings
- 0.5s delay between companies (politeness)
- No API keys needed for scraping — only `discover_companies.py` needs SERPAPI_KEY

## Frontend features

- **Numbered job cards** — Each job has a row number for easy reference
- **Date sections** — Jobs grouped by posted date with date header and dotted line separator (larger font, generous spacing between sections)
- **Search** — Searches job title, company, and location. Metro area expansion: searching a major city name (e.g., "Los Angeles", "San Francisco", "New York", "Seattle", "Chicago") also matches jobs in surrounding suburbs and satellite cities. 25 metro areas defined with comprehensive suburb lists.
- **Role filter** — Product Designer, UX Designer
- **Location filter** — "All locations", "In-person", "Remote", plus metro area filters (NYC, LA, SF Bay Area, Seattle, Chicago). All jobs are US-based (filtered at scrape time)
- **Date filter** — "Last 7 days", "Last 30 days" (default). Jobs older than 30 days are always excluded
- **Save** — Click "Save" on any job to bookmark it. "View saved" button in header shows saved jobs. Persisted in localStorage
- **Company links** — Company name links to their job board page with a chain-link icon
- **City column** — Separate fixed-width column on desktop (right-aligned before buttons), wraps under company name on mobile
- **Job title** — Plain text (not a link). "View" button links to the job posting

## UI design

- Slate-200 to slate-300 gradient background
- White/50 job cards with hover to white/70
- Dark gray (gray-800) filter inputs and hover states on buttons
- Buttons: "View" (outline) and "Save" (outline, transparent bg, dark on hover)
- Centered Jobber logo with "View saved" absolutely positioned to the right on desktop, stacked below last-scraped text on mobile
- Full-width 4-column filter grid on desktop, single column on mobile
- Geist font, AA accessible colors
- Select chevrons styled white/60 for visibility on dark backgrounds

## Development

```bash
# Scraper
cd scraper && pip install -r requirements.txt
export SERPAPI_KEY="your_key"
python discover_companies.py   # find companies via SerpAPI
python expand_companies.py     # bulk expand with curated slugs (no API key needed)
python scrape_jobs.py          # scrape jobs

# Web
cd web && npm install && npm run dev   # localhost:3000
npm run refresh                        # copy latest jobs.json from scraper
```

## Tech stack

- Python 3.12, requests, serpapi
- Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui
