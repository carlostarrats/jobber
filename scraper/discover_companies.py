"""
Phase 2: Company Discovery
Uses SerpAPI to find companies with design jobs on Greenhouse, Lever, Ashby, and Gem.

Usage:
  pip install serpapi
  export SERPAPI_KEY="your_key_here"
  python discover_companies.py
"""

import json
import os
import re
import time
from pathlib import Path
from serpapi import GoogleSearch  # from google-search-results package

SERPAPI_KEY = os.environ.get("SERPAPI_KEY")
if not SERPAPI_KEY:
    raise ValueError("Set SERPAPI_KEY environment variable. Get a free key at serpapi.com")

# Adjust these to control how many SerpAPI credits you burn.
# Each title x platform = 1 credit. Free tier = 100/month.
SEARCH_TITLES = [
    "product designer",
    "UX designer",
    "senior product designer",
    "staff designer",
    "design lead",
    "interaction designer",
    "visual designer",
    "UI designer",
    "experience designer",
    "design director",
    "design manager",
    "UX researcher",
    "design engineer",
    "content designer",
    "design systems",
    "user experience designer",
]

PLATFORMS = {
    "greenhouse": {
        "site": "boards.greenhouse.io",
        "slug_pattern": r"boards\.greenhouse\.io/([a-zA-Z0-9_-]+)",
    },
    "lever": {
        "site": "jobs.lever.co",
        "slug_pattern": r"jobs\.lever\.co/([a-zA-Z0-9_-]+)",
    },
    "ashby": {
        "site": "jobs.ashbyhq.com",
        "slug_pattern": r"jobs\.ashbyhq\.com/([a-zA-Z0-9_-]+)",
    },
    "gem": {
        "site": "jobs.gem.com",
        "slug_pattern": r"jobs\.gem\.com/([a-zA-Z0-9_-]+)",
    },
}

COMPANIES_FILE = Path(__file__).parent / "companies.json"


def load_existing():
    if COMPANIES_FILE.exists():
        with open(COMPANIES_FILE, "r") as f:
            return json.load(f)
    return {platform: [] for platform in PLATFORMS}


def extract_slugs(results, platform):
    pattern = PLATFORMS[platform]["slug_pattern"]
    slugs = set()
    for result in results:
        link = result.get("link", "")
        match = re.search(pattern, link)
        if match:
            slug = match.group(1).lower()
            if slug not in ("embed", "jobs", "www", "api", "boards", "support"):
                slugs.add(slug)
    return slugs


def search_platform(platform, title):
    site = PLATFORMS[platform]["site"]
    query = f'site:{site} "{title}"'
    print(f"  Searching: {query}")

    try:
        search = GoogleSearch({
            "q": query,
            "api_key": SERPAPI_KEY,
            "num": 100,
            "engine": "google",
        })
        results = search.get_dict()
        organic = results.get("organic_results", [])
        slugs = extract_slugs(organic, platform)
        print(f"    Found {len(slugs)} companies")
        return slugs
    except Exception as e:
        print(f"    Error: {e}")
        return set()


def run():
    existing = load_existing()
    all_slugs = {p: set(existing.get(p, [])) for p in PLATFORMS}

    total = len(SEARCH_TITLES) * len(PLATFORMS)
    print(f"Running {total} searches ({total} SerpAPI credits)\n")

    for platform in PLATFORMS:
        print(f"\n--- {platform.upper()} ---")
        for title in SEARCH_TITLES:
            slugs = search_platform(platform, title)
            all_slugs[platform].update(slugs)
            time.sleep(1)

    output = {p: sorted(list(s)) for p, s in all_slugs.items()}

    print(f"\n--- RESULTS ---")
    for p, slugs in output.items():
        print(f"  {p}: {len(slugs)} companies")
    print(f"  Total: {sum(len(v) for v in output.values())}")

    with open(COMPANIES_FILE, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nSaved to {COMPANIES_FILE}")


if __name__ == "__main__":
    run()
