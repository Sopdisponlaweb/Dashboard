# Supabase local

Esta carpeta contiene la configuración, migraciones y datos de catálogo de la plataforma.

La CLI ya está inicializada. Para ejecutar PostgreSQL, Auth, Storage y Studio en local todavía se necesita Docker Desktop o un runtime compatible. No se conectará un proyecto remoto durante esta fase.

## Puesta en marcha

```bash
npm run supabase:start
npm run supabase:reset
```

Después de iniciar el entorno, copia `.env.example` como `.env.local` y reemplaza los valores con las claves locales que entregue `supabase status`.

El registro público está deshabilitado. El primer usuario se crea desde Supabase Studio y su rol de administrador se asigna una única vez desde el editor SQL local:

```sql
insert into public.user_roles (user_id, role_id)
select users.id, roles.id
from auth.users
cross join public.roles
where users.email = 'correo-del-administrador@ejemplo.com'
  and roles.key = 'administrator';
```

La función protegida `private.refresh_membership_statuses()` implementa la regla de mora: inactivo a los tres meses y suspendido a los seis. Solo el rol de servicio puede ejecutarla; en una fase posterior se programará su ejecución periódica.

Reglas del proyecto:

- Todas las tablas expuestas tendrán RLS habilitado.
- El rol `anon` no tendrá acceso a información de negocio.
- Los permisos se comprobarán tanto en la aplicación como en PostgreSQL.
- Las funciones privilegiadas viven en el esquema no expuesto `private`.
- Las claves privilegiadas solo podrán usarse desde código de servidor.
- Los buckets de expedientes y avisos de oficina son privados.
- Las migraciones y pruebas de políticas se guardarán en Git.
