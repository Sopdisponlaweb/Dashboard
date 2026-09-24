import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { formatDate, getFullName } from "@/features/affiliates/format";
import { getAffiliateById } from "@/features/affiliates/repository";
import { remainingBalance } from "@/features/credits/calculations";
import { registerSuccession } from "@/features/successions/actions";
import { getAffiliateSuccessions } from "@/features/successions/repository";
import { SuccessionForm } from "@/features/successions/succession-form";

type PageProps = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Registrar sucesión" };

export default async function RegisterSuccessionPage({ params }: PageProps) {
  const { id } = await params;
  const affiliate = await getAffiliateById(id);
  if (!affiliate) notFound();

  // Only a deceased titular without a current succession can get one.
  const successions = await getAffiliateSuccessions(id);
  if (affiliate.status !== "deceased" || successions.asDeceased) redirect(`/afiliados/${id}`);

  const fullName = getFullName(affiliate);
  const activeCredit = (affiliate.credits ?? []).find((credit) => credit.status === "active") ?? null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  const beneficiaries = affiliate.beneficiaries
    .filter((beneficiary) => beneficiary.status !== "deceased" && !beneficiary.promotedToAffiliateId)
    .map((beneficiary) => ({
      id: beneficiary.id,
      name: getFullName(beneficiary),
      relationship: beneficiary.relationship,
      documentType: beneficiary.documentType ?? null,
      documentNumber: beneficiary.documentNumber,
      phone: beneficiary.phone ?? null,
      email: beneficiary.email ?? null,
    }));

  return (
    <>
      <nav className="breadcrumb" aria-label="Ruta">
        <Link href="/afiliados">Afiliados</Link><span>/</span>
        <Link href={`/afiliados/${id}`}>{fullName}</Link><span>/</span>
        <span>Registrar sucesión</span>
      </nav>
      <header className="page-heading form-page-heading">
        <div>
          <p className="eyebrow">Sucesión</p>
          <h1>Registrar sucesión</h1>
          <p>
            {fullName} falleció{affiliate.deceasedOn ? ` el ${formatDate(affiliate.deceasedOn)}` : ""}. Elige quién queda como titular,
            qué beneficiarios pasan y qué ocurre con el crédito. Los pagos no se mueven: el sucesor verá el historial del fallecido.
          </p>
        </div>
      </header>

      <SuccessionForm
        action={registerSuccession.bind(null, id)}
        deceased={{ id, name: fullName, source: affiliate.source, joinedOn: affiliate.joinedOn, lastPaymentOn: affiliate.lastPaymentOn }}
        beneficiaries={beneficiaries}
        activeCredit={activeCredit ? { remainingTotal: remainingBalance(activeCredit, activeCredit.installments).remainingTotal, totalAmount: activeCredit.totalAmount } : null}
        today={today}
      />
    </>
  );
}
