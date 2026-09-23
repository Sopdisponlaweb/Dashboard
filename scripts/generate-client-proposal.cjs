/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, PageBreak, PageNumber, Packer, Paragraph, ShadingType, Table, TableCell, TableOfContents, TableRow, TextRun, WidthType } = require("docx");

const out = path.join(__dirname, "..", "docs");
const docxFile = path.join(out, "Propuesta-modernizacion-Sopdisponal.docx");
const mdFile = path.join(out, "Propuesta-modernizacion-Sopdisponal.md");
const C = { navy: "0C2940", blue: "0074BA", teal: "47BFA9", ink: "10283B", muted: "5D7182", border: "DCE6ED", paleBlue: "E5F3FB", paleTeal: "E8F6EF", paleAmber: "FFF4DC", paleRed: "FDECEF", white: "FFFFFF" };
const width = 10466;

function r(text, o = {}) { return new TextRun({ text, font: o.font || "Aptos", size: o.size || 20, bold: o.bold, color: o.color || C.ink }); }
function p(value, o = {}) { return new Paragraph({ children: Array.isArray(value) ? value : [r(value, o)], spacing: { before: o.before || 0, after: o.after === undefined ? 140 : o.after, line: o.line || 276 }, alignment: o.alignment, bullet: o.bullet ? { level: 0 } : undefined }); }
function h(text, level = HeadingLevel.HEADING_1) {
  const m = level === HeadingLevel.HEADING_1 ? { size: 30, color: C.navy, before: 380 } : { size: 24, color: C.blue, before: 250 };
  return new Paragraph({ text, heading: level, spacing: { before: m.before, after: 150 }, border: level === HeadingLevel.HEADING_1 ? { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.teal, space: 8 } } : undefined, run: { font: "Aptos Display", size: m.size, bold: true, color: m.color } });
}
function callout(title, body, shade = C.paleBlue) {
  return new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: [width], borders: { top: { style: BorderStyle.SINGLE, size: 8, color: C.border }, bottom: { style: BorderStyle.SINGLE, size: 8, color: C.border }, left: { style: BorderStyle.SINGLE, size: 8, color: C.border }, right: { style: BorderStyle.SINGLE, size: 8, color: C.border } }, rows: [new TableRow({ children: [new TableCell({ width: { size: width, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: shade }, margins: { top: 150, bottom: 150, left: 180, right: 180 }, children: [p(title, { bold: true, color: C.navy, size: 19, after: 45 }), p(body, { size: 18, after: 0, line: 245 })] })] })] });
}
function tbl(headers, rows, widths) {
  const borders = { top: { style: BorderStyle.SINGLE, size: 6, color: C.border }, bottom: { style: BorderStyle.SINGLE, size: 6, color: C.border }, left: { style: BorderStyle.SINGLE, size: 6, color: C.border }, right: { style: BorderStyle.SINGLE, size: 6, color: C.border }, insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: C.border }, insideVertical: { style: BorderStyle.SINGLE, size: 4, color: C.border } };
  const cell = (value, i, header, stripe) => new TableCell({ width: { size: widths[i], type: WidthType.DXA }, shading: header ? { type: ShadingType.CLEAR, color: C.navy } : stripe ? { type: ShadingType.CLEAR, color: "F8FAFC" } : undefined, margins: { top: 90, bottom: 90, left: 110, right: 110 }, children: [p(value, { size: 16, bold: header, color: header ? C.white : C.ink, after: 0, line: 215 })] });
  return new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: widths, borders, rows: [new TableRow({ tableHeader: true, children: headers.map((v, i) => cell(v, i, true)) }), ...rows.map((row, n) => new TableRow({ children: row.map((v, i) => cell(v, i, false, n % 2 === 0)) }))] });
}
const bullets = (items) => items.map((x) => p(x, { bullet: true, size: 18, after: 70 }));

