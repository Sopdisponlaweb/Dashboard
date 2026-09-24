import Link from "next/link";

import { Icon } from "@/components/icons";
import { documentKindLabels, formatDate } from "@/features/affiliates/format";
import type { MemberDocument } from "@/features/affiliates/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Files of one person. Links open through the titular's route, which checks the file belongs to the family. */
export function DocumentList({ documents, affiliateId, emptyText }: { documents: MemberDocument[]; affiliateId: string; emptyText: string }) {
  if (!documents.length) return <p className="inline-empty">{emptyText}</p>;

  return (
    <ul className="document-list">
      {documents.map((document) => (
        <li key={document.id}>
          <span className={document.mimeType?.startsWith("image/") ? "is-image" : undefined}><Icon name="file" size={17} /></span>
          <div>
            <strong>{document.title}</strong>
            <small>{documentKindLabels[document.kind]} · {formatDate(document.uploadedOn)} · {document.sizeLabel}{document.mimeType?.startsWith("image/") ? " · Imagen" : ""}</small>
          </div>
          {isSupabaseConfigured() ? (
            <Link className="row-action" href={`/afiliados/${affiliateId}/documentos/${document.id}`} target="_blank">Ver</Link>
          ) : <em>Local</em>}
        </li>
      ))}
    </ul>
  );
}
