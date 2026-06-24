# Seismic World Cup 🏆

> Take a selfie with the Seismic moderators — group photo as World Cup champions.
> Community-curated via Discord emoji reactions.

## What is this

A web app where:

1. User connects their **Discord** account (must be in the Seismic guild)
2. Their Discord PFP gets AI-composited into a podium scene with 2 Seismic moderators
3. **Magnitude is auto-detected from their Discord role** (M3–M9) — no bio parsing
4. Submission goes to a Discord `#curator` channel as an embed
5. Curator reacts with ✅ (publish to gallery) or ❌ (reject)
6. Approved selfies appear in the public Hall of Champions

## Stack

- **Next.js 14** (App Router) on Vercel
- **Discord OAuth 2.0 implicit flow** for auth (no client secret, no server-side exchange needed for OAuth — server validates token + fetches user/roles)
- **Supabase** (Postgres + Storage) for submission workflow
- **Replicate** (ReActor face-swap) for AI composite
- **discord.js** bot for reaction listener
- **Discord webhook** for submission posts

## Project structure

```
seismic-world-cup/
├── app/
│   ├── page.tsx                      # Landing (Connect Discord button)
│   ├── compose/                      # Composer (post-auth)
│   ├── gallery/                      # Public Hall of Champions
│   ├── api/
│   │   ├── auth/discord/session/     # POST: validate Discord token, create session
│   │   │                             # GET: current session
│   │   │                             # DELETE: sign out
│   │   ├── submit/                   # POST: create submission, run AI, post to Discord
│   │   ├── status/[id]/              # GET: poll submission status
│   │   └── gallery/                  # GET: public approved selfies
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── auth.ts                       # Discord OAuth helpers + Magnitude detection
│   ├── supabase.ts                   # Service + public clients
│   ├── ai.ts                         # Replicate face-swap
│   └── discord.ts                    # Webhook helpers
├── bot/
│   └── index.js                      # Discord reaction listener
├── supabase/
│   └── schema.sql                    # Tables + views + RLS
├── public/
│   └── assets/
│       └── podium-base.png           # ⬅️  YOU PROVIDE: 2 mods on podium, 1 empty slot
├── .env.example
├── next.config.mjs
├── package.json
└── README.md
```

## Setup

### 1. Install deps
```bash
cd ~/seismic-world-cup
npm install
```

### 2. Set up environment
```bash
cp .env.example .env.local
# Fill in Supabase + Replicate + Discord webhook/bot values
```

### 3. Supabase
1. Create project at https://supabase.com/dashboard
2. Settings → API → copy `Project URL` + `service_role` key to `.env.local`
3. SQL editor → paste + run `supabase/schema.sql`
4. Storage → New bucket: `composites`, public = ON

### 4. Discord (webhook + bot)
1. **Webhook**: Server settings → Integrations → Webhooks → New webhook in `#curator` channel → copy URL to `.env.local`
2. **Bot**: https://discord.com/developers/applications → use existing app `1509035141526192299` OR create new
   - Bot tab → enable "Message Content Intent" + "Server Members Intent"
   - Reset/copy bot token to `.env.local`
   - OAuth2 → URL Generator → scopes: `bot` + `applications.commands`
   - Bot permissions: `View Channels`, `Read Message History`, `Add Reactions`, `Manage Messages`
   - Invite to server
3. **Channel ID**: right-click `#curator` → Copy Channel ID (Developer Mode ON)
4. **Guild ID**: right-click server icon → Copy Server ID (already `1343751435711414362` for Seismic)

### 5. Replicate
1. Sign up at https://replicate.com
2. Account → API tokens → create token → copy to `.env.local`

### 6. Add the podium base image
**Required**: place `public/assets/podium-base.png` — a wide image (1600x900 or 1920x1080) with:
- 2 Seismic moderators on a podium
- Empty slot in the center for the user's PFP
- Trophy raised or visible

This is the AI composite target. The face-swap model will replace the center "placeholder" face with the user's Discord PFP.

### 7. **⚠️ Add redirect URI to Discord app** (manual step, no API workaround)
VPS **cannot** programmatically add redirect URIs to Discord apps. The app owner must do this manually.

