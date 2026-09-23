# Sopdisponal Admin — Requerimientos y estado

> Versión 0.2 · 11 de septiembre de 2026

La versión Word es el documento de referencia completo.

## Resumen

Sopdisponal Admin es una plataforma administrativa interna para gestionar afiliados, beneficiarios, pagos, documentos, reportes y permisos. El sitio público no forma parte del alcance actual.

## Construido

- Base Next.js 16, React 19, TypeScript y sistema visual administrativo.
- Dashboard, consulta integral, directorio y ficha de afiliados con datos demo.
- Formularios de alta y edición de afiliados con validación y acciones de servidor preparadas.
- Formulario de alta de beneficiarios desde la ficha del titular.
- Migración Supabase inicial: esquema, RLS, permisos, auditoría, buckets privados y regla de mora.
- Verificación con lint, TypeScript, build y pruebas de navegador.

## Pendientes prioritarios

1. Instalar Docker y arrancar Supabase local.
2. Conectar el repositorio de datos a Supabase y activar Auth/RLS en interfaz.
3. Implementar expediente PDF privado.
4. Implementar pagos, importaciones y automatización de mora.
5. Añadir avisos, notificaciones, permisos de exportación, reportes y auditoría de interfaz.
6. Subir a GitHub, conectar Supabase Cloud y desplegar en Vercel.
7. Construir el asistente IA como fase final.

Consulta el archivo .docx para la matriz detallada de requerimientos, arquitectura, seguridad, riesgos y criterios de aceptación.
