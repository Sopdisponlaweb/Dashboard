import type { Metadata } from "next";

import { DataSourceBadge } from "@/components/data-source-badge";
import { Icon } from "@/components/icons";
import { formatDate } from "@/features/affiliates/format";
import { createAnnouncement, toggleAnnouncementPublished } from "@/features/announcements/actions";
import { AnnouncementForm } from "@/features/announcements/announcement-form";
import { listAnnouncements } from "@/features/announcements/repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Avisos" };

type SearchParams = Promise<{ result?: string | string[] }>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function windowStatus(announcement: { startsAt: string; endsAt: string }) {
  const now = Date.now();
  const starts = new Date(announcement.startsAt).getTime();
  const ends = new Date(announcement.endsAt).getTime();
  if (now < starts) return { label: "Programado", tone: "payment-pending" };
  if (now > ends) return { label: "Vencido", tone: "payment-reversed" };
  return { label: "Vigente", tone: "payment-paid" };
}

export default async function AnnouncementsPage({ searchParams }: { searchParams: SearchParams }) {
  const { result } = await searchParams;
  const created = firstValue(result) === "created";
  const persistenceEnabled = isSupabaseConfigured();
  const announcements = persistenceEnabled ? await listAnnouncements() : [];

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Oficina</p>
          <h1>Avisos</h1>
          <p>Redacta comunicados internos: vacaciones, cierres, jornadas especiales u otras novedades operativas.</p>
        </div>
        <DataSourceBadge connected={persistenceEnabled} connectedLabel="Conectado a Supabase local" disconnectedLabel="Publicación pendiente de Supabase" />
      </header>

      {created ? (
        <div className="success-banner" role="status">
          <Icon name="lock" size={18} />
          <span>El aviso fue publicado correctamente.</span>
        </div>
      ) : null}

      <section className="detail-panel" aria-labelledby="announcement-form-title">
        <div className="panel-header">
          <div>
            <h2 id="announcement-form-title">Nuevo aviso</h2>
            <p>Los avisos publicados y vigentes aparecerán en el resumen de la operación.</p>
          </div>
        </div>
        <AnnouncementForm action={createAnnouncement} persistenceEnabled={persistenceEnabled} />
      </section>

      {persistenceEnabled ? (
        <section className="detail-panel" aria-labelledby="announcement-list-title">
          <div className="panel-header">
            <div>
              <h2 id="announcement-list-title">Avisos existentes</h2>
              <p>Los vigentes y publicados aparecen en el resumen de la operación.</p>
            </div>
            <span className="panel-tag">{announcements.length} {announcements.length === 1 ? "registro" : "registros"}</span>
          </div>

          {announcements.length ? (
            <div className="data-table-wrap">
              <table className="data-table compact-table">
                <thead><tr><th>Título</th><th>Vigencia</th><th>Estado</th><th>Publicación</th><th><span className="sr-only">Acciones</span></th></tr></thead>
                <tbody>
                  {announcements.map((announcement) => {
                    const status = windowStatus(announcement);
                    return (
                      <tr key={announcement.id}>
                        <td><strong>{announcement.title}</strong></td>
                        <td>{formatDate(announcement.startsAt.slice(0, 10))} – {formatDate(announcement.endsAt.slice(0, 10))}</td>
                        <td><span className={`payment-badge ${status.tone}`}>{status.label}</span></td>
                        <td><span className={`payment-badge ${announcement.isPublished ? "payment-paid" : "payment-pending"}`}>{announcement.isPublished ? "Publicado" : "Borrador"}</span></td>
                        <td>
                          <form action={toggleAnnouncementPublished.bind(null, announcement.id, !announcement.isPublished)}>
                            <button className="row-action" type="submit">{announcement.isPublished ? "Despublicar" : "Publicar"}</button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="inline-empty">Aún no hay avisos registrados.</p>}
        </section>
      ) : null}
    </>
  );
}
