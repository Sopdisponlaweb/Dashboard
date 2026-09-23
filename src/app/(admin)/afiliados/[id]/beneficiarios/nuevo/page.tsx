import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createBeneficiary } from "@/features/beneficiaries/actions";
import { BeneficiaryForm } from "@/features/beneficiaries/beneficiary-form";
import type { BeneficiaryFormValues } from "@/features/beneficiaries/validation";
import { getFullName } from "@/features/affiliates/format";
import { getAffiliateById } from "@/features/affiliates/repository";
import { listMunicipalities } from "@/features/catalogs/repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type NewBeneficiaryPageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: NewBeneficiaryPageProps): Promise<Metadata> {
  const { id } = await params;
  const affiliate = await getAffiliateById(id);
  return { title: affiliate ? `Nuevo beneficiario · ${getFullName(affiliate)}` : "Afiliado no encontrado" };
}

export default async function NewBeneficiaryPage({ params }: NewBeneficiaryPageProps) {
  const { id } = await params;
  const [affiliate, municipalities] = await Promise.all([getAffiliateById(id), listMunicipalities()]);
  if (!affiliate) notFound();

  const affiliateName = getFullName(affiliate);
  const initialValues: BeneficiaryFormValues = {
    relationship: "",
    documentType: "CC",
    documentNumber: "",
    documentIssuedOn: "",
    firstNames: "",
    lastNames: "",
    birthDate: "",
    phone: "",
    email: "",
    joinedOn: affiliate.joinedOn,
    status: "active",
    deceasedOn: "",
    deathMunicipalityId: "",
    deathRegistryNumber: "",
    deathNotary: "",
    deathServiceProvided: "",
    deathServiceAmount: "",
    successorBank: "",
    successorAccountNumber: "",
    successorAccountType: "",
  };
  const createAction = createBeneficiary.bind(null, id);

  return (
    <>
      <nav className="breadcrumb" aria-label="Migas de pan"><Link href="/afiliados">Afiliados</Link><span>/</span><Link href={`/afiliados/${id}`}>{affiliateName}</Link><span>/</span><span aria-current="page">Nuevo beneficiario</span></nav>
      <header className="page-heading form-page-heading"><div><p className="eyebrow">Grupo familiar</p><h1>Nuevo beneficiario</h1><p>Vincula una persona al titular sin perder la trazabilidad de su propia cobertura y estado.</p></div></header>
      <BeneficiaryForm action={createAction} initialValues={initialValues} mode="create" persistenceEnabled={isSupabaseConfigured()} cancelHref={`/afiliados/${id}`} affiliateName={affiliateName} municipalities={municipalities} />
    </>
  );
}
