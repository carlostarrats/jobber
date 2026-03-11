"""
Phase 3: Job Scraper
Reads companies.json, hits the free public APIs for Greenhouse/Lever/Ashby,
filters for design roles, and writes jobs.json.

Usage:
  pip install requests
  python scrape_jobs.py

No API keys needed. All endpoints are public.
"""

import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

COMPANIES_FILE = Path(__file__).parent / "companies.json"
JOBS_FILE = Path(__file__).parent / "jobs.json"

# Only match UX Designer or Product Designer (with any level prefix)
TITLE_PATTERN = re.compile(
    r"\bux\s+designer\b"
    r"|\bproduct\s+designer\b",
    re.IGNORECASE)

# Role type categorization
ROLE_CATEGORIES = [
    (r"ux\s+designer", "ux_design"),
    (r"product\s+designer", "product_design"),
]

# --- US location detection ---
US_STATES = {
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
    "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
    "VA","WA","WV","WI","WY","DC",
}

US_KEYWORDS_RE = re.compile(r"\bunited states\b|\busa\b|\bu\.s\.?\b", re.IGNORECASE)

US_STATE_NAMES_RE = re.compile(
    r"\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|"
    r"florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|"
    r"maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|"
    r"nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|"
    r"north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|"
    r"south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|"
    r"wisconsin|wyoming)\b", re.IGNORECASE)

US_CITIES = {
    # Major metros
    "new york","new york city","nyc","manhattan","brooklyn","queens",
    "san francisco","sf","oakland","berkeley","palo alto","menlo park","mountain view",
    "san jose","sunnyvale","cupertino","santa clara","redwood city",
    "los angeles","santa monica","pasadena","burbank","culver city","venice",
    "seattle","bellevue","redmond","kirkland",
    "chicago","evanston",
    "boston","cambridge","somerville","waltham",
    "washington","washington dc",
    "austin","dallas","houston","san antonio","fort worth",
    "denver","boulder",
    "atlanta","decatur",
    "miami","fort lauderdale",
    "portland","philadelphia","pittsburgh",
    "phoenix","scottsdale","tempe",
    "minneapolis","saint paul","st paul",
    "raleigh","durham","charlotte",
    "detroit","ann arbor",
    "nashville","salt lake city","san diego","las vegas","sacramento",
    "indianapolis","columbus","cleveland","cincinnati",
    "milwaukee","madison","tampa","orlando","jacksonville",
    "richmond","arlington","alexandria","reston","bethesda",
    "irvine","costa mesa","playa vista","el segundo",
}


def is_us_location(location):
    """Check if a job location is in the United States. Remote jobs are included."""
    if not location or location == "Unknown":
        return False
    loc_lower = location.lower().strip()
    # Include remote jobs (most companies in our list are US-based)
    if loc_lower in ("remote", "anywhere", "remote, us", "remote - us",
                     "remote, usa", "remote - usa", "remote, united states"):
        return True
    if "remote" in loc_lower and ("us" in loc_lower or "united states" in loc_lower):
        return True
    if US_KEYWORDS_RE.search(location):
        return True
    if US_STATE_NAMES_RE.search(location):
        return True
    # State abbreviation after comma: "City, CA"
    abbrev = re.search(r",\s*([A-Z]{2})\b", location)
    if abbrev and abbrev.group(1) in US_STATES:
        return True
    if re.search(r"\bUS\s+[A-Z]{2}\b", location):
        return True
    city = location.split(",")[0].strip().lower().rstrip(".")
    city = re.sub(r"\s*(office|hq|headquarters)\s*$", "", city, flags=re.IGNORECASE).strip()
    if city in US_CITIES:
        return True
    return False

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "DesignJobBoard/1.0"})

# Cache for company website URLs (fetched once per company)
_company_url_cache = {}


def is_design_role(title):
    return bool(TITLE_PATTERN.search(title))


def categorize_role(title):
    title_lower = title.lower()
    for pattern, category in ROLE_CATEGORIES:
        if re.search(pattern, title_lower):
            return category
    return "other_design"


def extract_city(location):
    """Extract city name from location string."""
    if not location or location == "Unknown":
        return ""
    # Remove parenthetical suffixes like (Hybrid), (HQ), etc.
    city = re.sub(r"\s*\(.*?\)?\s*$", "", location).strip()
    # Take first part before comma
    city = city.split(",")[0].strip()
    # Remove "Remote - " or "Remote (" prefixes
    city = re.sub(r"^Remote\s*[-/(]\s*", "", city, flags=re.IGNORECASE)
    # Remove any remaining parentheses
    city = city.strip("() ").strip()
    # If the whole thing is just "Remote", return empty
    if city.lower().strip() in ("remote", "anywhere", "worldwide", "global"):
        return ""
    return city


def get_greenhouse_company_url(slug):
    """Return Greenhouse job board URL for the company."""
    if slug in _company_url_cache:
        return _company_url_cache[slug]
    url = f"https://boards.greenhouse.io/{slug}"
    _company_url_cache[slug] = url
    return url


def get_lever_company_url(slug):
    """Lever doesn't expose company URL in API, construct careers page."""
    if slug in _company_url_cache:
        return _company_url_cache[slug]
    url = f"https://jobs.lever.co/{slug}"
    _company_url_cache[slug] = url
    return url


def get_ashby_company_url(slug):
    """Ashby job board API may include company info."""
    if slug in _company_url_cache:
        return _company_url_cache[slug]
    url = f"https://jobs.ashbyhq.com/{slug}"
    _company_url_cache[slug] = url
    return url


