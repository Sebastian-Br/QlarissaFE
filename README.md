# Qlarissa Frontend

The Qlarissa frontend is a React and TypeScript application built with the Next.js App Router. Interactive screens remain client-rendered so browser-local JWT authentication, SignalR live prices, chart controls, and watchlist behavior continue to work as before.

## Requirements

- Node.js 20.9 or later
- npm

## Configuration

Set `NEXT_PUBLIC_API_BASE_URL` in `.env` to the backend base URL. This public environment variable is embedded in the browser bundle by Next.js and must contain only the API base URL, never a secret.

## Development

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The backend development CORS allowlist permits this exact origin by default. For a different frontend origin, set the backend configuration key `Cors__AllowedOrigins__0` to that exact origin (for example, `https://app.example.com`). Do not use wildcard origins.

## Production

```sh
npm run lint
npm run build
npm start
```

`npm start` runs the standard Next.js Node.js server and serves the production build.

## Routes

- `/` and `/login` — sign in
- `/register` — account registration
- `/dashboard` — dashboard and security search
- `/security/[id]` — security details, charts, live prices, and watchlists
