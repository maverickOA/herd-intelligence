import type { Enums } from "@/lib/database.types";

export const ROLE_LABEL: Record<Enums<"member_role">, string> = {
  owner: "Owner",
  manager: "Farm manager",
  worker: "Farm worker",
  vet: "Vet or consultant",
};

export const ROLE_HELP: Record<Enums<"member_role">, string> = {
  owner: "Everything in the organization, including team and settings.",
  manager: "Manages the farms you choose: details and pens.",
  worker: "Sees the farms you choose. Registers animals and records matings, pregnancy checks and kiddings there.",
  vet: "Sees the farms you choose. Records pregnancy checks, matings and kiddings there. Health records arrive in phase 2.",
};

export const PEN_TYPE_LABEL: Record<Enums<"pen_type">, string> = {
  pen: "Pen",
  paddock: "Paddock",
  kidding: "Kidding pen",
  quarantine: "Quarantine",
  pasture: "Pasture",
  other: "Other",
};

export const STATUS_LABEL: Record<Enums<"animal_status">, string> = {
  active: "Active",
  breeding: "Breeding",
  pregnant: "Pregnant",
  nursing: "Nursing",
  growing: "Growing",
  quarantined: "Quarantined",
  sold: "Sold",
  deceased: "Deceased",
  culled: "Culled",
};

/** Statuses for animals that have left the herd. */
export const GONE_STATUSES: Enums<"animal_status">[] = ["sold", "deceased", "culled"];

export const ORIGIN_LABEL: Record<Enums<"animal_origin">, string> = {
  purchased: "Bought",
  born_on_farm: "Born on the farm",
  received: "Received (gift or transfer)",
  pedigree_only: "Ancestor from records only",
};

export const CONFIDENCE_LABEL: Record<Enums<"parent_confidence">, string> = {
  dna: "DNA confirmed",
  observed: "Seen or documented",
  reported: "Reported by previous owner",
  assumed: "Assumed",
};

export const CONFIDENCE_SHORT: Record<Enums<"parent_confidence">, string> = {
  dna: "DNA",
  observed: "seen",
  reported: "reported",
  assumed: "assumed",
};

/** Goat terms; other species will read these from the species table. */
export const SEX_LABEL: Record<Enums<"animal_sex">, string> = { male: "Buck", female: "Doe" };

export function animalLabel(a: { tag: string | null; name: string | null; registration_number?: string | null }) {
  if (a.tag && a.name) return `${a.tag} · ${a.name}`;
  return a.tag ?? a.name ?? a.registration_number ?? "Unnamed animal";
}

/** "2 yr 3 mo", "5 mo", "3 wk"; prefixed with "about" for estimated dates. */
export function ageText(birthDate: string | null, estimated: boolean, now = new Date()): string | null {
  if (!birthDate) return null;
  const b = new Date(`${birthDate}T00:00:00Z`);
  const days = Math.floor((now.getTime() - b.getTime()) / 86_400_000);
  if (days < 0) return null;
  let text: string;
  if (days < 56) text = days < 14 ? `${days} day${days === 1 ? "" : "s"}` : `${Math.floor(days / 7)} wk`;
  else {
    const months = Math.floor(days / 30.4375);
    const y = Math.floor(months / 12);
    const m = months % 12;
    text = y ? `${y} yr${m ? ` ${m} mo` : ""}` : `${m} mo`;
  }
  return estimated ? `about ${text}` : text;
}

export function initials(name: string | null, email: string | null) {
  const source = (name ?? email ?? "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function formatDate(iso: string, timezone = "Africa/Lagos") {
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: timezone }).format(
    new Date(iso),
  );
}

/* ---------- Breeding (M4) ---------- */

/** Engine wording. Never "safe": a low result reflects recorded ancestry only. */
export const CLASS_LABEL: Record<Enums<"breeding_class">, string> = {
  low: "Low known pedigree risk",
  elevated: "Elevated pedigree risk",
  insufficient: "Insufficient pedigree information",
  high: "High pedigree risk",
  restricted: "Restricted by farm breeding policy",
};

export const CLASS_SHORT: Record<Enums<"breeding_class">, string> = {
  low: "Low known risk",
  elevated: "Elevated",
  insufficient: "Not enough pedigree",
  high: "High risk",
  restricted: "Restricted",
};

export const METHOD_LABEL: Record<Enums<"mating_method">, string> = {
  hand: "Hand mating (supervised)",
  pasture: "Running with the herd",
  ai: "Artificial insemination (AI)",
};

export const METHOD_SHORT: Record<Enums<"mating_method">, string> = { hand: "Hand mating", pasture: "With the herd", ai: "AI" };

export const OUTCOME_LABEL: Record<Enums<"mating_outcome">, string> = {
  awaiting_check: "Awaiting pregnancy check",
  pregnant: "Pregnant",
  not_pregnant: "Not pregnant",
  kidded: "Kidded",
};

export const PREG_METHOD_LABEL: Record<Enums<"pregnancy_method">, string> = {
  ultrasound: "Ultrasound scan",
  blood_test: "Blood test",
  observation: "Observation (no return to heat, belly, udder)",
};

export const PREG_RESULT_LABEL: Record<Enums<"pregnancy_result">, string> = {
  pregnant: "Pregnant",
  not_pregnant: "Not pregnant",
  unsure: "Unsure",
};

/** "1 Mar 2026" from a plain date (no time-zone shift). */
export function formatDay(isoDate: string) {
  return formatDate(`${isoDate}T12:00:00Z`, "UTC");
}

/** Whole days from today (UTC) to a plain date; negative when past. */
export function daysUntil(isoDate: string, now = new Date()) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - today) / 86_400_000);
}

export function pct(v: number | string, digits = 2) {
  const n = Number(v) * 100;
  return `${Number(n.toFixed(digits))}%`;
}

/** Relationships a breeding policy can block outright. */
export const RELATIONSHIPS: { code: string; label: string }[] = [
  { code: "parent-offspring", label: "Parent and offspring" },
  { code: "full-siblings", label: "Full siblings" },
  { code: "half-siblings", label: "Half siblings" },
  { code: "grandparent-grandchild", label: "Grandparent and grandchild" },
  { code: "uncle-aunt-niece-nephew", label: "Uncle or aunt and niece or nephew" },
  { code: "double-first-cousins", label: "Double first cousins" },
  { code: "first-cousins", label: "First cousins" },
];
