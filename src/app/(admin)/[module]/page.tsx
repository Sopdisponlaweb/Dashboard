import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

type ModuleDefinition = { title: string; eyebrow: string; description: string; icon: IconName; capabilities: { title: string; description: string }[] };

const modules: Record<string, ModuleDefinition> = {
  consulta: { title: "Consulta integral del afiliado", eyebrow: "Operación", description: "Reúne datos personales, cobertura, beneficiarios, pagos, documentos e historial en una sola ficha protegida.", icon: "search", capabilities: [{ title: "Búsqueda unificada", description: "Por cédula, nombre, afiliación, empresa o estado." }, { title: "Ficha completa", description: "Información organizada por secciones y con trazabilidad." }, { title: "Acceso por permiso", description: "Cada usuario verá únicamente los datos autorizados." }] },
  afiliados: { title: "Gestión de afiliados", eyebrow: "Personas", description: "Administra el ciclo de vida del titular, su cobertura, clasificación, datos personales y novedades.", icon: "users", capabilities: [{ title: "Datos personales", description: "Incluye fecha de expedición de cédula y validaciones." }, { title: "Cobertura", description: "Periodo inicial de seis meses calculado automáticamente." }, { title: "Estados", description: "Activo, inactivo, suspendido o fallecido." }] },
  catalogos: { title: "Catálogos", eyebrow: "Configuración", description: "Centraliza empresas, cajas, municipios, parentescos, terceros y tipos de afiliación.", icon: "layers", capabilities: [{ title: "Datos consistentes", description: "Evita nombres duplicados y variantes de escritura." }, { title: "Vigencia", description: "Los registros usados se inactivan, no se eliminan." }, { title: "Dependencias", description: "Relaciones protegidas por la base de datos." }] },
  usuarios: { title: "Usuarios y accesos", eyebrow: "Seguridad", description: "Configura roles, permisos funcionales y autorizaciones específicas de descarga.", icon: "lock", capabilities: [{ title: "Roles", description: "Administrador, afiliaciones, contabilidad y consulta." }, { title: "Permisos", description: "Lectura, edición, aprobación, exportación y respaldo." }, { title: "Sesiones", description: "Accesos, bloqueo, segundo factor y revocación." }] },
  auditoria: { title: "Auditoría", eyebrow: "Control", description: "Explica quién consultó o modificó información y qué cambió en cada operación.", icon: "history", capabilities: [{ title: "Cambios", description: "Valores anteriores y posteriores en operaciones sensibles." }, { title: "Descargas", description: "Registro de exportaciones, documentos y respaldos." }, { title: "Automatizaciones", description: "Trazabilidad de cambios generados por reglas." }] },
  asistente: { title: "Asistente interno", eyebrow: "Próxima fase", description: "Espacio reservado para consultar información y documentos mediante IA con permisos y aprobación humana.", icon: "message", capabilities: [{ title: "Consultas", description: "Respuestas con fuentes y alcance del usuario actual." }, { title: "Archivos", description: "Análisis de PDF, XLSX y CSV autorizados." }, { title: "Cambios controlados", description: "La IA propone; el usuario confirma y la API valida." }] },
};

type PageProps = {
  params: Promise<{ module: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { module: moduleSlug } = await params;
  return { title: modules[moduleSlug]?.title ?? "Módulo" };
}

export default async function ModulePage({ params, searchParams }: PageProps) {
  const [{ module: moduleSlug }, queryParams] = await Promise.all([params, searchParams]);
  const definition = modules[moduleSlug];
  if (!definition) notFound();
  const rawQuery = queryParams.q;
  const query = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;

  return (
    <>
      <section className="module-hero">
        <div><p className="eyebrow" style={{ color: "#75d5c3" }}>{definition.eyebrow}</p><h1>{definition.title}</h1><p>{definition.description}</p></div>
        <span className="module-icon"><Icon name={definition.icon} size={38} strokeWidth={1.5} /></span>
      </section>
      {moduleSlug === "consulta" && query ? (
        <p className="module-query">Búsqueda preparada para: <strong>{query}</strong></p>
      ) : null}
      <section className="module-grid" aria-label={`Capacidades de ${definition.title}`}>
        {definition.capabilities.map((capability, index) => (
          <article className="module-card" key={capability.title}>
            <span className="module-card-index">0{index + 1}</span><h2>{capability.title}</h2><p>{capability.description}</p><span className="module-status">Preparado para implementación</span>
          </article>
        ))}
      </section>
    </>
  );
}
