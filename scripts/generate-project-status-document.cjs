/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Header,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} = require("docx");

const outputDirectory = path.join(__dirname, "..", "docs");
const docxPath = path.join(outputDirectory, "Requerimientos-y-estado-Sopdisponal-Admin.docx");
const markdownPath = path.join(outputDirectory, "Requerimientos-y-estado-Sopdisponal-Admin.md");

const colors = {
  navy: "0C2940",
  blue: "0074BA",
  teal: "47BFA9",
  ink: "0E2538",
  muted: "5D7182",
  border: "DCE6ED",
  paleBlue: "E5F3FB",
  paleTeal: "E8F6EF",
  paleAmber: "FFF4DC",
  paleRed: "FDECEF",
  white: "FFFFFF",
};

const pageWidth = 11906;
const contentWidth = 10466;

function text(value, options = {}) {
  return new TextRun({
    text: value,
    font: options.font || "Aptos",
    size: options.size || 20,
    bold: options.bold,
    italics: options.italics,
    color: options.color || colors.ink,
    break: options.break,
  });
}

function paragraph(value, options = {}) {
  const children = Array.isArray(value) ? value : [text(value, options)];
  return new Paragraph({
    children,
    alignment: options.alignment,
    spacing: {
      before: options.before ?? 0,
      after: options.after ?? 140,
      line: options.line ?? 276,
    },
    indent: options.indent,
    bullet: options.bullet ? { level: 0 } : undefined,
    border: options.border ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: options.border } } : undefined,
  });
}

function heading(value, level = HeadingLevel.HEADING_1) {
  const config = {
    [HeadingLevel.HEADING_1]: { size: 30, before: 380, after: 170, color: colors.navy },
    [HeadingLevel.HEADING_2]: { size: 24, before: 260, after: 120, color: colors.blue },
    [HeadingLevel.HEADING_3]: { size: 20, before: 180, after: 80, color: colors.ink },
  }[level];
  return new Paragraph({
    text: value,
    heading: level,
    spacing: { before: config.before, after: config.after },
    border: level === HeadingLevel.HEADING_1
      ? { bottom: { style: BorderStyle.SINGLE, size: 12, color: colors.teal, space: 8 } }
      : undefined,
    run: { font: "Aptos Display", size: config.size, bold: true, color: config.color },
  });
}

function callout(title, body, shade = colors.paleBlue) {
  return new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: [contentWidth],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 8, color: colors.border },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: colors.border },
      left: { style: BorderStyle.SINGLE, size: 8, color: colors.border },
      right: { style: BorderStyle.SINGLE, size: 8, color: colors.border },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: colors.white },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: colors.white },
    },
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: contentWidth, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, color: shade },
        margins: { top: 150, bottom: 150, left: 180, right: 180 },
        children: [
          paragraph(title, { bold: true, color: colors.navy, size: 19, after: 50 }),
          paragraph(body, { color: colors.ink, size: 18, after: 0, line: 250 }),
        ],
      })],
    })],
  });
}

function table(headers, rows, widths) {
  return new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: widths,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: colors.border },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: colors.border },
      left: { style: BorderStyle.SINGLE, size: 6, color: colors.border },
      right: { style: BorderStyle.SINGLE, size: 6, color: colors.border },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: colors.border },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: colors.border },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((header, index) => new TableCell({
          width: { size: widths[index], type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, color: colors.navy },
          margins: { top: 100, bottom: 100, left: 110, right: 110 },
          children: [paragraph(header, { bold: true, color: colors.white, size: 16, after: 0, line: 210 })],
        })),
      }),
      ...rows.map((row, rowIndex) => new TableRow({
        children: row.map((cell, index) => new TableCell({
          width: { size: widths[index], type: WidthType.DXA },
          shading: rowIndex % 2 === 0 ? { type: ShadingType.CLEAR, color: "F8FAFC" } : undefined,
          margins: { top: 90, bottom: 90, left: 110, right: 110 },
          children: [paragraph(cell, { size: 16, after: 0, line: 215 })],
        })),
      })),
    ],
  });
}