def scrape_greenhouse(slug):
    """Greenhouse has a free public JSON API."""
    url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs"
    try:
        resp = SESSION.get(url, timeout=10)
        if resp.status_code != 200:
            return []
        data = resp.json()
        jobs = []
        company_url = None

        for job in data.get("jobs", []):
            title = job.get("title", "")
            if not is_design_role(title):
                continue

            # Lazy-fetch company URL only if we have design jobs
            if company_url is None:
                company_url = get_greenhouse_company_url(slug)

            location = job.get("location", {}).get("name", "Unknown")
            if not is_us_location(location):
                continue
            updated = job.get("updated_at", "")

            jobs.append({
                "id": f"gh-{slug}-{job.get('id', '')}",
                "title": title,
                "company": slug,
                "companyUrl": company_url,
                "location": location,
                "city": extract_city(location),
                "remote": "remote" in location.lower(),
                "url": job.get("absolute_url", f"https://boards.greenhouse.io/{slug}/jobs/{job.get('id', '')}"),
                "platform": "greenhouse",
                "roleType": categorize_role(title),
                "posted": updated[:10] if updated else "",
                "scraped": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            })
        return jobs
    except Exception as e:
        print(f"    Error scraping {slug}: {e}")
        return []


def scrape_lever(slug):
    """Lever has a free public JSON API."""
    url = f"https://api.lever.co/v0/postings/{slug}"
    try:
        resp = SESSION.get(url, timeout=10)
        if resp.status_code != 200:
            return []
        data = resp.json()
        jobs = []
        company_url = None

        for job in data:
            title = job.get("text", "")
            if not is_design_role(title):
                continue

            if company_url is None:
                company_url = get_lever_company_url(slug)

            location = job.get("categories", {}).get("location", "Unknown")
            if not is_us_location(location):
                continue
            commitment = job.get("categories", {}).get("commitment", "")
            created = job.get("createdAt", 0)
            posted = ""
            if created:
                posted = datetime.fromtimestamp(created / 1000, tz=timezone.utc).strftime("%Y-%m-%d")

            jobs.append({
                "id": f"lv-{slug}-{job.get('id', '')}",
                "title": title,
                "company": slug,
                "companyUrl": company_url,
                "location": location,
                "city": extract_city(location),
                "remote": "remote" in location.lower() or "remote" in commitment.lower(),
                "url": job.get("hostedUrl", f"https://jobs.lever.co/{slug}/{job.get('id', '')}"),
                "platform": "lever",
                "roleType": categorize_role(title),
                "posted": posted,
                "scraped": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            })
        return jobs
    except Exception as e:
        print(f"    Error scraping {slug}: {e}")
        return []


def scrape_ashby(slug):
    """Ashby has a public GET endpoint for job board listings."""
    url = f"https://api.ashbyhq.com/posting-api/job-board/{slug}"
    try:
        resp = SESSION.get(url, timeout=10)
        if resp.status_code != 200:
            return []
        data = resp.json()
        jobs_list = data.get("jobs", [])
        jobs = []
        company_url = None

        for job in jobs_list:
            title = job.get("title", "")
            if not is_design_role(title):
                continue

            if company_url is None:
                company_url = get_ashby_company_url(slug)

            location = job.get("location", "Unknown")
            if not is_us_location(location):
                continue
            is_remote = job.get("isRemote", False)
            published = job.get("publishedAt", "")

            jobs.append({
                "id": f"ab-{slug}-{job.get('id', '')}",
                "title": title,
                "company": slug,
                "companyUrl": company_url,
                "location": location,
                "city": extract_city(location),
                "remote": is_remote or "remote" in location.lower(),
                "url": job.get("jobUrl", f"https://jobs.ashbyhq.com/{slug}/{job.get('id', '')}"),
                "platform": "ashby",
                "roleType": categorize_role(title),
                "posted": published[:10] if published else "",
                "scraped": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            })
        return jobs
    except Exception as e:
        print(f"    Error scraping {slug}: {e}")
        return []


SCRAPERS = {
    "greenhouse": scrape_greenhouse,
    "lever": scrape_lever,
    "ashby": scrape_ashby,
}


def run():
    if not COMPANIES_FILE.exists():
        print("companies.json not found. Run discover_companies.py first.")
        return

    with open(COMPANIES_FILE, "r") as f:
        companies = json.load(f)

    all_jobs = []

    for platform, slugs in companies.items():
        scraper = SCRAPERS.get(platform)
        if not scraper:
            print(f"No scraper for {platform}, skipping")
            continue

        print(f"\n--- {platform.upper()} ({len(slugs)} companies) ---")

        for i, slug in enumerate(slugs):
            print(f"  [{i+1}/{len(slugs)}] {slug}", end="")
            jobs = scraper(slug)
            all_jobs.extend(jobs)
            print(f" - {len(jobs)} design jobs")
            time.sleep(0.5)  # be polite

    # Dedupe by URL
    seen = set()
    unique_jobs = []
    for job in all_jobs:
        if job["url"] not in seen:
            seen.add(job["url"])
            unique_jobs.append(job)

    # Sort by posted date, newest first
    unique_jobs.sort(key=lambda j: j.get("posted", ""), reverse=True)

    print(f"\n--- RESULTS ---")
    print(f"  Total design jobs found: {len(unique_jobs)}")
    for platform in SCRAPERS:
        count = len([j for j in unique_jobs if j["platform"] == platform])
        print(f"  {platform}: {count}")

    with open(JOBS_FILE, "w") as f:
        json.dump(unique_jobs, f, indent=2)
    print(f"\nSaved to {JOBS_FILE}")


if __name__ == "__main__":
    run()
