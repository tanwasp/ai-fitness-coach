# Fitness Coach Dashboard

A personal AI-powered training dashboard built with Next.js 15. Features per-user data isolation, an AI coach (Perplexity), workout logging, trend charts, plan viewer, and exercise progression tracking.

---

## Features

- **AI Coach** — chat with a context-aware training coach (powered by Perplexity AI)
- **Workout Logging** — describe your session in natural language; the coach parses and saves it
- **Trends** — volume, intensity, and PR charts over time
- **Plan Viewer** — view and update your current training plan
- **Progression** — per-exercise load tracking
- **Multi-user** — friends can create accounts with their own isolated data and goals

---

## Local Development

### Prerequisites

- Node.js 20+
- A [Perplexity API key](https://www.perplexity.ai/settings/api)

### Setup

```bash
cd dashboard
npm install
```

Copy the example env file and fill in values:

```bash
cp .env.local.example .env.local   # or edit .env.local directly
```

Generate a `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

Set it in `.env.local`:

```
NEXTAUTH_SECRET=<your generated secret>
NEXTAUTH_URL=http://localhost:3000
PERPLEXITY_API_KEY=<your key>
```

### Create your first user

```bash
node scripts/add-user.js \
  --id tanish \
  --name "Tanish" \
  --email "you@example.com" \
  --password "your-password"
```

This creates:
- An entry in `data/users.json`
- An empty `data/tanish/coach/` directory

### Migrate existing data (if upgrading from single-user)

If you had a flat layout at `../` (one level above `dashboard/`), move your files into the new per-user structure:

```bash
mkdir -p data/tanish/coach
cp ../training_log.csv data/tanish/training_log.csv
cp ../coach/session-notes.md data/tanish/coach/session-notes.md
# copy any plan files:
cp ../coach/plan-*.md data/tanish/coach/
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login`, then to `/onboarding` on first login to set up your athlete profile and goals.

---

## Data Layout

```
data/
  users.json                    # user accounts (hashed passwords)
  {userId}/
    training_log.csv            # workout history
    profile.json                # display name, athlete profile, goals
    coach/
      session-notes.md          # coach's running notes
      plan-YYYY-MM-DD.md        # training plan files
```

### `training_log.csv` schema

| Column | Description |
|---|---|
| `date` | ISO date `YYYY-MM-DD` |
| `activity` | Exercise name (e.g. `Bench Press`) |
| `sets` | Number of sets |
| `reps` | Reps per set (or total) |
| `weight_kg` | Load in kg |
| `rpe` | Rate of perceived exertion (1–10) |
| `duration_min` | Duration in minutes (cardio / accessory) |
| `notes` | Free-text notes |

---

## Docker (Raspberry Pi / self-hosting)

### Build & run

```bash
docker compose up -d --build
```

### Environment variables

Create a `.env` file next to `docker-compose.yml`:

```
NEXTAUTH_SECRET=<your secret>
NEXTAUTH_URL=https://yourdomain.com
PERPLEXITY_API_KEY=<your key>
PERPLEXITY_MODEL=sonar-pro
```

Data is persisted in `./data` on the host and mounted at `/data` inside the container.

### Adding users on the Pi

```bash
docker compose exec app node /app/scripts/add-user.js \
  --id alice \
  --name "Alice" \
  --email "alice@example.com" \
  --password "secret"
```

Or run the script directly on the host (Node must be installed):

```bash
DATA_DIR=./data node scripts/add-user.js --id alice --name "Alice" --email "alice@example.com" --password "secret"
```

---

## Cloudflare Tunnel (Pi behind NAT)

Cloudflare Tunnel lets your Pi serve traffic on a public domain without opening router ports.

1. Install `cloudflared` on the Pi:
   ```bash
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared
   chmod +x /usr/local/bin/cloudflared
   ```

2. Authenticate and create a tunnel:
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create fitness
   ```

3. Create `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: <tunnel-id>
   credentials-file: /home/pi/.cloudflared/<tunnel-id>.json
   ingress:
     - hostname: yourdomain.com
       service: http://localhost:3000
     - service: http_status:404
   ```

4. Route DNS and run:
   ```bash
   cloudflared tunnel route dns fitness yourdomain.com
   cloudflared tunnel run fitness
   ```

5. (Optional) Run as a systemd service:
   ```bash
   cloudflared service install
   sudo systemctl enable cloudflared
   sudo systemctl start cloudflared
   ```

Don't forget to set `NEXTAUTH_URL=https://yourdomain.com` in your `.env`.

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_SECRET` | Yes | Random 32-byte secret for JWT signing. Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | Full public URL of the app (`http://localhost:3000` locally, `https://yourdomain.com` in prod) |
| `PERPLEXITY_API_KEY` | Yes | API key from perplexity.ai |
| `PERPLEXITY_MODEL` | No | Model name (default: `sonar-pro`) |
| `DATA_DIR` | No | Absolute path to data directory (default: `../data` relative to `dashboard/`) |

---

## Tech Stack

- **Next.js 15** (App Router, TypeScript)
- **NextAuth.js v4** — credentials-based auth, JWT sessions
- **bcryptjs** — password hashing
- **Tailwind CSS** — styling
- **Recharts** — trend charts
- **Perplexity AI** — coach inference via `/v1/responses` Agent API
- **PapaParse** — CSV parsing
