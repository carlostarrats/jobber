import unittest
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))

import scrape_jobs


class FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class GemScraperTests(unittest.TestCase):
    def setUp(self):
        scrape_jobs._company_url_cache.clear()

    def test_company_url_cache_keeps_platforms_separate(self):
        self.assertEqual(scrape_jobs.get_greenhouse_company_url("acme"), "https://boards.greenhouse.io/acme")
        self.assertEqual(scrape_jobs.get_gem_company_url("acme"), "https://jobs.gem.com/acme")

    def test_scrape_gem_normalizes_design_jobs(self):
        payload = {
            "job_posts": [
                {
                    "id": "post-1",
                    "title": "Senior Product Designer",
                    "locations": [{"location": "New York, NY"}],
                    "url": "https://jobs.gem.com/acme/post-1",
                    "published_at": "2026-05-01T12:00:00Z",
                },
                {
                    "id": "post-2",
                    "title": "Backend Engineer",
                    "locations": [{"location": "New York, NY"}],
                    "url": "https://jobs.gem.com/acme/post-2",
                },
            ]
        }

        with patch.object(scrape_jobs.SESSION, "get", return_value=FakeResponse(200, payload)) as get:
            jobs = scrape_jobs.scrape_gem("acme")

        get.assert_called_once_with(
            "https://api.gem.com/job_board/v0/acme/job_posts/",
            timeout=10,
        )
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]["id"], "gm-acme-post-1")
        self.assertEqual(jobs[0]["title"], "Senior Product Designer")
        self.assertEqual(jobs[0]["company"], "acme")
        self.assertEqual(jobs[0]["companyUrl"], "https://jobs.gem.com/acme")
        self.assertEqual(jobs[0]["location"], "New York, NY")
        self.assertEqual(jobs[0]["city"], "New York")
        self.assertFalse(jobs[0]["remote"])
        self.assertEqual(jobs[0]["url"], "https://jobs.gem.com/acme/post-1")
        self.assertEqual(jobs[0]["platform"], "gem")
        self.assertEqual(jobs[0]["roleType"], "product_design")
        self.assertEqual(jobs[0]["posted"], "2026-05-01")

    def test_gem_is_registered_as_a_scraper(self):
        self.assertIs(scrape_jobs.SCRAPERS["gem"], scrape_jobs.scrape_gem)


if __name__ == "__main__":
    unittest.main()
