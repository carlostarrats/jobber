"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import jobs from "@/data/jobs.json";

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  platform: "greenhouse" | "lever" | "ashby";
  posted: string;
  scraped: string;
};

const allJobs = jobs as Job[];

const PLATFORM_COLORS: Record<string, string> = {
  greenhouse: "bg-emerald-100 text-emerald-800",
  lever: "bg-blue-100 text-blue-800",
  ashby: "bg-purple-100 text-purple-800",
};

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCompany(slug: string) {
  return slug
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Home() {
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [remoteOnly, setRemoteOnly] = useState(false);

  const filtered = useMemo(() => {
    return allJobs.filter((job) => {
      const matchesSearch =
        !search ||
        job.title.toLowerCase().includes(search.toLowerCase()) ||
        job.company.toLowerCase().includes(search.toLowerCase()) ||
        job.location.toLowerCase().includes(search.toLowerCase());
      const matchesPlatform =
        platform === "all" || job.platform === platform;
      const matchesRemote = !remoteOnly || job.remote;
      return matchesSearch && matchesPlatform && matchesRemote;
    });
  }, [search, platform, remoteOnly]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight">Jobber</h1>
          <p className="mt-1 text-muted-foreground">
            Free design job board. Updated weekly from Greenhouse, Lever, and
            Ashby.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search jobs, companies, locations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-sm"
          />
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              <SelectItem value="greenhouse">Greenhouse</SelectItem>
              <SelectItem value="lever">Lever</SelectItem>
              <SelectItem value="ashby">Ashby</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={remoteOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setRemoteOnly(!remoteOnly)}
          >
            Remote only
          </Button>
          <span className="text-sm text-muted-foreground sm:ml-auto">
            {filtered.length} {filtered.length === 1 ? "job" : "jobs"}
          </span>
        </div>

        {/* Job list */}
        <div className="mt-6 space-y-3">
          {filtered.length === 0 && (
            <p className="py-12 text-center text-muted-foreground">
              No jobs match your filters.
            </p>
          )}
          {filtered.map((job) => (
            <a
              key={job.id}
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-lg border p-4 transition-colors hover:bg-accent/50"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold group-hover:underline">
                    {job.title}
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatCompany(job.company)} &middot; {job.location}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {job.remote && (
                    <Badge variant="secondary" className="text-xs">
                      Remote
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={`text-xs border-0 ${PLATFORM_COLORS[job.platform] || ""}`}
                  >
                    {job.platform}
                  </Badge>
                  {job.posted && (
                    <span className="text-xs text-muted-foreground">
                      {formatDate(job.posted)}
                    </span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-12 border-t pt-6 pb-8 text-center text-sm text-muted-foreground">
          {allJobs.length > 0 && (
            <p>
              Last scraped: {formatDate(allJobs[0]?.scraped)}. Data sourced from
              public job boards.
            </p>
          )}
        </footer>
      </main>
    </div>
  );
}
