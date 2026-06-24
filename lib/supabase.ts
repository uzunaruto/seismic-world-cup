import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Returns true if Supabase env vars are present.
// Used by API routes to fall back to a "no-backend" mode during dev/MVP
// without crashing when the operator hasn't set up Supabase yet.
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// Server-side Supabase client (service role, full DB access).
// NEVER import this from a Client Component — exposes service role key.
let _service: SupabaseClient | null = null;

export function getServiceSupabase(): SupabaseClient {
  if (_service) return _service;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  _service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _service;
}

// Public Supabase client for the browser (anon key, RLS-restricted).
let _public: SupabaseClient | null = null;

export function getPublicSupabase(): SupabaseClient {
  if (_public) return _public;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  _public = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return _public;
}
