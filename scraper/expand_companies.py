"""
Bulk expand companies.json from multiple sources:

1. Curated tech company slugs (~500)
2. Y Combinator companies (via yc-oss API — ~1400 hiring)
3. a16z portfolio companies (scraped from a16z.com)
4. Community aggregator lists (GitHub repos with 4000+ companies)

Validates each slug against Greenhouse/Lever/Ashby public APIs,
and merges valid ones into companies.json.

Usage:
  pip install requests
  python expand_companies.py

No API keys needed — all validation endpoints are public.
"""

import json
import re
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

COMPANIES_FILE = Path(__file__).parent / "companies.json"

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "DesignJobBoard/1.0"})

# Rate limiters: one lock per platform to enforce politeness
_rate_locks = {
    "greenhouse": threading.Lock(),
    "lever": threading.Lock(),
    "ashby": threading.Lock(),
}
_last_request_time = {
    "greenhouse": 0.0,
    "lever": 0.0,
    "ashby": 0.0,
}
MIN_DELAY = 0.3  # seconds between requests per platform


def _rate_limit(platform):
    with _rate_locks[platform]:
        now = time.monotonic()
        elapsed = now - _last_request_time[platform]
        if elapsed < MIN_DELAY:
            time.sleep(MIN_DELAY - elapsed)
        _last_request_time[platform] = time.monotonic()


# --- Validation functions ---

def validate_greenhouse(slug):
    _rate_limit("greenhouse")
    try:
        resp = SESSION.get(
            f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs",
            timeout=10,
        )
        return resp.status_code == 200
    except Exception:
        return False


def validate_lever(slug):
    _rate_limit("lever")
    try:
        resp = SESSION.get(
            f"https://api.lever.co/v0/postings/{slug}",
            timeout=10,
        )
        return resp.status_code == 200
    except Exception:
        return False


def validate_ashby(slug):
    _rate_limit("ashby")
    try:
        resp = SESSION.get(
            f"https://api.ashbyhq.com/posting-api/job-board/{slug}",
            timeout=10,
        )
        return resp.status_code == 200
    except Exception:
        return False


VALIDATORS = {
    "greenhouse": validate_greenhouse,
    "lever": validate_lever,
    "ashby": validate_ashby,
}

# --- External source fetchers ---

def fetch_yc_slugs():
    """Fetch company slugs from Y Combinator's public API (hiring companies)."""
    print("  Fetching YC companies (hiring)...")
    try:
        resp = SESSION.get(
            "https://yc-oss.github.io/api/companies/hiring.json",
            timeout=30,
        )
        if resp.status_code != 200:
            print(f"    Failed: HTTP {resp.status_code}")
            return []
        companies = resp.json()
        # YC slugs are lowercase company names, often match ATS slugs
        slugs = []
        for c in companies:
            slug = c.get("slug", "")
            if slug:
                slugs.append(slug)
            # Also try sanitized website domain as slug
            website = c.get("website", "")
            if website:
                domain = re.sub(r"https?://(www\.)?", "", website).split("/")[0].split(".")[0]
                if domain and domain != slug:
                    slugs.append(domain)
        print(f"    Got {len(slugs)} slug candidates from {len(companies)} YC companies")
        return slugs
    except Exception as e:
        print(f"    Error fetching YC data: {e}")
        return []


def fetch_aggregator_slugs():
    """Fetch company lists from community job board aggregator repos."""
    base = "https://raw.githubusercontent.com/Feashliaa/job-board-aggregator/main/data"
    result = {"greenhouse": [], "lever": [], "ashby": []}
    for platform in result:
        url = f"{base}/{platform}_companies.json"
        print(f"  Fetching aggregator {platform} list...")
        try:
            resp = SESSION.get(url, timeout=30)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    result[platform] = data
                elif isinstance(data, dict):
                    result[platform] = list(data.keys())
                print(f"    Got {len(result[platform])} {platform} companies")
            else:
                print(f"    Failed: HTTP {resp.status_code}")
        except Exception as e:
            print(f"    Error: {e}")
    return result