const body = [
  new Paragraph({ spacing: { before: 1250, after: 180 }, children: [r("SOPDISPONAL", { size: 24, bold: true, color: C.teal })] }),
  new Paragraph({ spacing: { after: 220 }, children: [r("Propuesta de modernización", { size: 48, bold: true, color: C.navy, font: "Aptos Display" })] }),
  p("Nueva plataforma administrativa interna", { size: 29, color: C.blue, after: 120 }),
  p("Una solución segura, ordenada y preparada para acompañar la operación diaria de Sopdisponal.", { size: 23, color: C.muted, line: 315, after: 560 }),
  callout("Propósito", "Reemplazar la operación administrativa heredada por una plataforma moderna. El foco es mejorar el control, la seguridad y la atención de afiliados y beneficiarios.", C.paleTeal),
  new Paragraph({ spacing: { before: 620 }, children: [r("Propuesta funcional · 11 de septiembre de 2026", { size: 18, color: C.muted })] }),
  new Paragraph({ children: [new PageBreak()] }),
  h("Contenido"), new TableOfContents("", { hyperlink: true, headingStyleRange: "1-2" }), new Paragraph({ children: [new PageBreak()] }),
  h("1. Resumen de la propuesta"),
  p("Sopdisponal necesita una única plataforma administrativa, diseñada para el uso interno del equipo. La propuesta reemplaza procesos dispersos y el módulo heredado de consulta por un sistema donde cada afiliado, beneficiario, pago, documento y novedad tenga una historia clara y controlada."),
  p("No se propone reconstruir el sitio web público en esta etapa. La prioridad es el sistema interno: allí se gestiona la información sensible, se atienden las novedades y se toman decisiones operativas."),
  callout("Resultado esperado", "Un equipo autorizado podrá consultar y administrar la información desde un panel central: saber quién está activo, inactivo o suspendido; revisar pagos y documentos; proteger datos personales; y contar con trazabilidad de lo que se modifica."),
  h("2. ¿Por qué implementar esta mejora ahora?"),
  tbl(["Hoy", "Con la nueva plataforma", "Beneficio"], [
    ["Información y procesos heredados con alcance limitado.", "Sistema interno creado alrededor de la operación real.", "Menos dependencia de fuentes dispersas."],
    ["Un afiliado puede requerir varias consultas.", "Ficha única para titular, beneficiarios, pagos, documentos y observaciones.", "Atención más rápida y menor riesgo de omitir información."],
    ["Los estados por falta de pago se revisan manualmente.", "Reglas automáticas a 3 y 6 meses.", "Criterios consistentes y seguimiento oportuno."],
    ["Los documentos pueden quedar dispersos.", "Expediente PDF privado por afiliado.", "Información organizada y restringida."],
    ["La dirección no tiene una vista inmediata.", "Dashboard con indicadores operativos.", "Decisiones con información visible y actualizada."],
  ], [2900, 4200, 3366]),
  h("3. Objetivos"),
  ...bullets(["Centralizar la operación administrativa de Sopdisponal.", "Proteger datos personales, documentos y pagos mediante accesos definidos por usuario.", "Reducir tareas manuales y errores mediante validaciones, alertas y reglas automáticas.", "Conservar el historial sin mostrar información sensible a quien no la necesita.", "Entregar a la dirección indicadores claros y reportes controlados."]),
  h("4. Alcance funcional"),
  h("4.1 Dashboard y operación diaria", HeadingLevel.HEADING_2),
  tbl(["Funcionalidad", "Qué hará", "Valor"], [
    ["Dashboard", "Página inicial con titulares y beneficiarios activos, inactivos y fallecidos.", "Visión general inmediata de la operación."],
    ["Novedades", "Alertas por actualización de datos, pagos y tareas relevantes.", "El equipo puede priorizar su trabajo."],
    ["Aviso de oficina", "Imagen o documento para vacaciones, Semana Santa u otros cierres.", "Comunicación operativa sencilla."],
  ], [2500, 4500, 3466]),
  h("4.2 Afiliados y beneficiarios", HeadingLevel.HEADING_2),
  tbl(["Funcionalidad", "Alcance", "Resultado"], [
    ["Directorio y búsqueda", "Búsqueda por nombre, documento, organización o beneficiario.", "Acceso rápido al registro correcto."],
    ["Ficha integral", "Datos personales, fecha de expedición de cédula, contacto, pagos, documentos y notas.", "Una sola fuente para la atención."],
    ["Clasificación", "Particular, Activo, CASUR o TEGEN.", "Segmentación clara para seguimiento."],
    ["Periodo inicial", "Color diferencial hasta completar seis meses.", "La fecha de acceso al 100 % se ve claramente."],
    ["Beneficiarios", "Parentesco, datos, estado y cobertura individual.", "Relación ordenada con el titular."],
    ["Fallecidos", "Historial administrativo reservado, fuera de la vista operativa.", "Manejo sensible y respetuoso de la información."],
  ], [2500, 4500, 3466]),
  h("4.3 Pagos, documentos y control", HeadingLevel.HEADING_2),
  tbl(["Funcionalidad", "Alcance", "Control"], [
    ["Pagos y lotes", "Histórico individual; lotes de Activos, CASUR, TEGEN y particulares; observaciones.", "Trazabilidad financiera por afiliado."],
    ["Regla de mora", "A 3 meses sin pago: inactivo. A 6 meses: suspendido. No aplica a fallecidos.", "Estados automáticos, auditables y consistentes."],
    ["Expediente PDF", "Hoja de vida y soportes privados por afiliado.", "Solo usuarios autorizados cargan o consultan archivos."],
    ["Reportes y notificaciones", "Informes mensuales y alertas de actualizaciones relevantes.", "Seguimiento sin depender de revisiones manuales."],
    ["Usuarios y exportaciones", "Roles; permiso específico para descargar información; registro de actividad.", "El dato se comparte solo cuando está autorizado."],
  ], [2500, 4500, 3466]),
  h("5. Fase posterior: asistente interno con IA"),
  callout("IA con control humano", "El asistente interno se propone para una fase final. Permitirá consultar información autorizada y adjuntar archivos permitidos. No ejecutará cambios sensibles sin confirmación humana y solo trabajará con datos a los que el usuario tenga permiso.", C.paleAmber),
  h("6. Riesgos y debilidades del sistema anterior"),
  p("La revisión del material heredado se enfocó en riesgos de continuidad y seguridad, sin exponer información confidencial. Los hallazgos justifican tratar la modernización como prioritaria."),
  tbl(["Riesgo identificado", "Impacto posible", "Respuesta propuesta"], [
    ["Respaldo heredado con servidor, bases de datos y archivos de autenticación.", "Exposición de accesos o datos personales si se copia o comparte sin controles.", "Tratarlo como confidencial; no subirlo a GitHub; limitar acceso y renovar credenciales."],
    ["Tecnología y dependencias con mantenimiento incierto.", "Dificultad para actualizar, corregir vulnerabilidades o crecer.", "Nueva base tecnológica con actualizaciones y despliegue controlado."],
    ["Consulta administrativa asociada a un entorno web heredado.", "Separación insuficiente entre operación interna e información pública.", "Sistema administrativo independiente, con inicio de sesión y rutas protegidas."],
    ["Datos y documentos sin modelo único.", "Duplicidad, errores y falta de visión completa del afiliado.", "Modelo central de afiliado, beneficiario, pago, documento y auditoría."],
    ["Permisos y descargas sin matriz granular.", "Acceso o exportación fuera de la necesidad laboral.", "Roles, permisos específicos y registro de exportaciones."],
    ["Reglas de cartera manuales.", "Estados inconsistentes y seguimiento tardío.", "Regla automática de 3 y 6 meses, verificable."],
  ], [3100, 3700, 3666]),
  callout("Acción recomendada inmediata", "El respaldo antiguo debe considerarse material restringido. No debe enviarse por correo sin protección, publicarse en repositorios ni usarse como fuente directa. Antes de cualquier migración se deben renovar accesos y preparar una copia de trabajo controlada.", C.paleRed),
  h("7. Seguridad de la nueva plataforma"),
  tbl(["Control", "Cómo se aplica"], [
    ["Acceso identificado", "Cada persona ingresa con su cuenta; los accesos se pueden retirar o ajustar individualmente."],
    ["Permisos por tarea", "Se diferencian consulta, edición, documentos, pagos, exportaciones y administración."],
    ["Datos protegidos", "La base de datos aplica políticas para que cada consulta obtenga solo información autorizada."],
    ["Archivos privados", "Los PDFs no se publican en internet; cada acceso se valida."],
    ["Auditoría", "Los cambios relevantes registran usuario, fecha y operación."],
    ["Despliegue seguro", "Las claves permanecen fuera del código y se separan entre local, pruebas y producción."],
  ], [3100, 7366]),
  h("8. Alcance incluido y exclusiones"),
  h("8.1 Incluido", HeadingLevel.HEADING_2),
  ...bullets(["Módulos administrativos descritos: dashboard, afiliados, beneficiarios, pagos, documentos, avisos, notificaciones, reportes, usuarios y permisos.", "Historial protegido de fallecidos, auditoría y exportaciones controladas.", "Base con Next.js, TypeScript y Supabase; GitHub y Vercel después de validar localmente.", "Pruebas funcionales de los flujos acordados y documentación básica de operación."]),
  h("8.2 Fuera del alcance inicial", HeadingLevel.HEADING_2),
  ...bullets(["Rediseño o desarrollo del sitio web público y un portal público de titulares.", "Asistente con IA; queda para la fase final.", "Migración masiva sin inventario, depuración y aprobación de las fuentes heredadas.", "Definición de precios, tiempos contractuales o costos de servicios externos; se acuerdan después de cerrar el alcance.", "Auditoría forense o certificación legal del sistema anterior."]),
  h("9. Estrategia de implementación"),
  tbl(["Etapa", "Objetivo", "Entrega verificable"], [
    ["1. Validación", "Confirmar reglas, usuarios y flujos reales.", "Alcance y criterios de aceptación aprobados."],
    ["2. Base segura local", "Configurar base de datos, acceso, permisos y archivos privados.", "Entorno local con usuarios de prueba y controles validados."],
    ["3. Operación principal", "Conectar afiliados, beneficiarios, pagos, documentos y estados.", "Información persistente, regla de mora y auditoría."],
    ["4. Control administrativo", "Añadir avisos, notificaciones, reportes y exportaciones.", "Seguimiento completo y accesos por rol."],
    ["5. Migración y publicación", "Depurar datos aprobados y conectar nube/despliegue.", "Producción controlada con respaldos definidos."],
    ["6. Evolución IA", "Incorporar el asistente sobre datos autorizados.", "Asistente con fuentes, permisos y confirmación humana."],
  ], [1800, 4300, 4366]),
  h("10. Entregables y decisiones requeridas"),
  h("10.1 Entregables", HeadingLevel.HEADING_2),
  ...bullets(["Plataforma administrativa responsive.", "Base de datos estructurada y reglas de negocio documentadas.", "Matriz de roles y permisos.", "Módulos aprobados, historial y auditoría.", "Guía básica de operación y administración técnica.", "Repositorio versionado y configuración de despliegue al aprobar producción."]),
  h("10.2 Información requerida del cliente", HeadingLevel.HEADING_2),
  tbl(["Insumo", "Uso"], [
    ["Usuarios y responsabilidades", "Definir quién consulta, edita, carga documentos, gestiona pagos y exporta."],
    ["Reglas y fuentes de pago", "Validar periodicidad, formatos y excepciones de Activos, CASUR, TEGEN y particulares."],
    ["Inventario de datos heredados", "Definir qué se migra, qué se archiva y qué se depura."],
    ["Política documental e informes", "Acordar tipos de PDF, conservación, responsables, destinatarios e indicadores mensuales."],
  ], [3800, 6666]),
  h("11. Próximo paso recomendado"),
  callout("Aprobación de alcance", "Validar esta propuesta y realizar una sesión corta de levantamiento para cerrar permisos, formatos de pago e inventario de datos. Con esa aprobación se continúa la implementación local y se prepara el entorno seguro de Supabase.", C.paleTeal),
  p("La modernización no es solo un cambio visual: es una mejora de continuidad, control y protección de la información para Sopdisponal."),
];

