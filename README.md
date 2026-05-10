# Millennium Project — Equity Order Ticket System

Next.js app with **PostgreSQL**, **NextAuth.js**, and **role-specific desks** (Equity Trader, Risk Officer, Prime Broker) backed by a shared order model.

---

## Prerequisites (install on a clean machine)

You need these installed once on your computer:

| Tool | Purpose | How to get it |
|------|---------|----------------|
| **Git** | Clone this repository | [git-scm.com](https://git-scm.com/downloads) |
| **Node.js** | JavaScript runtime (includes **npm**) | [nodejs.org](https://nodejs.org) — use the **LTS** version (v20 or newer recommended) |
| **PostgreSQL** | Database | [postgresql.org/download](https://www.postgresql.org/download/) — install the server (not only a client) |

**Quick platform hints**

- **macOS (Homebrew):** `brew install node postgresql@16` then `brew services start postgresql@16`
- **Windows:** Install Node from nodejs.org and PostgreSQL from EnterpriseDB installer; add both to `PATH` if the installer asks.
- **Linux (Debian/Ubuntu-style):** `sudo apt update && sudo apt install -y git nodejs npm postgresql postgresql-contrib`

Verify in a terminal:

```bash
git --version
node --version    # should be v20+
npm --version
psql --version    # after PostgreSQL install
```

---

## 1. Clone the repository

```bash
git clone <your-repo-url>
cd millenium-project
```

---

## 2. Install Node dependencies

From the project root:

```bash
npm install --legacy-peer-deps
```

Use `--legacy-peer-deps` if npm reports peer dependency conflicts (common with this repo’s ESLint stack).

---

## 3. PostgreSQL: create a database

Sign in as a superuser (often `postgres`) and create an empty database for the app:

```bash
# Example: using psql (password prompt depends on your OS setup)
psql -U postgres -h localhost -c "CREATE DATABASE millennium;"
```

If `CREATE DATABASE` fails because the DB already exists, you can reuse it or pick another name and put that name in `DATABASE_URL` below.

Create a dedicated role/password if you prefer (optional):

```sql
CREATE USER millennium WITH PASSWORD 'choose-a-strong-password';
GRANT ALL PRIVILEGES ON DATABASE millennium TO millennium;
```

---

## 4. Environment variables (`.env`)

This app reads configuration from a **`.env`** file in the project root. It is **not** committed to git; you create it locally.

1. Copy the template:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with a text editor. Set at least:

### `DATABASE_URL`

PostgreSQL connection string:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE_NAME"
```

Examples:

- Local default user on default port:

  `postgresql://postgres:YOUR_PASSWORD@localhost:5432/millennium`

- If your OS uses peer auth on Unix sockets only, you may need to set host user/password in `pg_hba.conf` or use `localhost` with a password as above.

Replace `YOUR_PASSWORD`, user name, host, port, and database name to match your install.

### `AUTH_SECRET`

Secret used by NextAuth to sign sessions. **Required.**

Generate one:

```bash
openssl rand -base64 32
```

Paste the output into `.env`:

```env
AUTH_SECRET="paste-the-long-string-here"
```

On Windows without OpenSSL, use PowerShell:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### `NEXTAUTH_URL`

The full URL where the app is reachable (no trailing slash). For local development:

```env
NEXTAUTH_URL="http://localhost:3000"
```

If you run on another port (e.g. `3001`), set it to `http://localhost:3001`.

---

## 5. Apply database schema and seed data

Ensure `.env` exists and `DATABASE_URL` is correct, then:

```bash
npx prisma generate
npx prisma migrate deploy
npm run db:seed
```

- **`migrate deploy`** applies existing migrations (safe for a fresh clone).  
- **`npm run db:migrate`** runs `prisma migrate dev` (better when **creating** new migrations during development).

Seed creates demo users and sample orders (password for all seeded accounts: **`password123`**):

| Role | Email |
|------|--------|
| Equity Trader | `trader@test.com` |
| Risk Officer | `risk@test.com` |
| Prime Broker | `broker@test.com` |

You can also **register** at `/register` and choose a desk role without an invite.

---

## 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign-in page: **`/signIn`**. Create account: **`/register`**.

---

## Useful commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run production server (after `build`) |
| `npm run lint` | ESLint |
| `npm run db:seed` | Re-run seed (clears seeded orders and upserts demo users) |
| `npm run db:view` | Prisma Studio (browse DB in the browser) |

---

## Troubleshooting

- **`npm install` fails on peer dependencies** — run `npm install --legacy-peer-deps`.
- **Prisma cannot connect** — Check PostgreSQL is running (`brew services list`, Windows Services, or `sudo systemctl status postgresql`). Verify `DATABASE_URL` user, password, host, and database name.
- **Port 3000 in use** — Stop the other process or run `next dev -p 3001` and set `NEXTAUTH_URL` to match.
- **Auth errors after login** — Confirm `AUTH_SECRET` and `NEXTAUTH_URL` are set and match the URL you use in the browser.

---

## Project overview

- **Roles:** Equity Trader (`/trader`), Risk Officer (`/risk`), Prime Broker (`/broker`); hub at `/platform`.
- **Auth:** NextAuth credentials; JWT sessions. See `AUTH_SETUP.md` for architecture notes (some sections refer to older invite-only flow; open registration is available at `/register`).
- **APIs:** Orders, exposure snapshot, risk breach log — see `src/app/api/`.

---

## Validate locally

```bash
npm run lint
npm run build
```