def fetch_a16z_slugs():
    """Fetch a16z portfolio company names and generate slug candidates."""
    print("  Fetching a16z portfolio...")
    try:
        resp = SESSION.get("https://a16z.com/portfolio/", timeout=30)
        if resp.status_code != 200:
            print(f"    Failed: HTTP {resp.status_code}")
            return []
        # Extract company names from the portfolio page
        names = re.findall(r'class="[^"]*portfolio[^"]*"[^>]*>([^<]+)<', resp.text)
        if not names:
            # Try alternate patterns
            names = re.findall(r'"name"\s*:\s*"([^"]+)"', resp.text)
        if not names:
            # Try link text patterns
            names = re.findall(r'href="https://a16z\.com/portfolio/[^"]*"[^>]*>([^<]+)<', resp.text)
        # Generate slugs from company names
        slugs = []
        for name in names:
            name = name.strip()
            if not name or len(name) > 50:
                continue
            # Generate slug variants
            slug = re.sub(r"[^a-z0-9]+", "", name.lower())
            if slug:
                slugs.append(slug)
            slug_dash = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
            if slug_dash and slug_dash != slug:
                slugs.append(slug_dash)
        print(f"    Got {len(slugs)} slug candidates from {len(names)} a16z companies")
        return slugs
    except Exception as e:
        print(f"    Error fetching a16z data: {e}")
        return []


# --- Curated slug guesses ---
# Invalid slugs simply 404 and get filtered out. Include multiple variants
# for companies with non-obvious slugs.

