# sopdisponal-mcp-server

Servidor MCP local que conecta Sopdisponal con Claude Desktop o Claude Code, para consultar y (con confirmación humana) registrar datos reales de la plataforma sin salir del chat.

## Cómo funciona

- **Autenticación**: el servidor inicia sesión con tu propio usuario y contraseña de Sopdisponal (no con una llave de servicio). Solo puede hacer lo que tus permisos ya te permiten hacer en la plataforma, y todo queda auditado a tu nombre igual que si lo hicieras desde el navegador.
- **Lectura**: `search_affiliates`, `get_affiliate_detail`, `get_dashboard_summary`, `get_payment_totals`, `list_affiliate_credits` — consultan directo, sin confirmación.
- **Escritura**: `propose_register_payment`, `propose_request_credit`, `propose_register_credit_installment`, `propose_update_affiliate_identity` **nunca guardan nada por sí solas**. Cada una prepara una propuesta y devuelve un resumen en texto plano que Claude debe mostrarte antes de hacer cualquier otra cosa. Solo después de que tú apruebes explícitamente, Claude puede llamar a `confirm_write` con el `proposalId` para aplicar el cambio de verdad. Puedes usar `cancel_write` para descartar una propuesta. Las propuestas sin confirmar vencen a los 10 minutos.

## Configuración

1. `cp .env.example .env` y completa:
   - `SUPABASE_URL` / `SUPABASE_ANON_KEY`: los mismos valores de `sopdisponal-admin/.env.local` (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
   - `MCP_SUPABASE_EMAIL` / `MCP_SUPABASE_PASSWORD`: tu propio usuario de Sopdisponal.
2. `npm install`
3. `npm run build`

## Conectarlo a Claude Desktop

Edita tu `claude_desktop_config.json` (menú Claude → Settings → Developer → Edit Config) y agrega:

```json
{
  "mcpServers": {
    "sopdisponal": {
      "command": "node",
      "args": ["RUTA/A/sopdisponal-admin/mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "http://127.0.0.1:54321",
        "SUPABASE_ANON_KEY": "tu-anon-key",
        "MCP_SUPABASE_EMAIL": "tu-correo",
        "MCP_SUPABASE_PASSWORD": "tu-contraseña"
      }
    }
  }
}
```

Reinicia Claude Desktop. Deberías ver las herramientas de Sopdisponal disponibles en el selector de herramientas.

## Conectarlo a Claude Code

```bash
claude mcp add sopdisponal --env SUPABASE_URL=http://127.0.0.1:54321 --env SUPABASE_ANON_KEY=tu-anon-key --env MCP_SUPABASE_EMAIL=tu-correo --env MCP_SUPABASE_PASSWORD=tu-contraseña -- node RUTA/A/sopdisponal-admin/mcp-server/dist/index.js
```

## Desarrollo

```bash
npm run dev    # recarga automática con tsx
npm run build  # compila a dist/
```

Para probar sin un cliente MCP completo, usa el [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```
