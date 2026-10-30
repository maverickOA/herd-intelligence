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
  worker: "Sees the farms you choose. Records work as features arrive.",
  vet: "Sees the farms you choose. Health records arrive in phase 2.",
};

export const PEN_TYPE_LABEL: Record<Enums<"pen_type">, string> = {
  pen: "Pen",
  paddock: "Paddock",
  kidding: "Kidding pen",
  quarantine: "Quarantine",
  pasture: "Pasture",
  other: "Other",
};

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