CURATED_SLUGS = {
    "greenhouse": [
        # FAANG-adjacent
        "airbnb", "netflix", "netflixjobs", "pinterest", "snap", "snapinc",
        "lyft", "uber", "discord", "twitter", "x", "meta", "facebook",
        "google", "apple", "amazon", "microsoft", "linkedin",
        # Design-forward
        "figma", "notion", "notionhq", "canva", "miro", "webflow",
        "framer", "linear", "vercel", "sketch", "invisionapp", "abstract",
        # Fintech
        "coinbase", "plaid", "chime", "brex", "mercury", "mercuryhq",
        "affirm", "klarna", "sofi", "stripe", "square", "squareup",
        "cashapp", "wealthfront", "betterment", "wise", "transferwise",
        "revolut", "nubank", "monzo", "greenlight",
        # AI companies
        "anthropic", "openai", "perplexityai", "perplexity", "cursor",
        "cursorai", "cohere", "cohereinc", "runway", "runwayml",
        "midjourney", "stability", "stabilityai", "huggingface",
        "deepmind", "inflection", "inflectionai", "jasper", "jasperai",
        "sambanova", "together", "togetherai", "mistralai", "adept",
        "adeptailabs", "character", "characterai",
        # Enterprise SaaS
        "cloudflare", "databricks", "twilio", "okta", "airtable",
        "asana", "amplitude", "atlassian", "salesforce", "servicenow",
        "snowflake", "snowflakecomputing", "confluent", "hashicorp",
        "elastic", "elasticco", "mongodb", "pagerduty", "zendesk",
        "freshworks", "hubspot", "intercom", "segment", "mixpanel",
        "launchdarkly", "contentful", "sanity", "contentstack",
        # Gaming
        "riotgames", "roblox", "niantic", "nianticinc", "bungie",
        "unity", "unitytechnologies", "epicgames", "valvesoftware",
        "activisionblizzard", "blizzard", "electronicarts", "ea",
        "supercell", "scopely", "zynga", "kabam", "naughtydog",
        # Health / wellness
        "headspace", "calm", "noom", "hims", "himshers", "peloton",
        "oura", "whoop", "fitbit", "teladoc", "onemedical", "ro",
        "cerebral", "ginger", "springhealth", "modernhealth",
        # E-commerce / marketplace
        "etsy", "shopify", "faire", "stockx", "poshmark", "depop",
        "mercari", "offerup", "letgo", "reverb", "goat", "grailed",
        "instacart", "doordash", "grubhub", "postmates",
        "wayfair", "chewy", "threadup", "redbubble",
        # Dev tools
        "supabase", "posthog", "retool", "railway", "netlify",
        "render", "fly", "flyio", "gitpod", "replit", "codepen",
        "stackblitz", "sentry", "launchdarkly", "split",
        "circleci", "travisci", "buildkite", "github", "gitlab",
        # Design agencies / consultancies
        "ideo", "huge", "hugeinc", "ustwo", "thoughtbot", "frog",
        "frogdesign", "pentagram", "cooperhewitt", "instrument",
        "metalab", "basicagency", "fantasy", "method",
        # Media / social
        "spotify", "soundcloud", "tidal", "medium", "substack",
        "reddit", "tumblr", "tiktok", "bytedance",
        # Travel / mobility
        "airbnb", "booking", "bookingcom", "expedia", "tripadvisor",
        "kayak", "hopper", "getaround", "turo", "bird", "lime",
        # Productivity
        "slack", "zoom", "zoomvideocommunications", "notion",
        "clickup", "monday", "mondaycom", "coda", "codahq",
        "roam", "obsidian", "craft", "sunsama", "todoist",
        # Crypto / web3
        "opensea", "consensys", "chainalysis", "dapper", "dapperlabs",
        "alchemy", "alchemyplatform", "phantom", "uniswap",
        "aave", "compound", "makerdao",
        # Security
        "crowdstrike", "sentinelone", "snyk", "lacework",
        "1password", "bitwarden", "tailscale",
        # Infrastructure
        "docker", "kubernetes", "redhat", "vmware", "nutanix",
        "cockroachlabs", "planetscale", "neon", "timescale",
        # Misc notable companies
        "canva", "grammarly", "duolingo", "coursera", "udacity",
        "khanacademy", "masterclass", "skillshare", "codeacademy",
        "zapier", "ifttt", "make", "workato", "tray",
        "segment", "twosigma", "citadel", "deshaw",
        "palantir", "palantirtechnologies", "anduril",
        "relativity", "relativityspace", "spacex", "blueorigin",
        "ziprecruiter", "indeed", "glassdoor", "lever",
        "gusto", "rippling", "deel", "remote", "remotecom",
        "oysterhr", "justworks", "lattice", "cultureamp",
        "figma", "mural", "lucid", "lucidchart", "loom",
        "calendly", "cal", "doodle",
        "frontapp", "front", "drift", "intercom", "chatwoot",
        "webflow", "squarespace", "wix", "godaddy",
        "twitch", "kick", "crunchyroll",
        "nytimes", "washingtonpost", "vox", "theverge",
        "buzzfeed", "viceMedia",
    ],
    "lever": [
        # FAANG-adjacent
        "airbnb", "netflix", "pinterest", "snap", "snapinc",
        "lyft", "uber", "discord", "twitter", "meta",
        # Design-forward
        "figma", "notion", "canva", "miro", "webflow",
        "framer", "linear", "vercel", "sketch", "invision",
        # Fintech
        "coinbase", "plaid", "chime", "brex", "mercury",
        "affirm", "klarna", "sofi", "stripe", "square",
        "wealthfront", "betterment", "wise", "revolut",
        "greenlight", "current", "varo", "dave", "moneyforward",
        # AI companies
        "anthropic", "openai", "perplexity", "cursor",
        "cohere", "runway", "midjourney", "stability",
        "huggingface", "jasper", "writer", "copy-ai",
        "synthesia", "descript", "elevenlabs",
        # Enterprise SaaS
        "cloudflare", "databricks", "twilio", "okta", "airtable",
        "asana", "amplitude", "atlassian", "hashicorp",
        "mongodb", "pagerduty", "zendesk", "freshworks",
        "intercom", "segment", "mixpanel", "heap",
        "launchdarkly", "contentful", "sanity",
        # Gaming
        "riotgames", "riot", "roblox", "niantic", "bungie",
        "unity", "epicgames", "scopely", "zynga", "kabam",
        "supercell", "innersloth", "mojang",
        # Health / wellness
        "headspace", "calm", "noom", "hims", "peloton",
        "oura", "fitbit", "teladoc", "onemedical", "ro",
        "cerebral", "springhealth", "modernhealth",
        "devoted-health", "cityblock", "omadahealth",
        # E-commerce / marketplace
        "etsy", "shopify", "faire", "stockx", "poshmark",
        "depop", "mercari", "instacart", "doordash",
        "grubhub", "wayfair", "chewy", "goat",
        "offerup", "reverb", "redbubble",
        # Dev tools
        "supabase", "posthog", "retool", "railway", "netlify",
        "render", "gitpod", "replit", "sentry", "circleci",
        "buildkite", "github", "gitlab", "sourcegraph",
        "snyk", "sonarqube", "jetbrains",
        # Design agencies / consultancies
        "ideo", "hugeinc", "ustwo", "thoughtbot", "frog",
        "instrument", "metalab", "method", "teague",
        "designit", "fjord", "bcgdigitalventures",
        # Media / social
        "spotify", "soundcloud", "medium", "substack",
        "reddit", "tumblr", "tiktok", "bytedance",
        "twitch", "crunchyroll",
        # Travel / mobility
        "booking", "expedia", "tripadvisor", "hopper",
        "getaround", "turo", "bird", "lime",
        # Productivity
        "slack", "zoom", "clickup", "monday",
        "coda", "todoist", "sunsama",
        # Crypto / web3
        "opensea", "consensys", "chainalysis", "dapperlabs",
        "alchemy", "phantom", "uniswap", "kraken",
        # Security
        "crowdstrike", "sentinelone", "lacework",
        "1password", "tailscale",
        # Misc notable
        "grammarly", "duolingo", "coursera", "zapier",
        "gusto", "rippling", "deel", "lattice", "cultureamp",
        "loom", "calendly", "mural", "lucid",
        "squarespace", "wix", "godaddy",
        "nytimes", "vox", "buzzfeed",
        "robinhood", "chimebank", "sofi-careers",
        "benchling", "ginkgobioworks", "recursion",
        "flexport", "convoy", "project44",
        "toast", "toasttab", "clover", "lightspeed",
        "relativityspace", "spacex", "anduril",
        "scale", "scaleai", "labelbox", "snorkel",
        "datadog", "newrelic", "dynatrace", "splunk",
        "grafana", "grafanalabs",
        "docusign", "dropbox", "box",
        "eventbrite", "stubhub", "seatgeek",
        "nextdoor", "neighborly", "citizen",
        "allbirds", "warbyparker", "glossier",
        "away", "casper", "brooklinen",
    ],
    "ashby": [
        # FAANG-adjacent
        "airbnb", "netflix", "pinterest", "snap",
        "lyft", "uber", "discord", "twitter",
        # Design-forward
        "figma", "notion", "canva", "miro", "webflow",
        "framer", "linear", "vercel", "sketch",
        # Fintech
        "coinbase", "plaid", "chime", "brex", "mercury",
        "affirm", "klarna", "stripe", "square",
        "wealthfront", "betterment", "wise", "revolut",
        "greenlight", "current", "ramp", "rho",
        # AI companies
        "anthropic", "openai", "perplexity", "cursor",
        "cohere", "runway", "midjourney", "stability",
        "huggingface", "jasper", "writer",
        "synthesia", "descript", "elevenlabs",
        "mistral", "together", "adept", "inflection",
        # Enterprise SaaS
        "cloudflare", "databricks", "twilio", "okta",
        "airtable", "asana", "amplitude", "hashicorp",
        "mongodb", "pagerduty", "zendesk", "freshworks",
        "intercom", "segment", "mixpanel", "heap",
        "launchdarkly", "contentful", "sanity",
        "retool", "posthog", "posthoginc",
        # Gaming
        "riotgames", "roblox", "niantic", "bungie",
        "unity", "epicgames", "scopely",
        # Health / wellness
        "headspace", "calm", "noom", "hims", "oura",
        "springhealth", "modernhealth", "devoted-health",
        "cityblock", "omadahealth", "pearlhealth",
        # E-commerce / marketplace
        "etsy", "shopify", "faire", "stockx",
        "poshmark", "depop", "mercari",
        "instacart", "doordash",
        # Dev tools
        "supabase", "railway", "netlify", "render",
        "gitpod", "replit", "sentry", "sourcegraph",
        "fly", "neon", "planetscale",
        "cockroachlabs", "timescale",
        # Design agencies
        "ideo", "ustwo", "thoughtbot", "metalab",
        # Media / social
        "spotify", "medium", "substack", "reddit",
        # Travel / mobility
        "hopper", "turo", "lime",
        # Productivity
        "clickup", "monday", "coda", "notion",
        "loom", "calendly", "mural",
        # Crypto / web3
        "opensea", "consensys", "chainalysis",
        "phantom", "uniswap", "polymarket", "kalshi",
        # Security
        "snyk", "1password", "tailscale", "vanta", "socure",
        # Misc notable
        "grammarly", "duolingo", "coursera", "zapier",
        "gusto", "rippling", "deel", "lattice",
        "cultureamp", "squarespace",
        "benchling", "ginkgo", "recursion",
        "flexport", "project44",
        "toast", "lightspeed",
        "scaleai", "labelbox",
        "newrelic", "dynatrace", "grafana",
        "docusign", "dropbox", "box",
        "eventbrite", "seatgeek",
        "nextdoor", "citizen",
        "warbyparker", "glossier", "allbirds",
        "anduril", "relativity",
        "ironclad", "ironcladhq",
        "dandy", "candidhealth", "brigit",
        "freshpaint", "plain", "pylon-labs",
        "span", "tavus", "traba", "wander",
        "sleeper", "socket", "synthflow",
    ],
}