const contents = [
  new Paragraph({
    spacing: { before: 1200, after: 180 },
    children: [text("SOPDISPONAL", { size: 24, bold: true, color: colors.teal })],
  }),
  new Paragraph({
    spacing: { after: 220 },
    children: [text("Plataforma administrativa", { size: 48, bold: true, color: colors.navy, font: "Aptos Display" })],
  }),
  paragraph("Documento de requerimientos, arquitectura, estado de construcción y plan de trabajo", { size: 26, color: colors.muted, line: 330, after: 580 }),
  callout("Propósito del documento", "Alinear el alcance funcional de la nueva plataforma interna, registrar lo que ya está construido y separar los entregables pendientes antes de conectar Supabase, GitHub y Vercel.", colors.paleTeal),
  new Paragraph({ spacing: { before: 600, after: 60 }, children: [text("Versión 0.2 · 11 de septiembre de 2026", { size: 18, color: colors.muted })] }),
  new Paragraph({ children: [new PageBreak()] }),
  heading("Contenido", HeadingLevel.HEADING_1),
  new TableOfContents("", { hyperlink: true, headingStyleRange: "1-3" }),
  new Paragraph({ children: [new PageBreak()] }),
  heading("1. Resumen ejecutivo", HeadingLevel.HEADING_1),
  paragraph("Sopdisponal requiere reemplazar la plataforma anterior por una aplicación administrativa interna, moderna y segura. El sitio web público no forma parte de este alcance. La nueva aplicación se construye localmente con Next.js, React, TypeScript y Supabase; después se conectará a Supabase Cloud, se versionará en GitHub y se desplegará en Vercel."),
  callout("Estado actual", "La experiencia administrativa, el directorio de afiliados, la ficha integral, los formularios de afiliados y el alta de beneficiarios ya son navegables y están validados. La persistencia real permanece deshabilitada porque todavía no está disponible Docker/Supabase local ni se ha configurado Supabase Cloud.", colors.paleAmber),
  heading("2. Objetivo y límites del alcance", HeadingLevel.HEADING_1),
  heading("2.1 Objetivo", HeadingLevel.HEADING_2),
  paragraph("Centralizar la operación de Sopdisponal en una única plataforma administrativa para gestionar titulares, beneficiarios, pagos, expedientes PDF, comunicaciones, informes, permisos y trazabilidad."),
  heading("2.2 Límites acordados", HeadingLevel.HEADING_2),
  paragraph("La operación es interna y requiere autenticación. No se construirá un portal público dentro de esta fase. La consulta heredada usuarios.php se reemplaza por módulos internos; no se migrará como una página pública independiente."),
  paragraph("El asistente interno conectado a LLM/IA se deja para la fase final. La descarga de bases o exportaciones se habilitará únicamente para usuarios que tengan el permiso correspondiente."),
  heading("3. Requerimientos funcionales", HeadingLevel.HEADING_1),
  table(
    ["Dominio", "Requerimiento", "Criterio operativo"],
    [
      ["Inicio", "Dashboard administrativo", "Página inicial con indicadores de titulares y beneficiarios activos, inactivos y fallecidos."],
      ["Afiliados", "Periodo inicial de seis meses", "Las afiliaciones nuevas se distinguen con color y muestran la fecha en que obtienen 100 % de cobertura."],
      ["Afiliados", "Ficha personal", "Datos personales, fecha de expedición de cédula, contacto, clasificación y observaciones internas."],
      ["Afiliados", "Clasificación", "Identificar claramente particular, Activo, CASUR o TEGEN."],
      ["Beneficiarios", "Vinculación al titular", "Registrar parentesco, datos, estado y cobertura individual sin eliminar el historial."],
      ["Historial", "Fallecidos reservados", "Los fallecidos se conservan en historial administrativo y no aparecen en la vista operativa de titulares."],
      ["Pagos", "Histórico y observaciones", "Consultar pagos individuales y lotes de Activos, CASUR y TEGEN; cada pago admite observación."],
      ["Mora", "Estados automáticos", "A los 3 meses sin pago: inactivo. A los 6 meses: suspendido. Los fallecidos no cambian por esta regla."],
      ["Documentos", "Expediente PDF", "Cada afiliado debe tener hoja de vida y soportes PDF privados, con acceso por permiso."],
      ["Oficina", "Avisos operativos", "Administrar imagen o documento que comunique vacaciones, Semana Santa u otros cierres."],
      ["Notificaciones", "Alertas e informes", "Notificar actualizaciones relevantes de datos y generar/avisar informes mensuales."],
      ["Exportaciones", "Descargas controladas", "La exportación de datos se habilita por permiso individual y queda auditada."],
      ["IA", "Asistente interno", "Fase final: consultas del negocio, carga de archivos y propuestas controladas, siempre con permisos y confirmación humana."],
    ],
    [1650, 2700, 6116],
  ),
  heading("4. Arquitectura propuesta", HeadingLevel.HEADING_1),
  table(
    ["Capa", "Tecnología", "Responsabilidad"],
    [
      ["Interfaz", "Next.js 16 + React 19 + TypeScript", "Aplicación administrativa, rutas, formularios, renderizado de servidor y acciones internas."],
      ["Servidor", "Server Components y Server Actions", "Lecturas cercanas a los datos y mutaciones autenticadas; no expone secretos al navegador."],
      ["Base de datos", "Supabase PostgreSQL", "Datos normalizados, reglas de cobertura, estados, auditoría y permisos."],
      ["Seguridad", "Supabase Auth + RLS", "Sesión verificada, permisos funcionales, políticas por operación y mínimo privilegio."],
      ["Archivos", "Supabase Storage privado", "Expedientes PDF y avisos de oficina mediante buckets restringidos."],
      ["Entrega", "GitHub + Vercel", "Versionado, revisión, despliegue y variables de entorno diferenciadas."],
    ],
    [1850, 2700, 5916],
  ),
  heading("5. Modelo de datos y reglas de negocio", HeadingLevel.HEADING_1),
  paragraph("La migración inicial ya define perfiles, roles, permisos, municipios, entidades, afiliados, beneficiarios, lotes de pago, pagos, documentos, avisos, notificaciones, informes mensuales, solicitudes de exportación y auditoría."),
  table(
    ["Entidad", "Datos clave", "Reglas relevantes"],
    [
      ["Afiliado", "Documento único, fechas, origen, estado, cobertura", "Cobertura total se calcula seis meses después de la afiliación."],
      ["Beneficiario", "Titular, parentesco, documento, estado, cobertura", "Documento único por titular; historial sin eliminación funcional."],
      ["Pago / lote", "Periodo, fuente, valor, estado, observación", "Preparado para importaciones de Activos, CASUR, TEGEN y particulares."],
      ["Documento", "Tipo, ruta privada, versión, cargado por", "Solo PDF en el bucket de expedientes; acceso por permisos."],
      ["Usuario y rol", "Perfil, rol, permisos", "Permisos granulares como affiliates.manage, documents.manage y data.export."],
      ["Auditoría", "Actor, entidad, operación, valores antes/después", "Registra cambios de afiliados, beneficiarios, pagos, lotes y avisos."],
    ],
    [1850, 3260, 5356],
  ),
  heading("6. Seguridad y privacidad", HeadingLevel.HEADING_1),
  paragraph("La plataforma trata información personal y documental sensible. Por ello, no se utilizarán claves privilegiadas en código de navegador ni se publicarán buckets, rutas de archivos o consultas de negocio."),
  [
    "Autenticación mediante Supabase Auth. Las acciones de servidor validan la identidad con getClaims antes de intentar mutaciones.",
    "Row Level Security habilitada en las tablas expuestas. Cada operación tiene políticas separadas de lectura, inserción y actualización.",
    "Esquema private para funciones privilegiadas, con ruta de búsqueda fijada y permisos de ejecución mínimos.",
    "No se conceden permisos de borrado para los registros operativos principales; los fallecimientos se manejan como estado e historial.",
    "Buckets affiliate-files y office-notices privados. El primero permite únicamente PDF y requiere permisos de documentos.",
    "Exportaciones registradas en data_exports y sujetas al permiso data.export.",
  ].map((item) => paragraph(item, { bullet: true, size: 18, after: 70 })),
  heading("7. Construido a la fecha", HeadingLevel.HEADING_1),
  table(
    ["Entregable", "Estado", "Detalle"],
    [
      ["Base del proyecto", "Construido", "Next.js 16, React 19, TypeScript, Tailwind, estructura administrativa y configuración local."],
      ["Sistema visual", "Construido", "Diseño administrativo inspirado en los insumos de la carpeta Diseño; responsivo y con navegación lateral."],
      ["Dashboard", "Construido con datos demo", "Resumen operativo y acceso a módulos; los conteos actuales vienen del repositorio local."],
      ["Consulta integral", "Construido con datos demo", "Búsqueda por nombre, documento, organización y beneficiario."],
      ["Directorio de afiliados", "Construido con datos demo", "Filtros por estado/tipo, indicador de carencia, histórico reservado y ficha detallada."],
      ["Ficha de afiliado", "Construido con datos demo", "Datos personales, fecha de expedición, beneficiarios vigentes, histórico de fallecidos, pagos, documentos y notas."],
      ["Alta y edición de afiliados", "Construido; persistencia preparada", "Formularios con validación, normalización de documento, detección de duplicados y acciones de servidor."],
      ["Alta de beneficiarios", "Construido; persistencia preparada", "Ruta desde la ficha del titular con parentesco, documento opcional, cobertura individual y estados."],
      ["Esquema Supabase", "Construido; sin ejecutar localmente", "Migración inicial con tablas, índices, RLS, permisos, auditoría, storage y regla de mora."],
      ["Verificación", "Completada", "ESLint, TypeScript, build de producción y pruebas visuales de escritorio/móvil de los formularios."],
    ],
    [2550, 1950, 5966],
  ),
  heading("8. Limitaciones actuales", HeadingLevel.HEADING_1),
  callout("No confundir interfaz lista con operación persistente", "En este momento la aplicación usa datos locales de demostración. Los formularios validan la información, pero informan expresamente que no guardan nada mientras Supabase no esté configurado. Esto evita crear una expectativa falsa de que los registros ya están en una base de datos.", colors.paleRed),
  [
    "Docker Desktop no está disponible en el equipo; por tanto, Supabase local, PostgreSQL, Auth y Storage no se han iniciado ni se ha aplicado la migración.",
    "No hay proyecto Supabase Cloud conectado, ni variables .env.local reales.",
    "No existe aún autenticación visible ni administración real de usuarios; la migración sí contempla la base de permisos.",
    "El repositorio de datos actual sirve datos demo. Falta sustituirlo por lecturas reales de Supabase y generar tipos desde la base.",
    "Los módulos Pagos, Importaciones, Documentos, Reportes, Usuarios, Auditoría y Asistente IA aún están en fase de alcance/interfaz base.",
    "No se ha creado remoto de GitHub ni se ha desplegado en Vercel, por decisión de completar primero la fase local.",
  ].map((item) => paragraph(item, { bullet: true, size: 18, after: 70 })),
  heading("9. Pendientes priorizados", HeadingLevel.HEADING_1),
  table(
    ["Prioridad", "Pendiente", "Resultado esperado"],
    [
      ["P0", "Habilitar Docker y Supabase local", "Aplicar migración, crear usuario administrador, completar .env.local y probar RLS/Storage."],
      ["P0", "Conectar repositorio a Supabase", "Reemplazar datos demo por lecturas reales, estados de carga/error y tipos generados."],
      ["P0", "Autenticación y autorización de interfaz", "Inicio de sesión, protección de rutas, perfil actual y controles según permisos."],
      ["P1", "Expediente PDF", "Carga, validación de tipo/tamaño, historial, descarga temporal y permisos de documentos."],
      ["P1", "Pagos e importaciones", "Registro manual, lotes de Activos/CASUR/TEGEN, conciliación, observaciones y reversión controlada."],
      ["P1", "Dashboard real y automatización de mora", "Indicadores desde PostgreSQL y tarea programada diaria para regla de 3/6 meses."],
      ["P1", "Avisos y notificaciones", "Anuncio de oficina editable, alertas de actualizaciones e informes mensuales."],
      ["P1", "Usuarios, permisos y exportaciones", "Matriz de permisos, habilitación de descargas y auditoría de exportación."],
      ["P2", "Reportes y auditoría de interfaz", "Informes PDF/XLSX/CSV autorizados, consulta de trazabilidad y filtros."],
      ["P2", "GitHub, Supabase Cloud y Vercel", "Repositorio remoto, CI, variables seguras, preview y producción."],
      ["P3", "Asistente IA interno", "Chat con fuentes, archivos autorizados, límites por permiso y confirmación humana para cambios."],
    ],
    [1050, 3000, 6416],
  ),
  heading("10. Plan de ejecución propuesto", HeadingLevel.HEADING_1),
  table(
    ["Fase", "Objetivo", "Cierre verificable"],
    [
      ["1. Base local", "Terminar flujos núcleo con datos demo", "Interfaz, formularios y navegación probados. Estado actual: en curso avanzado."],
      ["2. Supabase local", "Ejecutar la base, Auth, RLS y Storage", "Migraciones aplicadas, pruebas de política y archivos privados funcionando."],
      ["3. Operación núcleo", "Conectar afiliados, beneficiarios, documentos, pagos e importaciones", "Registros persistentes, auditoría y reglas de mora comprobadas."],
      ["4. Control y comunicación", "Usuarios, exportaciones, avisos, notificaciones y reportes", "Accesos por rol y generación programada de información."],
      ["5. Publicación", "GitHub, Supabase Cloud y Vercel", "Entorno de preview y producción con variables, respaldo y monitoreo."],
      ["6. IA interna", "Asistente de negocio", "Respuestas trazables sobre datos autorizados y flujo de aprobación humana."],
    ],
    [1500, 3400, 5566],
  ),
  heading("11. Criterios de aceptación para la siguiente fase", HeadingLevel.HEADING_1),
  [
    "Un usuario administrador puede iniciar sesión y ver solo los módulos autorizados.",
    "Crear o editar afiliados y beneficiarios persiste los cambios, detecta documentos duplicados y deja auditoría.",
    "Los nuevos afiliados y beneficiarios muestran el periodo de seis meses calculado desde la fecha de vinculación.",
    "Los fallecidos quedan fuera de la vista operativa y permanecen disponibles únicamente en el historial autorizado.",
    "Un PDF cargado permanece privado, se consulta con permiso y no expone una URL pública permanente.",
    "La regla de tres/seis meses actualiza estados sin afectar registros fallecidos y puede ser auditada.",
    "Una exportación solo puede solicitarla un usuario con data.export y se registra el solicitante, fecha y resultado.",
  ].map((item) => paragraph(item, { bullet: true, size: 18, after: 80 })),
  heading("12. Puesta en marcha local", HeadingLevel.HEADING_1),
  paragraph("La aplicación se ejecuta actualmente en http://localhost:3000. Los comandos disponibles son:"),
  table(
    ["Comando", "Uso"],
    [
      ["npm run dev", "Inicia la aplicación Next.js en desarrollo."],
      ["npm run lint", "Revisa reglas de calidad del código."],
      ["npm run typecheck", "Valida los tipos TypeScript."],
      ["npm run build", "Genera la compilación de producción."],
      ["npm run supabase:start", "Inicia Supabase local una vez Docker esté instalado."],
      ["npm run supabase:reset", "Reinicia la base local y aplica las migraciones; solo usar cuando el entorno local esté habilitado."],
    ],
    [3300, 7166],
  ),
  heading("13. Decisiones y riesgos a controlar", HeadingLevel.HEADING_1),
  table(
    ["Tema", "Decisión / riesgo", "Tratamiento"],
    [
      ["Datos heredados", "El respaldo antiguo contiene información sensible.", "No copiarlo al repositorio. Planear migración controlada, mapeo y validación por etapas."],
      ["Datos demo", "No representan información operativa real.", "Mantenerlos identificados como demo hasta reemplazar el repositorio por Supabase."],
      ["Data API", "Supabase exige grants explícitos para tablas públicas en proyectos recientes.", "La migración inicial ya revoca y concede permisos explícitamente; validar al crear el proyecto."],
      ["Exportaciones", "Una descarga puede incluir información sensible.", "Permiso separado, auditoría, filtros mínimos y retención definida."],
      ["IA", "Riesgo de acceso excesivo o respuestas sin contexto.", "Dejarla al final; usar fuentes autorizadas, alcance por rol, citas y aprobación humana."],
      ["Despliegue", "Variables o secretos mal configurados.", "Separar .env.local, Preview y Production; nunca versionar claves ni usar service_role en cliente."],
    ],
    [1800, 3900, 4766],
  ),
  heading("14. Conclusión", HeadingLevel.HEADING_1),
  paragraph("La plataforma tiene una base visual y técnica sólida para la fase local. Los flujos de afiliados y beneficiarios ya materializan reglas esenciales del negocio, pero la siguiente condición para convertirlos en operación real es habilitar Supabase local y conectar la persistencia, autenticación y almacenamiento privado. A partir de ahí, los siguientes módulos deben implementarse en el orden de prioridades definido en este documento."),
];

