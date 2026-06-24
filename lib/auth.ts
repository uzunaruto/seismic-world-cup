// =============================================================================
// Discord OAuth helpers (client + server side)
// =============================================================================
// Auth flow:
//   1. User clicks "Connect Discord" on landing page
//   2. Client-side redirect to discord.com/oauth2/authorize (implicit flow,
//      response_type=token - no PKCE needed, no client secret on the wire)
//   3. Discord redirects back to <REDIRECT_URI>#access_token=XXX
//   4. Client JS reads token, calls /api/auth/discord/session
//   5. Server validates token via /users/@me, fetches guild member via
//      /users/@me/guilds/{guild_id}/member, persists to Supabase, returns
//      httpOnly session cookie
//
// Scope: 'identify guilds.members.read' - both required to get user + roles.
// =============================================================================

// -----------------------------------------------------------------------------
// Seismic configuration - pulled from MEMORY (seismic-identity setup)
// -----------------------------------------------------------------------------
export const DISCORD_CLIENT_ID = '1509035141526192299';   // "Seismic Card" app
export const SEISMIC_GUILD_ID = '1343751435711414362';
export const DISCORD_SCOPES = 'identify guilds.members.read';

// Magnitude role snowflakes (from MEMORY) - highest wins
export const MAG_ROLE_IDS: Record<string, number> = {
  '1346572989654765691': 3,
  '1346583232220500051': 4,
  '1346583465704951879': 5,
  '1346583601025781760': 6,
  '1346583708018278481': 7,
  '1346583804630011914': 8,
  '1346583929473335429': 9,
};

// Magnitude → tier color (official from MEMORY, NOT thermal)
export const MAG_COLORS: Record<number, string> = {
  1: '#D5D1C4', 2: '#5BB5A2', 3: '#2AA346', 4: '#75E300', 5: '#659E0F',
  6: '#C19200', 7: '#A87504', 8: '#9C1515', 9: '#0693CD',
};

// -----------------------------------------------------------------------------
// Client-side: build OAuth URL and start the flow
// -----------------------------------------------------------------------------
export function buildDiscordAuthUrl(redirectUri: string) {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: DISCORD_SCOPES,
    prompt: 'consent',
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

// -----------------------------------------------------------------------------
// Server-side: fetch user + guild member using the user's access token
// Returns null if the token is invalid or the user is not in the guild.
// -----------------------------------------------------------------------------
export interface DiscordIdentity {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;            // hash (or null for default avatar)
  pfp_url: string;                  // resolved CDN URL (always populated)
  is_default_avatar: boolean;
  joined_at: string | null;
  magnitude: number | null;
  role_ids: string[];
}

export async function fetchDiscordIdentity(accessToken: string): Promise<DiscordIdentity | null> {
  // 1. /users/@me
  const userRes = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) {
    console.error('[discord-auth] /users/@me failed:', userRes.status);
    return null;
  }
  const user = await userRes.json();

  // 2. /users/@me/guilds/{guild_id}/member (may 404 if not in guild)
  const memberRes = await fetch(
    `https://discord.com/api/v10/users/@me/guilds/${SEISMIC_GUILD_ID}/member`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  let member: any = null;
  if (memberRes.ok) {
    member = await memberRes.json();
  } else if (memberRes.status === 404) {
    console.warn('[discord-auth] user not in Seismic guild');
    return null;
  } else {
    console.error('[discord-auth] guild member fetch failed:', memberRes.status);
    return null;
  }

  // 3. Resolve PFP URL - guild avatar overrides global
  const roleIds: string[] = member.roles || [];
  const guildAvatar = member.avatar;
  let pfpUrl: string;
  let isDefault: boolean;
  if (guildAvatar) {
    pfpUrl = `https://cdn.discordapp.com/guilds/${SEISMIC_GUILD_ID}/users/${user.id}/avatars/${guildAvatar}.png?size=1024`;
    isDefault = false;
  } else if (user.avatar) {
    const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
    pfpUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=1024`;
    isDefault = false;
  } else {
    // Default avatar - face-swap will fail on these
    const idx = (BigInt(user.id) >> 22n) % 6n;       // new formula (no discriminator)
    pfpUrl = `https://cdn.discordapp.com/embed/avatars/${idx}.png?size=1024`;
    isDefault = true;
  }

  return {
    id: user.id,
    username: user.username,
    global_name: user.global_name || null,
    avatar: user.avatar,
    pfp_url: pfpUrl,
    is_default_avatar: isDefault,
    joined_at: member.joined_at || null,
    magnitude: detectMagnitudeFromRoles(roleIds),
    role_ids: roleIds,
  };
}

// -----------------------------------------------------------------------------
// Magnitude detection - return highest tier from role array
// -----------------------------------------------------------------------------
export function detectMagnitudeFromRoles(roleIds: string[]): number | null {
  let highest = 0;
  for (const id of roleIds) {
    const mag = MAG_ROLE_IDS[id];
    if (mag && mag > highest) highest = mag;
  }
  return highest || null;
}

// -----------------------------------------------------------------------------
// Read access token from URL hash (client side)
// Returns null if no token present.
// -----------------------------------------------------------------------------
export function readTokenFromHash(): { token: string; expiresIn: number } | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const token = params.get('access_token');
  const expiresIn = parseInt(params.get('expires_in') || '0', 10);
  if (!token) return null;
  return { token, expiresIn };
}

export function clearHash() {
  if (typeof window !== 'undefined') {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}