For **local dev**:
1. Open https://discord.com/developers/applications/1509035141526192299/oauth2
2. Scroll to **Redirects**
3. Click **Add Another**, paste: `http://localhost:3000/`
4. Click **Save Changes**
5. Wait 30 seconds for Discord to propagate

For **production** (after deploying to Vercel):
1. Same URL, but paste your production URL: `https://seismic-world-cup.vercel.app/`
2. Save, wait 30s

Symptom of missing redirect URI: clicking "Connect Discord" fails with `redirect_uri_mismatch` and a generic error page. No CLI/API workaround — must be done in the Dev Portal.

### 8. Run locally
```bash
# Terminal 1: Next.js
npm run dev

# Terminal 2: Discord reaction bot
npm run bot
```

## Deployment

### Vercel (Next.js)
1. Push to GitHub: `github.com/uzunaruto/seismic-world-cup`
2. Import in Vercel → add all env vars from `.env.example` → deploy
3. After first deploy, **add the production redirect URI** to Discord Dev Portal (see step 7 above)

### Discord bot
Deploy as long-running service. Options:
- **Modal.com** (serverless, supports long-running services, ~$0 idle)
- **Fly.io** / **Railway** (small always-on)
- **VPS** with PM2

## Architecture

```
USER BROWSER              NEXT.JS                  SUPABASE         REPLICATE        DISCORD
  │                          │                        │                │                │
  ├─ Click Connect Discord   │                        │                │                │
  │  (client-side redirect)  │                        │                │                │
  │                          │                        │                │                │
  │  ◄── #access_token=... ──┤                        │                │                │
  │     (back from Discord)  │                        │                │                │
  │                          │                        │                │                │
  ├─ POST /api/auth/.../session (token)               │                │                │
  │                          ├─ fetch /users/@me ───── │  ────────────────────────►    │
  │                          ├─ fetch /member ─────── │  ────────────────────────►    │
  │                          ├─ detect Magnitude      │                │                │
  │                          ├─ save to sessions ───► │                │                │
  │  ◄─ session cookie ──────┤                        │                │                │
  │  redirect to /compose    │                        │                │                │
  │                          │                        │                │                │
  ├─ Submit ──────────────►  │                        │                │                │
  │                          ├─ rate limit check ───► │                │                │
  │                          ├─ insert submission ──► │                │                │
  │                          ├─ face-swap ──────────────────────────► │                │
  │                          ├─ upload to storage ──► │                │                │
  │                          ├─ webhook post embed ──────────────────────────────► │
  │                          │                        │                │       mod ✅   │
  │                          │                        │                │                ├─ bot reaction
  │                          │                        │                │                ├─ update status ─► │
  │  ◄─ poll /api/status ────┤ ◄──────────────────────┤                │                │
  │  Status: approved        │                        │                │                │
  │  appears in /gallery     │                        │                │                │
```

## Security

- 🔒 Discord OAuth implicit flow with `guilds.members.read` — server fetches user + roles, never trusts client data
- ⏱️ Rate limit: max 5 submissions per 7 days per Discord ID
- 🛡️ RLS: only `service_role` can write; public can only read `status = 'approved'`
- 📝 Audit log: every approval/rejection logged with Discord moderator ID
- 🖼️ Composite URLs persisted to Supabase Storage (Replicate free tier expires after 1h)
- ⚠️ Default-avatar users blocked from submitting (face-swap would fail)

## What's still needed from user

- [ ] **3 moderator photos** (2 for podium, 1 for future scenes)
- [ ] **podium-base.png** — the AI composite target
- [ ] **Supabase project** (URL + service_role key)
- [ ] **Replicate API token**
- [ ] **Discord webhook URL** for `#curator` channel
- [ ] **Discord bot token** + channel ID + guild ID
- [ ] **Manual step**: add redirect URI to Discord Dev Portal after first deploy

## Design tokens

- **Primary**: Magnitude 7 copper `#A87504` (user's tier)
- **Accent**: Rocky orange `#c46a2f`
- **Surface**: Obsidian `#0a0806` + parchment cream `#f5ebd7`
- **Fonts**: Outfit (body) + Cinzel (display) + Caveat (hand-drawn accents)
- **Anti-slop**: no purple/blue gradient (Lila Rule), no Inter default, no em-dash, no fake round numbers
