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

# Titles to match (case-insensitive). Add or remove as needed.
TITLE_PATTERNS = [
    r"product designer",
    r"ux designer",
    r"ui designer",
    r"visual designer",
    r"interaction designer",
    r"design lead",
    r"design director",
    r"head of design",
    r"staff designer",
    r"senior designer",
    r"principal designer",
    r"design manager",
    r"brand designer",
    r"graphic designer",
    r"web designer",
    r"design engineer",
    r"ux researcher",
    r"content designer",
    r"design systems",
]

TITLE_REGEX = re.compile("|".join(TITLE_PATTERNS), re.IGNORECASE)

# Role type categorization based on title keywords
ROLE_CATEGORIES = [
    (r"ux research", "ux_research"),
    (r"content design", "content_design"),
    (r"design engineer", "design_engineering"),
    (r"design systems", "design_systems"),
    (r"brand design", "brand_design"),
    (r"graphic design", "brand_design"),
    (r"visual design", "visual_design"),
    (r"web design", "web_design"),
    (r"ui design", "ui_design"),
    (r"interaction design", "product_design"),
    (r"product design", "product_design"),
    (r"design director|design lead|head of design|design manager", "design_leadership"),
    (r"staff designer|senior designer|principal designer", "product_design"),
]

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "DesignJobBoard/1.0"})

# Cache for company website URLs (fetched once per company)
_company_url_cache = {}


def is_design_role(title):
    return bool(TITLE_REGEX.search(title))


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
    # Remove common suffixes and clean up
    city = location.split(",")[0].strip()
    # Remove "Remote - " or "Remote (" prefixes
    city = re.sub(r"^Remote\s*[-/(]\s*", "", city, flags=re.IGNORECASE)
    # If the whole thing is just "Remote", return empty
    if city.lower().strip() in ("remote", "anywhere", "worldwide", "global"):
        return ""
    return city


def get_greenhouse_company_url(slug):
    """Fetch company website from Greenhouse board info endpoint."""
    if slug in _company_url_cache:
        return _company_url_cache[slug]
    try:
        resp = SESSION.get(
            f"https://boards-api.greenhouse.io/v1/boards/{slug}",
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            url = data.get("company_url", "")
            _company_url_cache[slug] = url
            return url
    except Exception:
        pass
    _company_url_cache[slug] = ""
    return ""


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