const document = new Document({
  creator: "Sopdisponal", title: "Propuesta de modernización - Sopdisponal", description: "Propuesta funcional y de alcance de la plataforma administrativa Sopdisponal.",
  numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: "bullet", text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420, hanging: 200 } } } }] }] },
  styles: { default: { document: { run: { font: "Aptos", size: 20, color: C.ink } } } },
  sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1080, right: 720, bottom: 900, left: 720 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [r("Sopdisponal · Propuesta de modernización", { size: 16, color: C.muted })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [r("Documento de propuesta · ", { size: 16, color: C.muted }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: C.muted })] })] }) },
    children: body }],
});
const markdown = [
  "# Propuesta de modernización — Sopdisponal", "", "> Nueva plataforma administrativa interna · 11 de septiembre de 2026", "",
  "## Propuesta", "", "Se propone reemplazar la operación administrativa heredada por una plataforma interna moderna, segura y diseñada para el trabajo diario de Sopdisponal. El sitio web público no forma parte de este alcance.", "",
  "## Alcance", "", "- Dashboard con titulares y beneficiarios activos, inactivos y fallecidos.", "- Directorio y ficha única de afiliados; fecha de expedición de cédula, clasificación Particular/Activo/CASUR/TEGEN y periodo de seis meses.", "- Gestión de beneficiarios e historial reservado de fallecidos.", "- Pagos, lotes, observaciones y regla automática de inactivo a 3 meses y suspendido a 6 meses.", "- Expediente PDF privado por afiliado.", "- Avisos, notificaciones, informes, usuarios, permisos y exportaciones auditadas.", "",
  "## Riesgos del sistema anterior", "", "El respaldo heredado incluye estructura de servidor, bases de datos y material de autenticación. Debe tratarse como confidencial, no publicarse en repositorios y no reutilizarse sin renovar accesos. También hay riesgos de dependencia tecnológica, mezcla entre entorno público y operación interna, controles no granulares y reglas manuales de cartera.", "",
  "## Fuera de alcance inicial", "", "- Sitio web y portal público.", "- Asistente IA (fase posterior).", "- Migración masiva sin inventario y depuración aprobados.", "- Precios, tiempos contractuales y servicios externos, que se acuerdan al cerrar alcance.", "",
  "## Próximo paso", "", "Validar la propuesta y realizar una sesión de levantamiento para definir usuarios, permisos, formatos de pago e inventario de datos a migrar.", "",
].join("\\n");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(mdFile, markdown, "utf8");
Packer.toBuffer(document).then((buffer) => { fs.writeFileSync(docxFile, buffer); console.log(docxFile); console.log(mdFile); });
