import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "";

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      fetch: (input, init) => {
        const request = input instanceof Request ? input : null;
        const headers = new Headers(request?.headers ?? init?.headers ?? undefined);
        headers.set("cache-control", "no-cache, no-store, max-age=0");
        headers.set("pragma", "no-cache");

        return fetch(input, {
          ...init,
          cache: "no-store",
          headers,
        });
      },
    },
  });
}
