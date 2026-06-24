import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchDiscordIdentity, readTokenFromHash } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

// POST /api/auth/discord/session
// Body: { accessToken: string }
// Server validates with Discord, persists to Supabase, returns httpOnly cookie.
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

  // Validate token + fetch user + member from Discord
  const identity = await fetchDiscordIdentity(accessToken);
  if (!identity) {
    return NextResponse.json(
      { error: 'discord_auth_failed', message: 'Token invalid or user not in Seismic guild' },
      { status: 401 }
    );
  }

  if (identity.is_default_avatar) {
    // We can still create a session, but mark this flag so the UI warns
    // the user that face-swap will fail without a custom Discord avatar.
  }

  // Persist session
  const supabase = getServiceSupabase();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();  // 7d, matches Discord implicit token lifetime
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
    return NextResponse.json({ error: 'session_persist_failed' }, { status: 500 });
  }

  // Set session cookie
  const cookieStore = await cookies();
  cookieStore.set('discord_session', data.session_id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,    // 7 days
    path: '/',
  });

  return NextResponse.json({
    ok: true,
    user: {
      discord_id: identity.id,
      username: identity.username,
      global_name: identity.global_name,
      pfp_url: identity.pfp_url,
      magnitude: identity.magnitude,
      is_default_avatar: identity.is_default_avatar,
    },
  });
}

// GET /api/auth/discord/session — return current session
export async function GET(_req: NextRequest) {
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

// DELETE /api/auth/discord/session — sign out
export async function DELETE(_req: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete('discord_session');
  return NextResponse.json({ ok: true });
}