const document = new Document({
  creator: "Sopdisponal",
  title: "Requerimientos y estado - Sopdisponal Admin",
  description: "Documento de requerimientos, estado y plan de trabajo de Sopdisponal Admin.",
  numbering: {
    config: [{ reference: "bullets", levels: [{ level: 0, format: "bullet", text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420, hanging: 200 } } } }] }],
  },
  styles: {
    default: { document: { run: { font: "Aptos", size: 20, color: colors.ink } } },
  },
  sections: [{
    properties: { page: { size: { width: pageWidth, height: 16838 }, margin: { top: 1080, right: 720, bottom: 900, left: 720 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [text("Sopdisponal · Plataforma administrativa", { size: 16, color: colors.muted })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [text("Documento interno · ", { size: 16, color: colors.muted }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: colors.muted })] })] }) },
    children: contents,
  }],
});

const markdown = `# Sopdisponal Admin — Requerimientos y estado\n\n> Versión 0.2 · 11 de septiembre de 2026\n\nLa versión Word es el documento de referencia completo.\n\n## Resumen\n\nSopdisponal Admin es una plataforma administrativa interna para gestionar afiliados, beneficiarios, pagos, documentos, reportes y permisos. El sitio público no forma parte del alcance actual.\n\n## Construido\n\n- Base Next.js 16, React 19, TypeScript y sistema visual administrativo.\n- Dashboard, consulta integral, directorio y ficha de afiliados con datos demo.\n- Formularios de alta y edición de afiliados con validación y acciones de servidor preparadas.\n- Formulario de alta de beneficiarios desde la ficha del titular.\n- Migración Supabase inicial: esquema, RLS, permisos, auditoría, buckets privados y regla de mora.\n- Verificación con lint, TypeScript, build y pruebas de navegador.\n\n## Pendientes prioritarios\n\n1. Instalar Docker y arrancar Supabase local.\n2. Conectar el repositorio de datos a Supabase y activar Auth/RLS en interfaz.\n3. Implementar expediente PDF privado.\n4. Implementar pagos, importaciones y automatización de mora.\n5. Añadir avisos, notificaciones, permisos de exportación, reportes y auditoría de interfaz.\n6. Subir a GitHub, conectar Supabase Cloud y desplegar en Vercel.\n7. Construir el asistente IA como fase final.\n\nConsulta el archivo .docx para la matriz detallada de requerimientos, arquitectura, seguridad, riesgos y criterios de aceptación.\n`;

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(markdownPath, markdown, "utf8");
Packer.toBuffer(document).then((buffer) => {
  fs.writeFileSync(docxPath, buffer);
  console.log(docxPath);
  console.log(markdownPath);
});
