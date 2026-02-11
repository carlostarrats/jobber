"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import Image from "next/image";
import jobs from "@/data/jobs.json";

type Job = {
  id: string;
  title: string;
  company: string;
  companyUrl: string;
  location: string;
  city: string;
  remote: boolean;
  url: string;
  platform: "greenhouse" | "lever" | "ashby";
  roleType: string;
  posted: string;
  scraped: string;
};

const allJobs = jobs as Job[];

const ROLE_LABELS: Record<string, string> = {
  product_design: "Product Design",
  ui_design: "UI/UX Design",
  visual_design: "Visual Design",
  ux_research: "UX Research",
  content_design: "Content Design",
  design_engineering: "Design Engineering",
  design_systems: "Design Systems",
  brand_design: "Brand Design",
  web_design: "Web Design",
  design_leadership: "Design Leadership",
  other_design: "Other Design",
};

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatCompany(slug: string) {
  return slug
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// localStorage helpers for archive
const ARCHIVE_KEY = "jobber_archived";

function getArchived(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = localStorage.getItem(ARCHIVE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveArchived(ids: Set<string>) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify([...ids]));
}

export default function Home() {
  const [search, setSearch] = useState("");
  const [roleType, setRoleType] = useState("all");
  const [location, setLocation] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [archived, setArchived] = useState<Set<string>>(new Set());

  // Load archived from localStorage on mount
  useEffect(() => {
    setArchived(getArchived());
  }, []);

  const toggleArchive = useCallback(
    (id: string) => {
      setArchived((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        saveArchived(next);
        return next;
      });
    },
    []
  );

  // Collect unique locations for the filter dropdown
  const locations = useMemo(() => {
    const cities = new Set<string>();
    allJobs.forEach((job) => {
      if (job.city) cities.add(job.city);
    });
    return Array.from(cities).sort();
  }, []);

  // Collect unique role types present in data
  const roleTypes = useMemo(() => {
    const types = new Set<string>();
    allJobs.forEach((job) => {
      if (job.roleType) types.add(job.roleType);
    });
    return Array.from(types).sort();
  }, []);

  const filtered = useMemo(() => {
    return allJobs.filter((job) => {
      const isArchived = archived.has(job.id);
      if (showArchived && !isArchived) return false;
      if (!showArchived && isArchived) return false;

      const matchesSearch =
        !search ||
        job.title.toLowerCase().includes(search.toLowerCase()) ||
        job.company.toLowerCase().includes(search.toLowerCase()) ||
        job.location.toLowerCase().includes(search.toLowerCase());
      const matchesRole =
        roleType === "all" || job.roleType === roleType;
      const matchesLocation =
        location === "all" ||
        (location === "remote" && job.remote) ||
        job.city === location;
      return matchesSearch && matchesRole && matchesLocation;
    });
  }, [search, roleType, location, showArchived, archived]);

  const archivedCount = useMemo(
    () => allJobs.filter((j) => archived.has(j.id)).length,
    [archived]
  );

  return (
    <div className="min-h-screen">
      <header>
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 flex flex-col items-center">
          <Image
            src="/jobber-logo.svg"
            alt="Jobber"
            width={180}
            height={40}
            priority
          />
          {allJobs.length > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Last scraped: {formatDate(allJobs[0]?.scraped)} ({allJobs.length} Jobs)
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-0 pb-6 sm:px-6">
        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Input
            placeholder="Search jobs, companies, locations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs bg-gray-800 text-white placeholder:text-gray-400 border-gray-700"
          />
          <Select value={roleType} onValueChange={setRoleType}>
            <SelectTrigger className="w-[180px] bg-gray-800 text-white border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {roleTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {ROLE_LABELS[type] || type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger className="w-[180px] bg-gray-800 text-white border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              <SelectItem value="remote">Remote</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {loc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/50 border-white/50 hover:bg-gray-800 hover:text-white"
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived
                ? "Back"
                : `View archived (${archivedCount})`}
            </Button>
          </div>
        </div>

        {/* Job list */}
        <div className="mt-6 space-y-2">
          {filtered.length === 0 && (
            <p className="py-12 text-center text-muted-foreground">
              {showArchived
                ? "No archived jobs."
                : "No jobs match your filters."}
            </p>
          )}
          {filtered.map((job) => (
            <div
              key={job.id}
              className="group flex items-start gap-4 rounded-lg border p-4 transition-colors bg-white/50 hover:bg-white/70"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold hover:underline"
                  >
                    {job.title}
                  </a>
                  {job.posted && (
                    <span className="text-sm text-muted-foreground">
                      {formatDate(job.posted)}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {job.companyUrl ? (
                    <a
                      href={job.companyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-foreground hover:underline"
                    >
                      {formatCompany(job.company)}
                    </a>
                  ) : (
                    <span className="font-medium text-foreground">
                      {formatCompany(job.company)}
                    </span>
                  )}
                  {job.city && <span>{job.city}</span>}
                  {job.remote && (
                    <Badge variant="secondary" className="text-xs">
                      Remote
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm" className="hover:bg-gray-800 hover:text-white">
                    Apply
                  </Button>
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleArchive(job.id)}
                  className="text-xs text-muted-foreground hover:bg-gray-800 hover:text-white"
                >
                  {archived.has(job.id) ? "Unarchive" : "Archive"}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <footer className="mt-12 pt-6 pb-8 text-center text-sm text-muted-foreground">
          <p>Data sourced from publicly available job boards.</p>
        </footer>
      </main>
    </div>
  );
}
