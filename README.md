# Seismic World Cup 🏆

> Panini-style World Cup cards for the Seismic Magnitudes community.
> Discord OAuth. Curator review via emoji reactions. Public album.

## What is this

A web app where:

1. User connects their **Discord** account (must be in the Seismic guild)
2. **Magnitude auto-detected** from their Discord role (M3–M9)
3. User picks position, kit, and writes a motto
4. Card renders client-side via `html-to-image` and uploads to Supabase
5. Submission goes to Discord `#curator` channel as an embed with the card image
6. Curator reacts with ✅ (publish to album) or ❌ (reject)
7. Approved cards appear in the public **Album**

## Stack

- **Next.js 14** (App Router) on Vercel
- **Discord OAuth 2.0 implicit flow** for auth
- **Supabase** (Postgres + Storage) for submission workflow
- **discord.js** bot for reaction listener
- **Discord webhook** for submission posts
- **html-to-image** (client-side) for card PNG rendering — no AI face-swap, just CSS + PFP

## Project structure

```
seismic-world-cup/
├── app/
│   ├── page.tsx                        # Landing (Connect Discord)
│   ├── compose/page.tsx                # Card builder (position + kit + motto)
│   ├── gallery/page.tsx                # Public album
│   ├── api/
│   │   ├── auth/discord/session/       # POST token → session cookie
│   │   ├── submit/                     # POST: receive PNG upload, save, post to Discord
│   │   ├── status/[id]/                # GET: poll submission status
│   │   └── album/                      # GET: public approved cards
│   ├── layout.tsx
│   └── globals.css
├── components/
│   └── PaniniCard.tsx                  # The card UI (1080x1620, scaled in preview)
├── lib/
│   ├── auth.ts                         # Discord OAuth + Magnitude detection
│   ├── supabase.ts                     # DB clients
│   ├── stats.ts                        # Deterministic stats by Discord ID
│   └── discord.ts                      # Webhook helpers (embed + edit)
├── bot/
│   └── index.js                        # Discord reaction listener
├── supabase/
│   └── schema.sql                      # Tables + views + RLS
├── .env.example
├── next.config.mjs
├── package.json
└── README.md
```

## Card anatomy

1080×1620 (Instagram portrait, 2:3), rendered client-side then uploaded.

```
┌─────────────────────────────────────┐
│   SEISMIC MAGNITUDES · WORLD CUP    │  ← top banner
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │       USER DISCORD PFP        │  │  ← circle, 720×720 native
│  │       (no AI, actual PFP)     │  │
│  │                               │  │
│  └───────────────────────────────┘  │
│                                     │
│   Display Name                       │  ← Cinzel 64px
│   @username                         │
│                                     │
│   [FW · Forward]                    │  ← position pill
│                                     │
│   "We're going all the way"          │  ← motto, italic
│                                     │
│   ┌────┬────┬────┬────┐              │
│   │PAC │SHO │PAS │DRI │              │  ← 4 stat cells
│   │ 88 │ 92 │ 75 │ 84 │              │
│   └────┴────┴────┴────┘              │
│                                     │
│   NO. 7   [M7]   2026               │  ← bottom bar
└─────────────────────────────────────┘
   ROCKY (small watermark)
```

## Kits

- **Home**: copper gradient (`#A87504` → `#6a4802`) with parchment text
- **Away**: obsidian gradient with copper accents
- **Foil ✨**: iridescent copper gradient (limited to first ~100 submitters, or manual grant)

## Stats

Deterministic per (Discord ID, position) — same user always gets same stats. Range 50-99, biased by position:

| Position | PAC | SHO | PAS | DRI |
|----------|-----|-----|-----|-----|
| Forward  | 84  | 86  | 72  | 80  |
| Midfielder | 76 | 70 | 88 | 84 |
| Defender | 70  | 55  | 70  | 66  |
| Goalkeeper | 58 | 45 | 62 | 68 |
| Captain  | 78  | 80  | 80  | 80  |
| Coach    | 50  | 50  | 92  | 60  |

Each stat gets ±8 random variation (seeded by Discord ID).

## Setup

### 1. Install
```bash
cd ~/seismic-world-cup
npm install
```

