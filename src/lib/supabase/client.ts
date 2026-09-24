"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicEnv } from "./env";
import { fetchWithJwtRetry } from "./fetch-with-jwt-retry";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (browserClient) {
    return browserClient;
  }

  const { url, publishableKey } = getSupabasePublicEnv();
  browserClient = createBrowserClient(url, publishableKey, { global: { fetch: fetchWithJwtRetry } });

  return browserClient;
}
