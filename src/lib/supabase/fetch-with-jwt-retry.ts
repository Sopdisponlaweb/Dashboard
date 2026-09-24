// PostgREST occasionally validates a JWT against a stale cached clock and rejects a
// token issued moments earlier with PGRST303 "JWT issued at future" (fixed upstream
// in PostgREST 16.3 / 14.18). It shows up on the first request after a session
// refresh. Supabase's recommended mitigation is to retry that request once after
// a short pause; the second attempt sees a fresh clock.
// https://github.com/orgs/supabase/discussions/48123

const RETRY_DELAY_MS = 1000;

function isRestRequest(input: RequestInfo | URL) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return url.includes("/rest/v1/");
}

async function isJwtIssuedAtFuture(response: Response) {
  if (response.status !== 401) return false;
  try {
    const body = await response.clone().json();
    return body?.code === "PGRST303";
  } catch {
    return false;
  }
}

export const fetchWithJwtRetry: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);

  // Only REST calls: their bodies are strings and safe to send twice, unlike
  // streamed storage uploads.
  if (!isRestRequest(input) || !(await isJwtIssuedAtFuture(response))) return response;

  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  return fetch(input, init);
};
