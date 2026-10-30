import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ChevronLeft } from "lucide-react";
import { getOrgContext } from "@/lib/data";
import { getAnimalDetail } from "@/lib/herd";
import { SEX_LABEL, animalLabel } from "@/lib/labels";
import { siteUrl } from "@/lib/site";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "QR tag" };

/*
 * The QR code holds only a link with the animal's random id: no name, price or
 * owner. Scanning it still requires signing in with access to that farm.
 */
export default async function TagPage({ params }: PageProps<"/o/[orgId]/herd/[animalId]/tag">) {
  const { orgId, animalId } = await params;
  const ctx = await getOrgContext(orgId);
  const { animal, breed, farm } = await getAnimalDetail(orgId, animalId, false);
  if (!animal.farm_id) notFound();
  const url = `${await siteUrl()}/a/${animal.id}`;
  const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#000000", light: "#ffffff" } });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/o/${orgId}/herd/${animal.id}`} className="inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden /> {animalLabel(animal)}
        </Link>
        <PrintButton />
      </div>

      <div className="mx-auto w-full max-w-xs rounded-xl border-2 border-dashed bg-white p-5 text-center text-black print:max-w-[60mm] print:border print:p-3">
        <div className="mx-auto w-full max-w-56 [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label={`QR code for ${animalLabel(animal)}`} dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-3 text-2xl font-bold tracking-wide break-words">{animal.tag ?? animal.name ?? "Animal"}</p>
        {animal.tag && animal.name && <p className="text-base">{animal.name}</p>}
        <p className="mt-1 text-xs">
          {[SEX_LABEL[animal.sex], breed?.name, farm?.name].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-2 text-[0.65rem] text-neutral-600">{ctx.org.name} · Scan to open in Herd Intelligence</p>
      </div>

      <p className="mx-auto mt-4 max-w-sm text-center text-sm text-muted-foreground print:hidden">
        Print and laminate, or stick it on the pen. Scanning with any phone camera opens this animal after signing in.
      </p>
    </>
  );
}
