import { Icon } from "@/components/icons";
import { formatDate } from "@/features/affiliates/format";

import { countArchivedBeneficiaries, legacyPlatformUrl, searchArchivedMembers, type ArchivedMember } from "./repository";

const archivedDate = (iso: string) => formatDate(iso.slice(0, 10));

function MemberLine({ member, beneficiaries }: { member: ArchivedMember; beneficiaries?: number }) {
  const document = member.documentNumber ? `${member.documentType ?? "CC"} ${member.documentNumber}` : "sin documento registrado";
  if (member.personType === "titular") {
    return (
      <li>
        <strong>{member.name}</strong> · {document}
        <span>
          Titular con estado <b>Retirado</b>, archivado el {archivedDate(member.archivedAt)}
          {beneficiaries ? ` · tenía ${beneficiaries.toLocaleString("es-CO")} ${beneficiaries === 1 ? "beneficiario" : "beneficiarios"}` : ""}
          {member.legacyMemberId ? <> · ID en la plataforma antigua: <b>{member.legacyMemberId}</b></> : null}
        </span>
      </li>
    );
  }
  return (
    <li>
      <strong>{member.name}</strong> · {document}
      <span>
        Beneficiario ({member.relationship?.toLowerCase() ?? "sin parentesco"}) de {member.titularName ?? "un titular"}
        {member.titularDocumentNumber ? ` (CC ${member.titularDocumentNumber})` : ""}, titular <b>Retirado</b> archivado el {archivedDate(member.archivedAt)}
        {member.legacyMemberId ? <> · ID del titular en la plataforma antigua: <b>{member.legacyMemberId}</b></> : null}
      </span>
    </li>
  );
}

/**
 * Shown next to search results: people who matched the query but were archived after retiring.
 * Their payments and beneficiaries live only in the old platform now. When the titular itself
 * matched, its beneficiaries fold into a count instead of one line each.
 */
export async function ArchivedMatches({ query, limit = 5 }: { query: string; limit?: number }) {
  const found = await searchArchivedMembers(query, 25);
  if (!found.length) return null;

  const titularDocuments = new Set(found.filter((member) => member.personType === "titular").map((member) => member.documentNumber));
  const matches = found
    .filter((member) => member.personType === "titular" || !titularDocuments.has(member.titularDocumentNumber))
    .slice(0, limit);
  const beneficiaryCounts = await Promise.all(
    matches.map((member) => (member.personType === "titular" && member.documentNumber ? countArchivedBeneficiaries(member.documentNumber) : Promise.resolve(0))),
  );
  const url = legacyPlatformUrl();

  return (
    <section className="archived-notice" role="status" aria-label="Registros archivados">
      <span className="archived-notice-icon" aria-hidden="true"><Icon name="lock" size={19} /></span>
      <div>
        <strong>{matches.length === 1 ? "Esta persona tenía estado Retirado y fue archivada" : "Coincidencias en el archivo de retirados"}</strong>
        <p>
          Su información (pagos, beneficiarios y observaciones) ya no está en esta plataforma. Para consultarla ingresa a la
          {" "}{url ? <a href={url} target="_blank" rel="noopener noreferrer">plataforma antigua</a> : "plataforma antigua"}.
        </p>
        <ul>
          {matches.map((member, index) => <MemberLine key={member.id} member={member} beneficiaries={beneficiaryCounts[index]} />)}
        </ul>
      </div>
    </section>
  );
}
