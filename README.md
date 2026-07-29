# Summit Sage 🏔️

A premium trekking & adventure community website for **Summit Sage** — a high-end Himalayan trekking brand based in Kolkata, India.

Built as a fast, static-first site (no WordPress) with a small serverless backend for forms, email and a database — the same stack used for deployment on **Vercel**.

> **Trek. Ascend. Belong.**

---

## ✨ Features

- **12 fully-designed pages** — Home, Upcoming Treks, Trek Detail, Gallery, About, Community, Journal (blog), Testimonials, Contact, Trekker Dashboard, Corporate Treks and a "Find Your Trek" quiz.
- **Premium visual effects** — interactive particle starfield, cursor glow, 3D tilt cards, parallax, animated counters, scroll reveals and a snow/fog section. All respect `prefers-reduced-motion`.
- **Rich trek experience** — live countdown timers, seat meters, wishlist, smart search ("winter under 8000"), filtering, sorting, side-by-side **compare**, and a calendar view.
- **Feature-packed trek detail** — tabbed overview/itinerary/route/safety/reviews, an SVG **altitude profile**, an embedded **route map**, an auto-generated **packing list**, a weather outlook and a registration form with a scratch-card reward.
- **Gamified community** — loyalty tiers (Bronze → Summit), points, badges and a leaderboard, plus a demo **dashboard** persisted in `localStorage`.
- **Rule-based trek assistant** chatbot, **EN / বাংলা** language toggle, and a WhatsApp-first contact flow.
- **Working forms** — contact, registration, corporate, community, ambassador, review and newsletter — each emails your team (Gmail) and stores a record in the database.

---

## 🧱 Tech stack

| Layer | Choice |
| --- | --- |
| Front-end | Static HTML + a shared CSS design system + vanilla JS (no framework) |
| Fonts | Bricolage Grotesque (display) + Manrope (body) |
| Local dev server | Express (`server.js`) |
| Serverless API | Vercel functions in `/api` |
| Database | Turso / libSQL (`@libsql/client`), with a local SQLite fallback |
| Email | Nodemailer over Gmail SMTP |

---

## 🚀 Getting started (local)

**Prerequisites:** Node.js 18+ (tested on v24).

```powershell
# 1. Install dependencies
npm install

# 2. Copy the example env file and edit as needed
Copy-Item .env.example .env

# 3. Start the local dev server
npm run dev
```

Then open <http://localhost:3000>.

- The site is served from `/public`.
- Form submissions are saved to a local SQLite file at `data/local.db` (created automatically, git-ignored).
- Email sending is **skipped** locally unless you set `GMAIL_APP_PASSWORD` — submissions still save to the DB, so you can develop without email configured.

Health check: <http://localhost:3000/api/health>

---

## 🔐 Environment variables

Copy `.env.example` → `.env` and fill in what you need.

| Variable | Purpose | Local |
| --- | --- | --- |
| `PORT` | Local dev port | `3000` |
| `TURSO_DATABASE_URL` | Turso libSQL URL | leave blank → uses `file:data/local.db` |
| `TURSO_AUTH_TOKEN` | Turso auth token | leave blank locally |
| `GMAIL_USER` | Gmail address that sends notifications | `soumikmondal723@gmail.com` |
| `GMAIL_APP_PASSWORD` | Gmail **App Password** (not your login password) | leave blank locally |
| `NOTIFY_EMAIL` | Comma-separated recipients | `soumikmondal723@gmail.com, rupak9609@gmail.com` |
| `ADMIN_API_KEY` | Protects `GET /api/submissions` | any string |

### Getting a Gmail App Password
1. Enable **2-Step Verification** on the Google account.
2. Go to **Google Account → Security → App passwords**.
3. Generate a password for "Mail" and paste the 16-character value into `GMAIL_APP_PASSWORD`.

---

## ☁️ Deploying to Vercel

1. Push this folder to a Git repo (GitHub/GitLab/Bitbucket).
2. Import the repo in **Vercel**. It auto-detects the config in `vercel.json` (static `/public` + `/api` functions).
3. In **Project → Settings → Environment Variables**, add:
   - `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
   - `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `NOTIFY_EMAIL`
   - `ADMIN_API_KEY`
4. **Deploy.** `server.js` is only for local dev (it's in `.vercelignore`); Vercel runs the `/api` functions directly.

### Setting up Turso (production database)
```powershell
# Install the Turso CLI, then:
turso db create summit-sage
turso db show summit-sage --url        # -> TURSO_DATABASE_URL
turso db tokens create summit-sage     # -> TURSO_AUTH_TOKEN
```
Tables are created automatically on first write.

---

## 🗂️ Project structure

```
SummitSage/
├── api/                 # Vercel serverless functions
│   ├── contact.js       # all typed forms (contact/registration/corporate/…)
│   ├── subscribe.js     # newsletter signups
│   ├── submissions.js   # admin: list submissions (x-api-key protected)
│   └── health.js
├── lib/
│   ├── db.js            # libSQL client + schema + save/list helpers
│   └── email.js         # Nodemailer Gmail transporter + branded template
├── public/
│   ├── css/styles.css   # the full design system + effects
│   ├── js/
│   │   ├── layout.js        # shared navbar/footer/floats/modals (loads first)
│   │   ├── effects.js       # particles, tilt, parallax, counters, reveal, snow
│   │   ├── main.js          # config (SUMMIT), nav, i18n, chatbot, WhatsApp
│   │   ├── treks-data.js    # the 9 treks (edit here)
│   │   ├── content-data.js  # testimonials, blog, founders, gallery, etc.
│   │   ├── treks.js         # cards, filters, compare, countdowns, wishlist
│   │   ├── render.js        # fills [data-render] sections from data
│   │   ├── forms.js         # form validation + submission
│   │   ├── trek-detail.js   # the trek detail page
│   │   ├── quiz.js          # the matcher quiz
│   │   └── dashboard.js     # the loyalty dashboard
│   └── *.html           # the 12 pages
├── server.js            # local Express dev server
├── vercel.json          # Vercel config + security headers/CSP
└── .env.example
```

---

## ✏️ Customising the site

Almost everything is data-driven and easy to edit:

- **Treks** — edit `public/js/treks-data.js` (name, price, dates, itinerary, altitude, coords, images…). Cards, the treks page, countdowns and the trek-detail page all update automatically.
- **Testimonials, blog, founders, gallery, partners, leaderboard, badges** — edit `public/js/content-data.js`.
- **Brand config** (WhatsApp number, email, Instagram, city) — edit the `SUMMIT` object at the top of `public/js/main.js`.
- **Notification recipients** — set `NOTIFY_EMAIL` (defaults to both team emails).
- **Colours & fonts** — the `:root` variables at the top of `public/css/styles.css`.
- **Logo** — the inline SVG `MARK` in `public/js/layout.js` (and the favicon data-URI in each page `<head>`).
- **Images** — currently Unsplash URLs; swap for your own trek photos anytime.

---

## 🔒 Security notes

- All forms include a honeypot field and server-side validation.
- Admin submissions endpoint is protected by `ADMIN_API_KEY` via the `x-api-key` header.
- A strict Content-Security-Policy and other security headers are set in `vercel.json`.
- Secrets live only in environment variables — never commit your `.env`.

---

_Made with ❤️ in Kolkata. Trek safe._
