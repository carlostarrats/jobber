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

const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

const US_KEYWORDS = /\bunited states\b|\busa\b|\bu\.s\.\b/i;

const US_STATE_NAMES = /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/i;

const US_CITIES = new Set([
  // NYC metro
  "new york","new york city","nyc","brooklyn","jersey city","hoboken",
  "stamford","white plains","newark",
  // SF Bay Area
  "san francisco","palo alto","mountain view","san jose","santa clara",
  "sunnyvale","cupertino","redwood city","menlo park","foster city",
  "oakland","berkeley","fremont","san mateo","santa cruz",
  // LA metro
  "los angeles","santa monica","pasadena","burbank","long beach","irvine",
  "costa mesa","tustin","aliso viejo","santa ana","glendale","venice",
  "playa vista","culver city","el segundo","marina del rey","manhattan beach",
  "hermosa beach","redondo beach","torrance","inglewood","hawthorne",
  "west hollywood","beverly hills","century city","woodland hills",
  "sherman oaks","encino","studio city","north hollywood","van nuys",
  "calabasas","thousand oaks","westlake village","agoura hills",
  "anaheim","fullerton","huntington beach","newport beach","laguna beach",
  "lake forest","mission viejo","rancho santa margarita","san clemente",
  "ontario","pomona","claremont","azusa","monrovia","arcadia","alhambra",
  "el monte","west covina","whittier","downey","norwalk","cerritos",
  "lakewood","signal hill","san pedro","carson","compton","paramount",
  // Seattle metro
  "seattle","bellevue","redmond","kirkland","tacoma","woodinville",
  // Chicago metro
  "chicago","chicagoland","evanston","naperville","schaumburg",
  // Boston metro
  "boston","cambridge","waltham","somerville",
  // DC metro
  "washington","arlington","reston","bethesda","alexandria",
  // Other tech hubs
  "austin","denver","boulder","atlanta","dallas","houston","miami",
  "nashville","charlotte","raleigh","durham","minneapolis","pittsburgh",
  "portland","phoenix","san diego","salt lake city","detroit","ann arbor",
  "philadelphia","cleveland","south burlington","sacramento","harrisburg",
  "las vegas","redlands","akron","cary","rogers",
]);

