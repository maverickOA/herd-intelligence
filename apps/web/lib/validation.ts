import { z } from "zod";
import { Constants } from "@/lib/database.types";

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const email = z.string().trim().toLowerCase().email("Enter a valid email address");
export const password = z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters");
export const uuid = z.string().uuid();

export const signInSchema = z.object({ email, password: z.string().min(1, "Enter your password") });

export const signUpSchema = z.object({
  fullName: trimmed(2, 120, "Name"),
  email,
  password,
});

export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export const organizationSchema = z.object({
  name: trimmed(2, 120, "Organization name"),
  firstFarmName: trimmed(2, 120, "Farm name"),
});

export const orgSettingsSchema = z.object({
  orgId: uuid,
  name: trimmed(2, 120, "Organization name"),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use a 2-letter country code"),
  currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code"),
  timezone: z.string().trim().min(3).max(64),
});

export const farmSchema = z.object({
  orgId: uuid,
  name: trimmed(2, 120, "Farm name"),
  address: optionalText(300),
});

export const farmUpdateSchema = farmSchema.extend({ farmId: uuid });

export const penSchema = z.object({
  orgId: uuid,
  farmId: uuid,
  name: trimmed(1, 80, "Pen name"),
  penType: z.enum(Constants.public.Enums.pen_type),
  capacity: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 100000), "Capacity must be a whole number above 0"),
});

export const penUpdateSchema = penSchema.extend({ penId: uuid });

export const inviteSchema = z
  .object({
    orgId: uuid,
    email,
    role: z.enum(Constants.public.Enums.member_role),
    farmIds: z.array(uuid),
  })
  .refine((v) => v.role === "owner" || v.farmIds.length > 0, {
    path: ["farmIds"],
    message: "Choose at least one farm",
  });

export const profileSchema = z.object({
  fullName: trimmed(2, 120, "Name"),
  phone: optionalText(32),
});

const blankToNull = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));

const isoDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), "Enter a valid date")
  .refine((v) => v === null || v <= new Date().toISOString().slice(0, 10), "Date cannot be in the future");

const optionalUuid = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || /^[0-9a-f-]{36}$/i.test(v), "Invalid choice");

export const animalFields = {
  tag: blankToNull.refine((v) => v === null || v.length <= 40, "Tag must be at most 40 characters"),
  name: blankToNull.refine((v) => v === null || v.length <= 80, "Name must be at most 80 characters"),
  registrationNumber: blankToNull.refine((v) => v === null || v.length <= 60, "Too long"),
  sex: z.enum(Constants.public.Enums.animal_sex, { error: "Choose buck or doe" }),
  breedId: optionalUuid,
  birthDate: isoDate,
  birthDateEstimated: z.boolean(),
  color: blankToNull.refine((v) => v === null || v.length <= 60, "Too long"),
  markings: blankToNull.refine((v) => v === null || v.length <= 200, "Too long"),
  notes: blankToNull.refine((v) => v === null || v.length <= 2000, "Too long"),
  isDeclaredFounder: z.boolean(),
  farmId: optionalUuid,
  penId: optionalUuid,
};

export const newAnimalSchema = z
  .object({
    orgId: uuid,
    origin: z.enum(Constants.public.Enums.animal_origin),
    ...animalFields,
    status: z.enum(Constants.public.Enums.animal_status),
    sireId: optionalUuid,
    damId: optionalUuid,
    parentConfidence: z.enum(Constants.public.Enums.parent_confidence),
    acquiredOn: isoDate,
    source: blankToNull.refine((v) => v === null || v.length <= 120, "Too long"),
    price: blankToNull.refine((v) => v === null || (/^\d{1,12}(\.\d{1,2})?$/.test(v.replace(/,/g, ""))), "Enter an amount, e.g. 85000"),
    childOf: optionalUuid,
    childRole: z.enum(["", ...Constants.public.Enums.parent_role]),
  })
  .refine((v) => v.tag || v.name || v.registrationNumber, { path: ["tag"], message: "Give at least a tag, a name or a registration number" })
  .refine((v) => v.origin === "pedigree_only" || v.farmId, { path: ["farmId"], message: "Choose the farm" })
  .refine((v) => !v.birthDateEstimated || v.birthDate, { path: ["birthDate"], message: "Enter the estimated date" });

export const editAnimalSchema = z
  .object({
    orgId: uuid,
    animalId: uuid,
    isRecordOnly: z.boolean(),
    ...animalFields,
    status: z.enum(Constants.public.Enums.animal_status),
  })
  .refine((v) => v.tag || v.name || v.registrationNumber, { path: ["tag"], message: "Give at least a tag, a name or a registration number" })
  .refine((v) => v.isRecordOnly || v.farmId, { path: ["farmId"], message: "Choose the farm" })
  .refine((v) => !v.birthDateEstimated || v.birthDate, { path: ["birthDate"], message: "Enter the estimated date" });

export const setParentSchema = z.object({
  orgId: uuid,
  childId: uuid,
  role: z.enum(Constants.public.Enums.parent_role),
  parentId: optionalUuid,
  confidence: z.enum(Constants.public.Enums.parent_confidence),
  evidence: blankToNull.refine((v) => v === null || v.length <= 300, "Too long"),
});

export const acquisitionSchema = z.object({
  orgId: uuid,
  animalId: uuid,
  acquiredOn: isoDate,
  source: blankToNull.refine((v) => v === null || v.length <= 120, "Too long"),
  price: blankToNull.refine((v) => v === null || (/^\d{1,12}(\.\d{1,2})?$/.test(v.replace(/,/g, ""))), "Enter an amount, e.g. 85000"),
  notes: blankToNull.refine((v) => v === null || v.length <= 500, "Too long"),
});

export type FieldErrors = Record<string, string[] | undefined>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}
