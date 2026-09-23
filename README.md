# Sopdisponal Admin

Nueva plataforma administrativa interna para la gestión de afiliados, beneficiarios, pagos, documentos, reportes y permisos de Sopdisponal.

## Estado

Primera base local con Next.js 16, React 19, TypeScript y Supabase CLI. El dashboard utiliza el lenguaje visual de referencia ubicado en `Z:\PROYECTOS\Diseño`. No hay conexión con Supabase Cloud, GitHub ni Vercel.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

Comprobaciones disponibles:

```bash
npm run lint
npm run typecheck
npm run build
```

Supabase local requiere Docker Desktop. Cuando esté instalado, consulta `supabase/README.md` para iniciar y reiniciar la base.

## Alcance inicial

- Dashboard administrativo.
- Consulta integral de afiliados.
- Afiliados y beneficiarios.
- Pagos e importaciones por lote.
- Expedientes PDF privados.
- Reportes y descargas con permisos.
- Notificaciones, auditoría y automatizaciones.
- Asistente interno con IA en una fase posterior.

El respaldo antiguo de cPanel no debe copiarse dentro de este repositorio.

## Datos durante la fase local

Los módulos de consulta y afiliados usan un repositorio local tipado ubicado en `src/features/affiliates`. Esto permite probar filtros, cobertura y fichas sin conectar información real. La interfaz consumirá el mismo contrato cuando el repositorio sea reemplazado por Supabase.