def validate_slugs(platform, slugs, existing):
    """Validate slugs against the public API, skip already-known ones."""
    validator = VALIDATORS[platform]
    new_slugs = [s for s in slugs if s not in existing]
    if not new_slugs:
        print(f"  {platform}: all {len(slugs)} slugs already in companies.json")
        return []

    print(f"  {platform}: checking {len(new_slugs)} new slugs ({len(slugs) - len(new_slugs)} already known)...")

    valid = []
    invalid = 0

    def check(slug):
        return slug, validator(slug)

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(check, s): s for s in new_slugs}
        for i, future in enumerate(as_completed(futures), 1):
            slug, is_valid = future.result()
            if is_valid:
                valid.append(slug)
                print(f"    [{i}/{len(new_slugs)}] {slug} ✓")
            else:
                invalid += 1
                if i % 25 == 0:
                    print(f"    [{i}/{len(new_slugs)}] ... {invalid} invalid so far")

    print(f"  {platform}: {len(valid)} new valid, {invalid} invalid")
    return valid


def run():
    # Load existing companies
    if COMPANIES_FILE.exists():
        with open(COMPANIES_FILE, "r") as f:
            companies = json.load(f)
    else:
        companies = {"greenhouse": [], "lever": [], "ashby": []}

    existing_sets = {p: set(companies.get(p, [])) for p in CURATED_SLUGS}

    print("=== Expanding companies.json ===\n")
    total_before = sum(len(v) for v in companies.values())
    print(f"Current companies: {total_before}")
    for p in CURATED_SLUGS:
        print(f"  {p}: {len(companies.get(p, []))}")

    # --- Fetch external sources ---
    print("\n--- Fetching external sources ---")
    yc_slugs = fetch_yc_slugs()
    a16z_slugs = fetch_a16z_slugs()
    aggregator = fetch_aggregator_slugs()

    # Merge external slugs into curated lists (all get validated)
    all_slugs = {}
    for platform in CURATED_SLUGS:
        combined = set(CURATED_SLUGS[platform])
        # YC and a16z slugs: try on all platforms
        combined.update(yc_slugs)
        combined.update(a16z_slugs)
        # Aggregator slugs: platform-specific (already validated by them)
        combined.update(aggregator.get(platform, []))
        all_slugs[platform] = list(combined)

    total_candidates = sum(len(v) for v in all_slugs.values())
    print(f"\nTotal slug candidates to validate: {total_candidates}")
    print()

    # Validate all platforms
    all_new = {}
    for platform in all_slugs:
        all_new[platform] = validate_slugs(
            platform,
            all_slugs[platform],
            existing_sets[platform],
        )
        print()

    # Merge into companies.json
    for platform, new_slugs in all_new.items():
        existing = set(companies.get(platform, []))
        existing.update(new_slugs)
        companies[platform] = sorted(existing)

    total_after = sum(len(v) for v in companies.values())
    total_added = total_after - total_before

    print("=== RESULTS ===")
    print(f"Companies before: {total_before}")
    print(f"Companies after:  {total_after}")
    print(f"New companies:    {total_added}")
    for p in CURATED_SLUGS:
        added = len(all_new[p])
        print(f"  {p}: {len(companies[p])} total (+{added} new)")

    with open(COMPANIES_FILE, "w") as f:
        json.dump(companies, f, indent=2)
    print(f"\nSaved to {COMPANIES_FILE}")
    print(f"\nNext step: run 'python scrape_jobs.py' to scrape jobs from all companies")


if __name__ == "__main__":
    run()