function isUSLocation(location: string): boolean {
  if (US_KEYWORDS.test(location)) return true;
  if (US_STATE_NAMES.test(location)) return true;
  const abbrevMatch = location.match(/,\s*([A-Z]{2})\b/);
  if (abbrevMatch && US_STATES.has(abbrevMatch[1])) return true;
  if (/\bUS\s+[A-Z]{2}\b/.test(location)) return true;
  const city = location.split(",")[0].trim().toLowerCase().replace(/\s*(office|hq)\s*$/i, "");
  if (US_CITIES.has(city)) return true;
  return false;
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
  const [dateFilter, setDateFilter] = useState("all");
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

  // Collect unique role types present in data
  const roleTypes = useMemo(() => {
    const types = new Set<string>();
    allJobs.forEach((job) => {
      if (job.roleType) types.add(job.roleType);
    });
    return Array.from(types).sort();
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    const maxDays = dateFilter === "1" ? 1 : dateFilter === "7" ? 7 : dateFilter === "30" ? 30 : 90;
    return allJobs.filter((job) => {
      const isArchived = archived.has(job.id);
      if (showArchived && !isArchived) return false;
      if (!showArchived && isArchived) return false;

      // Always exclude jobs older than 90 days
      if (job.posted) {
        const daysAgo = (now.getTime() - new Date(job.posted + "T00:00:00").getTime()) / 86400000;
        if (daysAgo > 90) return false;
        if (dateFilter !== "all" && daysAgo > maxDays) return false;
      } else {
        return false;
      }

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
        (location === "us" && isUSLocation(job.location));
      return matchesSearch && matchesRole && matchesLocation;
    });
  }, [search, roleType, location, dateFilter, showArchived, archived]);

  const archivedCount = useMemo(
    () => allJobs.filter((j) => archived.has(j.id)).length,
    [archived]
  );

  const groupedByDate = useMemo(() => {
    const groups: { date: string; jobs: Job[] }[] = [];
    let current: { date: string; jobs: Job[] } | null = null;
    for (const job of filtered) {
      const date = job.posted || "Unknown";
      if (!current || current.date !== date) {
        current = { date, jobs: [] };
        groups.push(current);
      }
      current.jobs.push(job);
    }
    return groups;
  }, [filtered]);

  return (
    <div className="min-h-screen">
      <header>
        <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 flex flex-col items-center">
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
          <Button
            variant="outline"
            size="sm"
            className="absolute right-4 sm:right-6 top-8 bg-white/50 border-white/50 hover:bg-gray-800 hover:text-white"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived
              ? "Back"
              : `View saved (${archivedCount})`}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-0 pb-6 sm:px-6">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Input
            placeholder="Search jobs, companies, locations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-gray-800 text-white placeholder:text-gray-400 border-gray-700"
          />
          <Select value={roleType} onValueChange={setRoleType}>
            <SelectTrigger className="w-full bg-gray-800 text-white border-gray-700">
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
            <SelectTrigger className="w-full bg-gray-800 text-white border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              <SelectItem value="us">US only</SelectItem>
              <SelectItem value="remote">Remote</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-full bg-gray-800 text-white border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Last 90 days</SelectItem>
              <SelectItem value="1">Today</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Job list */}
        <div className="mt-6">
          {filtered.length === 0 && (
            <p className="py-12 text-center text-muted-foreground">
              {showArchived
                ? "No saved jobs."
                : "No jobs match your filters."}
            </p>
          )}
          {(() => {
            let counter = 0;
            return groupedByDate.map((group) => (
              <div key={group.date} className="mt-16 first:mt-0">
                <div className="flex items-center gap-3 pb-3">
                  <span className="text-lg font-semibold text-muted-foreground">
                    {group.date === "Unknown" ? "Unknown date" : formatDate(group.date)}
                  </span>
                  <div className="flex-1 border-b border-dashed border-muted-foreground/30" />
                </div>
                <div className="space-y-2">
                  {group.jobs.map((job) => {
                    counter++;
                    const num = counter;
                    return (
                      <div
                        key={job.id}
                        className="group flex items-start gap-2 rounded-lg border py-4 pr-4 pl-2 transition-colors bg-white/50 hover:bg-white/70"
                      >
                        <span className="mt-0.5 text-sm font-medium text-muted-foreground/60 tabular-nums w-8 shrink-0 text-right">
                          {num}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">
                              {job.title}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                            {job.companyUrl ? (
                              <a
                                href={job.companyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
                              >
                                <svg className="size-3.5 shrink-0 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                </svg>
                                {formatCompany(job.company)}
                              </a>
                            ) : (
                              <span className="font-medium text-foreground">
                                {formatCompany(job.company)}
                              </span>
                            )}
                            {job.remote && (
                              <Badge variant="secondary" className="text-xs">
                                Remote
                              </Badge>
                            )}
                            {job.city && (
                              <span className="sm:hidden">{job.city}</span>
                            )}
                          </div>
                        </div>
                        <span className="hidden sm:inline text-sm text-muted-foreground w-40 shrink-0 truncate text-left self-center">
                          {job.city}
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="outline" size="sm" className="hover:bg-gray-800 hover:text-white">
                              View
                            </Button>
                          </a>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleArchive(job.id)}
                            className="text-xs bg-transparent hover:bg-gray-800 hover:text-white"
                          >
                            {archived.has(job.id) ? "Unsave" : "Save"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>

        <footer className="mt-12 pt-6 pb-8 text-center text-sm text-muted-foreground">
          <p>Data sourced from publicly available job boards.</p>
        </footer>
      </main>
    </div>
  );
}
