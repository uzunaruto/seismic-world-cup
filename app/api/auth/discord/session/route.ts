import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchDiscordIdentity } from '@/lib/auth';
import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST /api/auth/discord/session
// Body: { accessToken: string }
// Validates with Discord, persists to Supabase (if configured), sets cookie.
// Returns user object on success. If Supabase is not configured yet (dev/MVP),
// still returns the user but flags `backend_ready: false`.
export async function POST(req: NextRequest) {
  let accessToken: string | null = null;
  try {
    const body = await req.json();
    accessToken = body.accessToken;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!accessToken) {
    return NextResponse.json({ error: 'missing_token' }, { status: 400 });
  }

  // 1. Validate token + fetch user + member from Discord
  const identity = await fetchDiscordIdentity(accessToken);
  if (!identity) {
    return NextResponse.json(
      {
        error: 'discord_auth_failed',
        message: 'Token invalid or you are not a member of the Seismic Discord',
      },
      { status: 401 }
    );
  }

  const user = {
    discord_id: identity.id,
    username: identity.username,
    global_name: identity.global_name,
    pfp_url: identity.pfp_url,
    magnitude: identity.magnitude,
    is_default_avatar: identity.is_default_avatar,
  };

  // 2. Persist session to Supabase if configured. If not (MVP/dev), return user
  //    anyway so the client can proceed. Submitting will surface a clearer
  //    error from /api/submit.
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      user,
      backend_ready: false,
    });
  }

  const supabase = getServiceSupabase();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error: dbError } = await supabase
    .from('discord_sessions')
    .insert({
      discord_id: identity.id,
      username: identity.username,
      global_name: identity.global_name,
      pfp_url: identity.pfp_url,
      is_default_avatar: identity.is_default_avatar,
      magnitude: identity.magnitude,
      role_ids: identity.role_ids,
      joined_at: identity.joined_at,
      access_token: accessToken,
      expires_at: expiresAt,
    })
    .select('session_id')
    .single();

  if (dbError || !data) {
    console.error('[discord-session] DB insert failed:', dbError);
    return NextResponse.json(
      {
        error: 'session_persist_failed',
        message: 'Authenticated with Discord, but failed to save session',
      },
      { status: 500 }
    );
  }

  // 3. Set session cookie
  const cookieStore = await cookies();
  cookieStore.set('discord_session', data.session_id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  return NextResponse.json({ ok: true, user, backend_ready: true });
}

// GET /api/auth/discord/session - return current session
export async function GET(_req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ user: null, backend_ready: false });
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get('discord_session')?.value;
  if (!sessionId) return NextResponse.json({ user: null });

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('discord_sessions')
    .select('discord_id, username, global_name, pfp_url, magnitude, is_default_avatar, role_ids, joined_at')
    .eq('session_id', sessionId)
    .single();

  if (error || !data) return NextResponse.json({ user: null });
  return NextResponse.json({ user: data });
}

// DELETE /api/auth/discord/session - sign out
export async function DELETE(_req: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete('discord_session');
  return NextResponse.json({ ok: true });
}