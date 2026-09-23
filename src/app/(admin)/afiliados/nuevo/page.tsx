import type { Metadata } from "next";
import Link from "next/link";

import { AffiliateForm } from "@/features/affiliates/affiliate-form";
import { createAffiliate } from "@/features/affiliates/actions";
import type { AffiliateFormValues } from "@/features/affiliates/validation";
import { listMunicipalities, listPoliceRanks } from "@/features/catalogs/repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Nuevo afiliado" };

function todayInBogota() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function NewAffiliatePage() {
  const today = todayInBogota();
  const [municipalities, policeRanks] = await Promise.all([listMunicipalities(), listPoliceRanks()]);
  const initialValues: AffiliateFormValues = {
    documentType: "CC",
    documentNumber: "",
    documentIssuedOn: "",
    firstNames: "",
    lastNames: "",
    birthDate: "",
    phone: "",
    email: "",
    address: "",
    source: "particular",
    status: "active",
    joinedOn: today,
    deceasedOn: "",
    successorResolutionNumber: "",
    successorDocumentNumber: "",
    successorFirstNames: "",
    successorLastNames: "",
    successorPhone: "",
    deathMunicipalityId: "",
    deathRegistryNumber: "",
    deathNotary: "",
    deathServiceProvided: "",
    deathServiceAmount: "",
    successorBank: "",
    successorAccountNumber: "",
    successorAccountType: "",
    policeRankId: "",
  };

  return (
    <>
      <nav className="breadcrumb" aria-label="Migas de pan">
        <Link href="/afiliados">Afiliados</Link><span>/</span><span aria-current="page">Nuevo afiliado</span>
      </nav>
      <header className="page-heading form-page-heading">
        <div>
          <p className="eyebrow">Registro administrativo</p>
          <h1>Nuevo afiliado</h1>
          <p>Crea la ficha principal. Beneficiarios y documentos se agregarán desde la ficha después del registro.</p>
        </div>
      </header>
      <AffiliateForm
        action={createAffiliate}
        initialValues={initialValues}
        mode="create"
        persistenceEnabled={isSupabaseConfigured()}
        cancelHref="/afiliados"
        municipalities={municipalities}
        policeRanks={policeRanks}
      />
    </>
  );
}