### 2. Env
```bash
cp .env.example .env.local
# Fill in Supabase + Discord values
```

### 3. Supabase
1. Create project at https://supabase.com/dashboard
2. Settings → API → copy Project URL + service_role key
3. SQL editor → run `supabase/schema.sql`
4. Storage → New bucket `cards`, public = ON

### 4. Discord (webhook + bot)
1. **Webhook**: Server settings → Integrations → Webhooks → new in `#curator`
2. **Bot**: https://discord.com/developers/applications → use App 1509035141526192299 OR create new
   - Bot tab → enable Message Content Intent + Server Members Intent
   - Permissions: View Channels, Read Message History, Add Reactions, Manage Messages
3. **Channel ID**: right-click `#curator` → Copy Channel ID

### 5. **⚠️ Add redirect URI to Discord app** (manual)
VPS cannot PATCH Discord app URIs. After first deploy:
1. Open https://discord.com/developers/applications/1509035141526192299/oauth2
2. Add redirect: `https://seismic-world-cup.vercel.app/`
3. Save, wait 30s

### 6. Run locally
```bash
# Terminal 1
npm run dev

# Terminal 2
npm run bot
```

## Deployment

- **Next.js**: Vercel (push to `uzunaruto/seismic-world-cup`, import, add env vars)
- **Bot**: Modal.com / Fly.io / Railway / VPS with PM2

## Architecture

```
USER BROWSER              NEXT.JS                SUPABASE         DISCORD
  │                          │                      │                │
  ├─ Connect Discord         │                      │                │
  │  (client-side redirect)  │                      │                │
  │  ◄─ #access_token=...    │                      │                │
  │                          │                      │                │
  ├─ POST /api/auth/.../session (token)             │                │
  │                          ├─ fetch /users/@me ────────────────────►│
  │                          ├─ fetch /member ──────────────────────►│
  │                          ├─ detect Magnitude   │                │
  │                          ├─ save to sessions ──►│                │
  │  ◄─ session cookie ──────┤                      │                │
  │                          │                      │                │
  ├─ Compose card            │                      │                │
  │  (position + kit + motto │                      │                │
  │   + live preview)        │                      │                │
  │                          │                      │                │
  ├─ Click Submit           │                      │                │
  │  ├─ html-to-image → PNG  │                      │                │
  │  ├─ POST /api/submit (multipart)                 │                │
  │                          ├─ rate limit check ──►│                │
  │                          ├─ insert submission ─►│                │
  │                          ├─ upload PNG ────────►│ (Storage)      │
  │                          ├─ webhook post card ──────────────────►│
  │  ◄─ pending ─────────────┤                      │       mod ✅   │
  │                          │                      │                ├─ bot reaction
  │                          │                      │                ├─ update status ─►│
  │  ◄─ poll /api/status ────┤ ◄────────────────────┤                │
  │  Status: approved        │                      │                │
  │  appears in /album       │                      │                │
```

## Security

- 🔒 Discord OAuth implicit flow — server fetches user + roles, never trusts client data
- ⏱️ Rate limit: 3 cards per 7 days per Discord ID (prevent spam)
- 🛡️ RLS: only `service_role` writes; public can only read `status = 'approved'`
- 📝 Audit log: every approval/rejection logged with Discord moderator ID
- ⚠️ Default-avatar users blocked from submitting
- 🛂 Motto content moderated (≤80 chars, reviewed by curator)

## Design tokens

- **Primary**: Magnitude 7 copper `#A87504`
- **Accent**: Rocky orange `#c46a2f`
- **Surface**: Obsidian `#0a0806` + parchment cream `#f5ebd7`
- **Fonts**: Outfit (body) + Cinzel (display) + Caveat (hand-drawn)
- **Anti-slop**: no purple/blue gradient (Lila Rule), no Inter default, no em-dash, no fake round numbers

## What's still needed

- [ ] **Supabase project** (URL + service_role key)
- [ ] **Discord webhook URL** for `#curator` channel
- [ ] **Discord bot token** + channel ID + guild ID
- [ ] **Manual step**: add redirect URI to Discord Dev Portal after first deploy
