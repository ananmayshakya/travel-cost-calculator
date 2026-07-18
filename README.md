# Travel Cost Calculator

**Live demo:** [travel-cost-calculator-rust.vercel.app](https://travel-cost-calculator-rust.vercel.app)

> The backend runs on Render's free tier, which sleeps after ~15 minutes of inactivity. If the demo has been idle, the first request can take 30–50 seconds to wake it up — that's a cold start, not a bug. Subsequent requests are fast.

Estimate the real fuel cost of a road trip in India — type a distance, or search a start and end point on a map and let the app work out the driving distance for you.

Most mileage calculators just multiply the sticker ARAI figure by distance and call it a day. This one doesn't: ARAI numbers are lab-tested and consistently optimistic, and since India's petrol supply moved to E20 (20% ethanol blend), petrol mileage has taken an extra hit that depends on how old the car is. This app shows both the ARAI figure and a real-world estimate, and lets you adjust either.

## Features

- **Two ways to enter distance** — type it directly, or search a "from" and "to" location on a map and get the actual driving distance (OpenStreetMap + OSRM routing, drawn on a Leaflet map).
- **Vehicle picker** — brand → model → variant, with mileage and fuel type filled in automatically from a curated dataset. Don't see your car? Enter its mileage manually instead.
- **Honest mileage math** — shows the ARAI-rated mileage next to an estimated real-world figure (adjustable haircut, since ARAI numbers run high), and factors in E20 ethanol losses for petrol vehicles based on age/compatibility. Diesel and CNG aren't affected by E20.
- **Per-city fuel pricing** — petrol, diesel, and CNG prices vary by city (state taxes) and are cached for the day rather than re-fetched on every request.
- **Full cost breakdown** — fuel needed, total trip cost, and cost per km.

## Stack

- **Frontend:** React + TypeScript + Vite, Leaflet for the map
- **Backend:** Node + Express + TypeScript
- **Database:** Postgres (built and tested against [Neon](https://neon.tech)), raw `pg` queries — no ORM
- **Mapping:** Nominatim for geocoding, OSRM for routing — both free, no API key required

## Screenshots

_(placeholder — add screenshots of manual mode, map mode, and the result breakdown)_

## Running it locally

You'll need Node 20+ and a Postgres database (a free [Neon](https://neon.tech) instance works well).

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL
npm run seed            # loads vehicle and city data into the database
npm run dev              # http://localhost:4000
```

Backend environment variables (`backend/.env`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `PORT` | defaults to 4000 |
| `FRONTEND_ORIGIN` | CORS origin allowed to call the API (the Vite dev server by default) |
| `FUEL_SOURCE` | `mock` (default, plausible fake prices — no live provider is wired up yet) or `live` |
| `FUEL_PRICE_API_KEY` | only needed if `FUEL_SOURCE=live` |

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # points at the backend, defaults to http://localhost:4000
npm run dev              # http://localhost:5173
```

### Tests / lint

```bash
npm test     # backend only — trip math, ethanol adjustment, fuel price caching
npm run lint
npm run build
```

## Deployment

The live demo runs on:

- **Frontend:** [Vercel](https://vercel.com) — root directory `frontend`, framework preset Vite
- **Backend:** [Render](https://render.com) — root directory `backend`, `npm install --include=dev && npm run build` / `npm start`, health check on `/health`
- **Database:** [Neon](https://neon.tech)

Deploy order matters, since each side needs the other's URL:

1. Deploy the backend first and note its URL.
2. Set the frontend's `VITE_API_URL` to that backend URL and deploy (Vite bakes env vars in at build time, so this has to be set before building).
3. Set the backend's `FRONTEND_ORIGIN` to the deployed frontend URL and redeploy, so CORS allows it.

Render's free tier spins the service down after ~15 minutes idle; the first request after that takes 30–50 seconds to wake it back up.

## A couple of notes on tradeoffs

- **Routing** uses OSRM's public demo server, which is fine for a project like this but rate-limited and not meant for real production traffic. Self-hosting OSRM (or switching to a paid routing provider) would be the next step if this needed to handle real load.
- **Fuel prices** are cached per city per day rather than fetched on every request — the price service checks whether today's row already exists before hitting the upstream source. `FUEL_SOURCE=mock` is the default for local development since no live pricing provider is configured out of the box.
- **Vehicle mileage data** is hand-compiled (ARAI publishes figures per model, not a queryable API), so coverage is necessarily a curated subset rather than every car on Indian roads. The "not in the database" option lets you enter a car's mileage manually so the calculator still works for anything missing.
