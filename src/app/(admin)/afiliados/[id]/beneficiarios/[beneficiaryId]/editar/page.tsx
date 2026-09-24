import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getFullName } from "@/features/affiliates/format";
import { getBeneficiary } from "@/features/affiliates/repository";
import { updateBeneficiary } from "@/features/beneficiaries/actions";
import { BeneficiaryForm } from "@/features/beneficiaries/beneficiary-form";
import type { BeneficiaryFormValues } from "@/features/beneficiaries/validation";
import { listMunicipalities } from "@/features/catalogs/repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type EditBeneficiaryPageProps = { params: Promise<{ id: string; beneficiaryId: string }> };

export async function generateMetadata({ params }: EditBeneficiaryPageProps): Promise<Metadata> {
  const { id, beneficiaryId } = await params;
  const record = await getBeneficiary(id, beneficiaryId);
  return { title: record ? `Editar ${getFullName(record.beneficiary)}` : "Beneficiario no encontrado" };
}

export default async function EditBeneficiaryPage({ params }: EditBeneficiaryPageProps) {
  const { id, beneficiaryId } = await params;
  const [record, municipalities] = await Promise.all([getBeneficiary(id, beneficiaryId), listMunicipalities()]);
  if (!record) notFound();

  const { affiliate, beneficiary } = record;
  const affiliateName = getFullName(affiliate);
  const beneficiaryName = getFullName(beneficiary);
  const initialValues: BeneficiaryFormValues = {
    relationship: beneficiary.relationship,
    documentType: beneficiary.documentType ?? "CC",
    documentNumber: beneficiary.documentNumber ?? "",
    documentIssuedOn: beneficiary.documentIssuedOn ?? "",
    firstNames: beneficiary.firstNames,
    lastNames: beneficiary.lastNames,
    birthDate: beneficiary.birthDate,
    phone: beneficiary.phone ?? "",
    email: beneficiary.email ?? "",
    joinedOn: beneficiary.joinedOn,
    status: beneficiary.status,
    deceasedOn: beneficiary.deceasedOn ?? "",
    deathMunicipalityId: beneficiary.deathMunicipalityId ?? "",
    deathRegistryNumber: beneficiary.deathRegistryNumber ?? "",
    deathNotary: beneficiary.deathNotary ?? "",
    deathServiceProvided: beneficiary.deathServiceProvided ?? "",
    deathServiceAmount: beneficiary.deathServiceAmount !== null && beneficiary.deathServiceAmount !== undefined ? String(beneficiary.deathServiceAmount) : "",
    successorBank: beneficiary.successorBank ?? "",
    successorAccountNumber: beneficiary.successorAccountNumber ?? "",
    successorAccountType: beneficiary.successorAccountType ?? "",
  };
  const updateAction = updateBeneficiary.bind(null, id, beneficiaryId);

  return (
    <>
      <nav className="breadcrumb" aria-label="Migas de pan">
        <Link href="/afiliados">Afiliados</Link><span>/</span>
        <Link href={`/afiliados/${id}`}>{affiliateName}</Link><span>/</span>
        <Link href={`/afiliados/${id}/beneficiarios/${beneficiaryId}`}>{beneficiaryName}</Link><span>/</span>
        <span aria-current="page">Editar</span>
      </nav>
      <header className="page-heading form-page-heading">
        <div>
          <p className="eyebrow">Grupo familiar</p>
          <h1>Editar beneficiario</h1>
          <p>Modifica la información de {beneficiaryName}, vinculado a {affiliateName}.</p>
        </div>
      </header>
      <BeneficiaryForm
        action={updateAction}
        initialValues={initialValues}
        mode="edit"
        persistenceEnabled={isSupabaseConfigured()}
        cancelHref={`/afiliados/${id}/beneficiarios/${beneficiaryId}`}
        affiliateName={affiliateName}
        municipalities={municipalities}
      />

    </>
  );
}
