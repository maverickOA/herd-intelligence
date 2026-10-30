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

export type FieldErrors = Record<string, string[] | undefined>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}
