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
  brand_design: "Brand Design",
  design_leadership: "Design Leadership",
  design_engineering: "Design Engineering",
};

// Map all roleTypes into 4 filter groups
const ROLE_GROUP: Record<string, string> = {
  product_design: "product_design",
  ui_design: "product_design",
  visual_design: "product_design",
  web_design: "product_design",
  ux_research: "product_design",
  content_design: "product_design",
  other_design: "product_design",
  brand_design: "brand_design",
  design_leadership: "design_leadership",
  design_engineering: "design_engineering",
  design_systems: "design_engineering",
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

const METRO_AREAS: Record<string, string[]> = {
  // --- Big 4 requested metros (comprehensive) ---
  "new york": [
    "new york","new york city","nyc","manhattan","brooklyn","queens","bronx",
    "staten island","harlem","soho","tribeca","chelsea","midtown","fidi",
    "financial district","flatiron","union square","williamsburg","dumbo",
    "bushwick","greenpoint","astoria","long island city","flushing",
    // NJ suburbs
    "jersey city","hoboken","newark","weehawken","edgewater","fort lee",
    "secaucus","rutherford","montclair","morristown","princeton","paramus",
    "hackensack","teaneck","englewood","ridgewood","mahwah","parsippany",
    // NY suburbs
    "yonkers","white plains","new rochelle","tarrytown","scarsdale",
    "mamaroneck","rye","port chester","armonk","purchase","pleasantville",
    "garden city","great neck","manhasset","roslyn","mineola","hempstead",
    "long beach","huntington","melville","hauppauge","islandia",
    // CT suburbs
    "stamford","greenwich","norwalk","danbury","bridgeport","new haven",
    "hartford","westport","darien","fairfield",
  ],
  "san francisco": [
    "san francisco","sf","soma","mission district","financial district",
    // Peninsula
    "palo alto","menlo park","redwood city","san mateo","foster city",
    "burlingame","millbrae","san bruno","south san francisco","daly city",
    "san carlos","belmont","half moon bay","woodside","atherton","portola valley",
    // South Bay
    "san jose","santa clara","sunnyvale","cupertino","mountain view",
    "milpitas","campbell","los gatos","saratoga","gilroy","morgan hill",
    // East Bay
    "oakland","berkeley","fremont","hayward","union city","newark",
    "pleasanton","dublin","livermore","walnut creek","concord",
    "san ramon","danville","orinda","lafayette","moraga","alameda",
    "emeryville","richmond","el cerrito","albany","piedmont",
    // North Bay
    "san rafael","novato","mill valley","sausalito","tiburon","corte madera",
    "larkspur","petaluma","napa","sonoma","santa rosa",
    // Other
    "santa cruz","scotts valley","capitola",
  ],
  "seattle": [
    "seattle","south lake union","capitol hill","ballard","fremont","wallingford",
    "queen anne","pioneer square","belltown","university district","columbia city",
    // Eastside
    "bellevue","redmond","kirkland","woodinville","bothell","kenmore",
    "issaquah","sammamish","mercer island","newcastle","factoria",
    "snoqualmie","north bend","fall city","carnation",
    // South
    "renton","kent","tukwila","seatac","auburn","federal way","burien",
    "des moines","covington","maple valley",
    // North
    "shoreline","edmonds","lynnwood","mountlake terrace","everett",
    "mukilteo","snohomish","marysville","lake stevens",
    // Tacoma area
    "tacoma","lakewood","university place","puyallup","sumner","bonney lake",
    "gig harbor","olympia","lacey","tumwater",
    // East foothills
    "north bend","cle elum",
  ],
  "chicago": [
    "chicago","chicagoland","loop","river north","west loop","south loop",
    "lincoln park","lakeview","wicker park","bucktown","logan square",
    "hyde park","pilsen","old town","gold coast","streeterville",
    // North suburbs
    "evanston","skokie","wilmette","winnetka","glencoe","highland park",
    "lake forest","deerfield","northbrook","glenview","niles","morton grove",
    "park ridge","des plaines","arlington heights","mount prospect",
    "palatine","buffalo grove","libertyville","lake zurich","waukegan",
    "north chicago","round lake","mundelein","vernon hills","lincolnshire",
    // West suburbs
    "oak brook","elmhurst","lombard","glen ellyn","wheaton","naperville",
    "aurora","lisle","downers grove","westmont","clarendon hills",
    "hinsdale","western springs","la grange","brookfield","riverside",
    "oak park","berwyn","cicero","schaumburg","hoffman estates",
    "streamwood","bartlett","carol stream","hanover park","roselle",
    "itasca","addison","wood dale","bensenville","elk grove village",
    // South suburbs
    "orland park","tinley park","mokena","frankfort","new lenox",
    "joliet","bolingbrook","romeoville","plainfield","homer glen",
    "oak lawn","evergreen park","chicago heights","park forest",
    // NW Indiana (commuter belt)
    "gary","hammond","east chicago","crown point","valparaiso",
  ],
  // --- Other major metros ---
  "los angeles": [
    "los angeles","la","santa monica","pasadena","burbank","long beach","irvine",
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
    "rancho cucamonga","riverside","corona","fontana","san bernardino",
    "temecula","murrieta","palm springs","oxnard","ventura","camarillo",
    "simi valley","santa clarita","palmdale","lancaster",
  ],
  "boston": [
    "boston","cambridge","waltham","somerville","brookline","newton",
    "quincy","medford","malden","lexington","concord","burlington",
    "woburn","reading","wakefield","stoneham","melrose","everett",
    "chelsea","revere","lynn","salem","peabody","danvers","beverly",
    "gloucester","marblehead","swampscott","nahant","saugus",
    "needham","wellesley","natick","framingham","marlborough","hudson",
    "sudbury","wayland","weston","lincoln","bedford","billerica",
    "lowell","haverhill","andover","north andover","lawrence",
    "braintree","weymouth","hingham","norwell","scituate","cohasset",
    "plymouth","kingston","duxbury","marshfield",
    "dedham","norwood","canton","stoughton","sharon","foxborough",
    "franklin","milford","hopkinton","westborough","shrewsbury","worcester",
    // Providence commuter belt
    "providence","warwick","cranston","pawtucket",
  ],
  "washington dc": [
    "washington","washington dc","dc","capitol hill","georgetown","dupont circle",
    "foggy bottom","adams morgan","columbia heights","u street","shaw",
    // Virginia suburbs
    "arlington","alexandria","reston","mclean","tysons","tysons corner",
    "fairfax","falls church","herndon","sterling","ashburn","leesburg",
    "chantilly","centreville","manassas","woodbridge","springfield",
    "annandale","vienna","burke","lorton","dumfries","stafford",
    "fredericksburg","richmond",
    // Maryland suburbs
    "bethesda","silver spring","rockville","gaithersburg","germantown",
    "columbia","ellicott city","laurel","bowie","college park",
    "greenbelt","hyattsville","takoma park","chevy chase","potomac",
    "olney","clarksburg","frederick","annapolis","baltimore",
  ],
  "austin": [
    "austin","round rock","cedar park","san marcos","georgetown","pflugerville",
    "leander","dripping springs","bee cave","lakeway","buda","kyle",
    "manor","hutto","taylor","bastrop","elgin","lockhart",
    "san antonio","new braunfels","seguin",
  ],
  "denver": [
    "denver","boulder","aurora","lakewood","littleton","broomfield",
    "fort collins","loveland","longmont","lafayette","louisville","superior",
    "arvada","westminster","thornton","northglenn","brighton","commerce city",
    "golden","morrison","evergreen","conifer","castle rock","parker",
    "highlands ranch","centennial","greenwood village","englewood",
    "cherry hills village","lone tree","colorado springs",
  ],
  "atlanta": [
    "atlanta","decatur","marietta","roswell","alpharetta","sandy springs",
    "kennesaw","smyrna","vinings","brookhaven","dunwoody","peachtree city",
    "johns creek","duluth","suwanee","buford","lawrenceville","norcross",
    "tucker","stone mountain","lithonia","conyers","covington",
    "woodstock","canton","cumming","gainesville",
  ],
  "dallas": [
    "dallas","fort worth","plano","frisco","irving","arlington","richardson",
    "mckinney","allen","prosper","celina","little elm","lewisville",
    "carrollton","farmers branch","addison","garland","mesquite","rowlett",
    "rockwall","wylie","sachse","murphy","lucas","princeton",
    "denton","flower mound","highland village","coppell","grapevine",
    "colleyville","southlake","keller","north richland hills","hurst",
    "euless","bedford","mansfield","grand prairie","cedar hill","desoto",
    "duncanville","lancaster","waxahachie","midlothian","cleburne",
  ],
  "houston": [
    "houston","the woodlands","sugar land","katy","pearland","clear lake",
    "pasadena","league city","friendswood","webster","nassau bay",
    "missouri city","stafford","richmond","rosenberg","cypress","tomball",
    "spring","humble","kingwood","atascocita","baytown","la porte",
    "deer park","channelview","galveston","texas city","dickinson",
    "conroe","huntsville","college station","bryan",
  ],
  "miami": [
    "miami","fort lauderdale","boca raton","coral gables","doral","hialeah",
    "hollywood","miami beach","south beach","north miami","aventura",
    "sunny isles","hallandale","pembroke pines","miramar","weston",
    "plantation","davie","sunrise","lauderhill","tamarac","coral springs",
    "coconut creek","pompano beach","deerfield beach","delray beach",
    "boynton beach","west palm beach","palm beach gardens","jupiter",
    "stuart","port st lucie","homestead","key biscayne","key west",
    "kendall","pinecrest","palmetto bay","cutler bay",
  ],
  "portland": [
    "portland","beaverton","hillsboro","lake oswego","tigard","tualatin",
    "wilsonville","sherwood","west linn","oregon city","milwaukie",
    "clackamas","gresham","troutdale","wood village","fairview",
    "happy valley","damascus","camas","vancouver","washougal",
    "battle ground","ridgefield","salmon creek",
  ],
  "minneapolis": [
    "minneapolis","saint paul","st paul","bloomington","eden prairie",
    "plymouth","minnetonka","wayzata","edina","richfield","st louis park",
    "golden valley","brooklyn park","maple grove","rogers","elk river",
    "burnsville","eagan","apple valley","lakeville","prior lake",
    "savage","shakopee","chanhassen","chaska","woodbury","cottage grove",
    "stillwater","roseville","arden hills","shoreview","maplewood",
    "white bear lake","fridley","columbia heights","duluth",
  ],
  "raleigh": [
    "raleigh","durham","chapel hill","cary","research triangle","morrisville",
    "apex","holly springs","fuquay-varina","wake forest","garner",
    "knightdale","wendell","zebulon","clayton","smithfield","sanford",
    "pittsboro","hillsborough","mebane","burlington","graham",
    "greensboro","winston-salem","high point","charlotte",
  ],
  "detroit": [
    "detroit","ann arbor","dearborn","troy","southfield","royal oak",
    "birmingham","bloomfield hills","farmington hills","novi","livonia",
    "plymouth","canton","westland","ypsilanti","saline","chelsea",
    "brighton","howell","pontiac","auburn hills","rochester hills",
    "sterling heights","warren","macomb","shelby township","clinton township",
    "st clair shores","grosse pointe","wyandotte","downriver",
  ],
  "philadelphia": [
    "philadelphia","king of prussia","conshohocken","wayne","malvern",
    "cherry hill","haddonfield","moorestown","mount laurel","marlton",
    "ardmore","bryn mawr","villanova","radnor","devon","paoli","exton",
    "west chester","downingtown","coatesville","norristown","blue bell",
    "fort washington","ambler","lansdale","doylestown","newtown",
    "yardley","morrisville","bensalem","levittown","media","springfield",
    "swarthmore","havertown","drexel hill","upper darby",
    "wilmington","newark","bear","middletown","dover",
    "trenton","princeton","lawrenceville","hamilton",
  ],
  "san diego": [
    "san diego","la jolla","carlsbad","encinitas","del mar","chula vista",
    "solana beach","oceanside","vista","escondido","san marcos","poway",
    "rancho bernardo","scripps ranch","mira mesa","kearny mesa","mission valley",
    "hillcrest","north park","south park","golden hill","barrio logan",
    "coronado","imperial beach","national city","el cajon","la mesa",
    "santee","ramona","fallbrook","temecula","murrieta",
  ],
  "phoenix": [
    "phoenix","scottsdale","tempe","mesa","chandler","gilbert",
    "glendale","peoria","surprise","goodyear","avondale","buckeye",
    "queen creek","san tan valley","fountain hills","cave creek",
    "carefree","paradise valley","anthem","sun city","sun city west",
    "litchfield park","tolleson","laveen","ahwatukee",
    "flagstaff","sedona","prescott","tucson",
  ],
  "pittsburgh": [
    "pittsburgh","carnegie","cranberry township","wexford","sewickley",
    "moon township","robinson","bridgeville","south hills","mount lebanon",
    "bethel park","upper st clair","peters township","canonsburg",
    "washington","monroeville","murrysville","irwin","greensburg",
    "latrobe","butler","beaver","aliquippa",
  ],
  "salt lake city": [
    "salt lake city","provo","lehi","draper","park city","orem",
    "sandy","murray","midvale","west jordan","south jordan","riverton",
    "herriman","taylorsville","west valley city","magna","kearns",
    "bountiful","centerville","farmington","layton","kaysville","ogden",
    "pleasant grove","american fork","lindon","springville","spanish fork",
    "payson","nephi","heber city","midway",
  ],
  "nashville": [
    "nashville","franklin","brentwood","murfreesboro","smyrna","la vergne",
    "hendersonville","gallatin","mount juliet","lebanon","hermitage",
    "antioch","bellevue","goodlettsville","madison","spring hill",
    "thompson's station","nolensville","columbia","clarksville",
  ],
};

// Build a reverse lookup: city name → list of metro area names it belongs to
const CITY_TO_METROS: Record<string, string[]> = {};
for (const [metro, cities] of Object.entries(METRO_AREAS)) {
  for (const city of cities) {
    if (!CITY_TO_METROS[city]) CITY_TO_METROS[city] = [];
    CITY_TO_METROS[city].push(metro);
  }
}

// Flat set of all US cities for isUSLocation detection
const US_CITIES = new Set([
  ...Object.values(METRO_AREAS).flat(),
  // Additional cities not in a metro group
  "nashville","charlotte","cleveland","south burlington","sacramento",
  "harrisburg","las vegas","redlands","akron","rogers",
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
  const [groupBy, setGroupBy] = useState<"date" | "company" | "date-company">("date");
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());

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

  // Collect unique grouped role types present in data
  const roleTypes = useMemo(() => {
    const types = new Set<string>();
    allJobs.forEach((job) => {
      if (job.roleType) {
        const group = ROLE_GROUP[job.roleType] || job.roleType;
        types.add(group);
      }
    });
    return Array.from(types).sort();
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const maxDays = dateFilter === "7" ? 7 : dateFilter === "30" ? 30 : 45;
    return allJobs.filter((job) => {
      const isArchived = archived.has(job.id);
      if (showArchived && !isArchived) return false;
      if (!showArchived && isArchived) return false;

      // Always exclude jobs older than 45 days
      if (job.posted) {
        const daysAgo = (now.getTime() - new Date(job.posted + "T00:00:00").getTime()) / 86400000;
        if (daysAgo > 45) return false;
        if (dateFilter !== "all" && daysAgo > maxDays) return false;
      } else {
        return false;
      }

      const q = search.toLowerCase();
      let matchesSearch = !search ||
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        job.location.toLowerCase().includes(q);
      // Metro area expansion: if search query is exactly a metro name, also match its cities
      if (!matchesSearch && search) {
        const jobCity = job.city.toLowerCase();
        if (jobCity) {
          const metro = METRO_AREAS[q];
          if (metro && metro.some((c) => c === jobCity)) {
            matchesSearch = true;
          }
        }
      }
      const jobRoleGroup = ROLE_GROUP[job.roleType] || job.roleType;
      const matchesRole =
        roleType === "all" || jobRoleGroup === roleType;
      let matchesLocation = false;
      if (location === "all") {
        matchesLocation = true;
      } else if (location === "remote") {
        matchesLocation = job.remote;
      } else if (location === "us") {
        matchesLocation = isUSLocation(job.location);
      } else if (location === "us_inperson") {
        matchesLocation = isUSLocation(job.location) && !job.remote;
      } else if (location.startsWith("metro_")) {
        const metro = location.slice(6);
        const cities = METRO_AREAS[metro];
        if (cities) {
          const jobCity = job.city.toLowerCase();
          matchesLocation = jobCity ? cities.includes(jobCity) : false;
        }
      }
      return matchesSearch && matchesRole && matchesLocation;
    });
  }, [search, roleType, location, dateFilter, showArchived, archived]);

  const archivedCount = useMemo(
    () => allJobs.filter((j) => archived.has(j.id)).length,
    [archived]
  );

  // Letters that have companies (for the alphabet bar)
  const availableLetters = useMemo(() => {
    if (groupBy !== "company") return new Set<string>();
    const letters = new Set<string>();
    for (const job of filtered) {
      const first = formatCompany(job.company).charAt(0).toUpperCase();
      if (first) letters.add(first);
    }
    return letters;
  }, [filtered, groupBy]);

  type Group = { label: string; key: string; jobs: Job[]; companyUrl?: string; subgroups?: Group[] };

  const grouped = useMemo((): Group[] => {
    if (groupBy === "company") {
      const map = new Map<string, Job[]>();
      for (const job of filtered) {
        const key = job.company;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(job);
      }
      let entries = Array.from(map.entries())
        .sort((a, b) => formatCompany(a[0]).localeCompare(formatCompany(b[0])));
      if (letterFilter) {
        entries = entries.filter(([company]) =>
          formatCompany(company).charAt(0).toUpperCase() === letterFilter
        );
      }
      return entries.map(([company, jobs]) => ({
        label: formatCompany(company),
        key: company,
        companyUrl: jobs[0]?.companyUrl,
        jobs,
      }));
    }
    if (groupBy === "date-company") {
      // Group by date first, then by company within each date
      const dateMap = new Map<string, Job[]>();
      for (const job of filtered) {
        const date = job.posted || "Unknown";
        if (!dateMap.has(date)) dateMap.set(date, []);
        dateMap.get(date)!.push(job);
      }
      return Array.from(dateMap.entries()).map(([date, dateJobs]) => {
        const companyMap = new Map<string, Job[]>();
        for (const job of dateJobs) {
          if (!companyMap.has(job.company)) companyMap.set(job.company, []);
          companyMap.get(job.company)!.push(job);
        }
        const subgroups = Array.from(companyMap.entries())
          .sort((a, b) => formatCompany(a[0]).localeCompare(formatCompany(b[0])))
          .map(([company, jobs]) => ({
            label: formatCompany(company),
            key: `${date}-${company}`,
            companyUrl: jobs[0]?.companyUrl,
            jobs,
          }));
        return {
          label: date === "Unknown" ? "Unknown date" : formatDate(date),
          key: date,
          jobs: dateJobs,
          subgroups,
        };
      });
    }
    // Default: group by date
    const groups: Group[] = [];
    let current: Group | null = null;
    for (const job of filtered) {
      const date = job.posted || "Unknown";
      if (!current || current.key !== date) {
        current = {
          label: date === "Unknown" ? "Unknown date" : formatDate(date),
          key: date,
          jobs: [],
        };
        groups.push(current);
      }
      current.jobs.push(job);
    }
    return groups;
  }, [filtered, groupBy, letterFilter]);

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
            className="mt-3 sm:mt-0 sm:absolute sm:right-6 sm:top-8 bg-white/50 border-white/50 hover:bg-gray-800 hover:text-white"
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
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <Input
            aria-label="Search jobs, companies, and locations"
            placeholder="Search jobs, companies, locations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-gray-800 text-white placeholder:text-gray-400 border-gray-700"
          />
          <Select value={roleType} onValueChange={setRoleType}>
            <SelectTrigger aria-label="Filter by role" className="w-full bg-gray-800 text-white border-gray-700">
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
            <SelectTrigger aria-label="Filter by location" className="w-full bg-gray-800 text-white border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              <SelectItem value="us">US only</SelectItem>
              <SelectItem value="us_inperson">US in-person</SelectItem>
              <SelectItem value="remote">Remote</SelectItem>
              <SelectItem value="metro_new york">NYC Metro</SelectItem>
              <SelectItem value="metro_los angeles">LA Metro</SelectItem>
              <SelectItem value="metro_seattle">Seattle Metro</SelectItem>
              <SelectItem value="metro_chicago">Chicago Metro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger aria-label="Filter by date range" className="w-full bg-gray-800 text-white border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="all">Last 45 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={groupBy} onValueChange={(v) => { setGroupBy(v as "date" | "company" | "date-company"); setLetterFilter(null); }}>
            <SelectTrigger aria-label="Group jobs by" className="w-full bg-gray-800 text-white border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">By date</SelectItem>
              <SelectItem value="company">By company</SelectItem>
              <SelectItem value="date-company">By date &amp; company</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Alphabet bar */}
        {groupBy === "company" && (
          <div className="mt-4 flex flex-wrap gap-1 justify-center">
            <button
              onClick={() => setLetterFilter(null)}
              className={`px-2 py-1 text-sm rounded-sm transition-colors ${
                letterFilter === null
                  ? "bg-gray-800 text-white"
                  : "text-muted-foreground hover:bg-gray-800 hover:text-white"
              }`}
            >
              All
            </button>
            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => {
              const hasCompanies = availableLetters.has(letter);
              return (
                <button
                  key={letter}
                  disabled={!hasCompanies}
                  onClick={() => setLetterFilter(letterFilter === letter ? null : letter)}
                  className={`px-2 py-1 text-sm rounded-sm transition-colors ${
                    letterFilter === letter
                      ? "bg-gray-800 text-white"
                      : hasCompanies
                        ? "text-muted-foreground hover:bg-gray-800 hover:text-white"
                        : "text-muted-foreground/30 cursor-default"
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        )}

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

            function renderJobCard(job: Job) {
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
                      {groupBy !== "company" && groupBy !== "date-company" && (
                        job.companyUrl ? (
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
                        )
                      )}
                      {job.remote && (
                        <Badge variant="secondary" className="text-xs bg-yellow-200/80 border-yellow-300">
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
                    <Button variant="outline" size="sm" asChild className="hover:bg-gray-800 hover:text-white">
                      <a href={job.url} target="_blank" rel="noopener noreferrer">
                        View
                      </a>
                    </Button>
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
            }

            function renderCollapsibleCompany(sub: Group) {
              const isExpanded = expandedCompanies.has(sub.key);
              return (
                <div key={sub.key}>
                  <button
                    onClick={() => setExpandedCompanies((prev) => {
                      const next = new Set(prev);
                      if (next.has(sub.key)) next.delete(sub.key);
                      else next.add(sub.key);
                      return next;
                    })}
                    className="w-full flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/50 transition-colors cursor-pointer"
                  >
                    <svg
                      className={`size-3.5 shrink-0 text-muted-foreground/50 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                    <span className="text-sm font-semibold text-foreground">
                      {sub.label}
                    </span>
                    <span className="text-sm text-muted-foreground/50">
                      {sub.jobs.length} {sub.jobs.length === 1 ? "job" : "jobs"}
                    </span>
                    {sub.companyUrl && (
                      <a
                        href={sub.companyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="ml-auto text-muted-foreground/40 hover:text-muted-foreground"
                      >
                        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                      </a>
                    )}
                  </button>
                  {isExpanded && (
                    <div className="space-y-2 mt-1 ml-4">
                      {sub.jobs.map((job) => renderJobCard(job))}
                    </div>
                  )}
                </div>
              );
            }

            return grouped.map((group) => (
              <div key={group.key} className="mt-16 first:mt-0">
                <div className="flex items-center gap-3 pb-3">
                  <span className="text-lg font-semibold text-muted-foreground">
                    {group.label}
                    {(groupBy === "company") && (
                      <>{" "}<span className="text-muted-foreground/50">({group.jobs.length})</span></>
                    )}
                  </span>
                  <div className="flex-1 border-b border-dashed border-muted-foreground/30" />
                </div>
                {groupBy === "date-company" && group.subgroups ? (
                  <div className="space-y-1">
                    {group.subgroups.map((sub) => renderCollapsibleCompany(sub))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {group.jobs.map((job) => renderJobCard(job))}
                  </div>
                )}
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
