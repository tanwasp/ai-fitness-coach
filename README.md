# AI Fitness Coach

Your personal AI-powered training dashboard. Chat with a coach that knows your full workout history, log sessions in plain English, track progress over time, and keep your training plan updated automatically.

---

## Getting started

### 1. Get a Perplexity API key

Go to [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api) and create a key. This powers the AI coach.

### 2. Set up your environment

```bash
cp .env.local.example .local/.env.local
```

Open `.local/.env.local` and fill in:

```
NEXTAUTH_SECRET=        # run: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
PERPLEXITY_API_KEY=     # your key from step 1
```

### 3. Create your account

```bash
node scripts/add-user.js
```

You'll be prompted for a username and password. This creates a local account — no email needed.

### 4. Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in, and you're ready to go.

---

## How to use it

### Chat with your coach

Go to the **Chat** tab and talk like you would to a real coach:

> "I did bench press 3x8 at 185lbs, felt strong today"
> "My shoulder is a bit sore, scale back pressing this week"
> "What should I focus on tomorrow?"

The coach remembers your history, goals, and past notes — and will update your plan if needed.

### Log a workout

Click **Log Workout** and describe what you did in plain English. The app will parse it and save it to your training log automatically.

### View your plan

The **Plan** tab shows your current two-week training plan. The coach can update it based on your progress and how you're feeling.

### Track your progress

The **Trends** tab shows charts for each exercise over time so you can see how you're improving.

---

## Adding another user

Each person gets their own private data. To add someone:

```bash
node scripts/add-user.js
```

Run this for each new user. Their workouts, plans, and notes are completely separate.

---

## Self-hosting on a Raspberry Pi

### 1. Build and start

```bash
docker compose up -d --build
```

### 2. Create your account on the Pi

```bash
docker compose exec app node /app/scripts/add-user.js
```

### 3. Update the app

```bash
git pull
docker compose up -d --build
```

### 4. Access it from anywhere (Cloudflare Tunnel)

1. Install `cloudflared` on the Pi
2. Run `cloudflared tunnel login` and follow the browser prompt
3. Create a tunnel:
   ```bash
   cloudflared tunnel create ai-fitness-coach
   ```
4. Create `/etc/cloudflared/config.yml`:
   ```yaml
   tunnel: <your-tunnel-uuid>
   credentials-file: /etc/cloudflared/<your-tunnel-uuid>.json
   ingress:
     - hostname: fit.yourdomain.com
       service: http://localhost:3000
     - service: http_status:404
   ```
5. Add the DNS record:
   ```bash
   cloudflared tunnel route dns ai-fitness-coach fit.yourdomain.com
   ```
6. Install and start the service:
   ```bash
   sudo cloudflared service install
   sudo systemctl start cloudflared
   ```
7. Update `NEXTAUTH_URL` in your `.env` to `https://fit.yourdomain.com`, then restart:
   ```bash
   docker compose up -d
   ```

---

## Tech stack

- [Next.js 15](https://nextjs.org/) — frontend + API
- [NextAuth.js](https://next-auth.js.org/) — authentication
- [Perplexity AI](https://www.perplexity.ai/) — AI coach
- [Docker](https://www.docker.com/) — self-hosting
