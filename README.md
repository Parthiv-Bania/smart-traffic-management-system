# Smart Traffic Management System (STMS)

## 🚀 Live Demo
Experience the live operational dashboard here: [Parthiv's Smart Traffic Management System](https://smart-traffic-management-system-jiwl.onrender.com)

A web control room for monitoring traffic at several intersections. Operators watch signal timing and queues, log accidents, road closures and maintenance, and follow emergency vehicles on a live map. Analysts compare fixed-time and adaptive signal control on identical simulated traffic.

The signal simulation is a deterministic model for demonstration and training. The app does not connect to real traffic signals, cameras or sensors.

## Features

- **Dashboard:** summary of intersections, signals and incidents.
- **Intersections:** register intersections and their four approaches, set timing, and view live signal state.
- **Live simulation:** run fixed-time or adaptive control, request emergency green-wave priority, and save completed runs.
- **Traffic map:** live intersections, active incidents and emergency requests, with toggles to show or hide each layer.
- **Incidents:** log accidents, road closures and maintenance; track open, in-progress and resolved status.
- **Analytics:** fixed-time vs adaptive comparison with CSV and PDF export.
- **Users and audit log:** manage roles and review changes (super administrators only).
- **System settings:** organization name and how long emergency requests stay on the map (super administrators only).

## Roles

| Role | Access |
| --- | --- |
| Super administrator | Everything, including users, settings and deleting incidents |
| Traffic control operator | Simulation, map, incidents |
| Traffic analyst | Simulation, analytics, saved runs, map, incidents view |
| General viewer | Read-only dashboards and intersection information |

The first account created becomes the super administrator. Later accounts start as viewers until a super administrator changes their role.

## Tech stack

- React 18, TypeScript, Vite
- Tailwind CSS, Recharts, Leaflet (OpenStreetMap tiles)
- Supabase: Postgres database, email/password sign-in, row level security, realtime updates

## Running locally

Requirements: Node.js 20.19 or newer (22 recommended) and npm.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root using `.env.example` as the template, and fill in:

   - `VITE_SUPABASE_URL`: the Project URL from your Supabase project settings (API section).
   - `VITE_SUPABASE_ANON_KEY`: the anon public key from the same page.

3. Start the development server:

   ```bash
   npm run dev
   ```

   Open the address shown in the terminal and create the first account.

## Setting up the database

The schema lives in `supabase/migrations/`. Apply the files in filename order (oldest first) to a new Supabase project, either with the Supabase CLI (`supabase db push`) or by pasting each file into the SQL editor. The migrations create the tables, row level security policies, the realtime publication, and seed the three sample intersections with their four approaches each.

The app talks to Supabase with the anon key only. The database connection string (the Postgres URL) is not needed by the frontend and should not be added to the browser build or committed to GitHub. Keep it only in your own tooling.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create the production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Check TypeScript types |
| `npm run lint` | Run the linter |
| `npm test` | Run the simulation engine unit tests |

## Deploying to Render

The repository includes `render.yaml`, which defines a static site. It builds with `npm ci && npm run build`, publishes `dist/`, and rewrites every path to `index.html` so direct links and page refreshes work.

1. Push the project to GitHub.
2. In Render, choose **New > Blueprint** and select the repository.
3. When prompted, enter `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy, then open the Render URL and create the first account.

## Simulation notes

- Fixed-time mode uses each intersection's fixed green duration.
- Adaptive mode sets green time from weighted demand (approaching vehicles, queue and waiting time), within the minimum and maximum green limits.
- If a detector in a phase group is offline, adaptive mode falls back to fixed timing and logs the reason.
- Emergency priority ends the current green through yellow and all-red, then holds the requested approach's green for up to 12 seconds.
- Fixed and adaptive comparisons use the same random seed, so differences come from signal control alone.

## Project layout

```
src/
  components/   reusable UI, map, incident and simulation components
  contexts/     sign-in state
  hooks/        data loading and realtime subscriptions
  lib/          permissions, data access and the traffic engine (lib/traffic)
  pages/        one component per screen
supabase/
  migrations/   database schema, policies and seed data
```

## Limitations

- Simulated data only. Nothing is read from real sensors, cameras or signal controllers.
- Map tiles come from the public OpenStreetMap server, which limits heavy use. A commercial tile provider is recommended for production traffic.
