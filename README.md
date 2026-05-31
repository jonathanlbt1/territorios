# Territorios

Territory management platform for congregation workflows, built with React + Vite on the frontend and Node.js + Express + PostgreSQL on the backend.

## Overview

The application supports:
- Territory registration and map management
- Assignment lifecycle (pending, in progress, returned, completed)
- Admin and dirigente roles
- Dashboards and reports (including S-13 PDF)
- Push notifications
- PWA client behavior

## Tech Stack

### Client
- React 18
- Vite 5
- Tailwind CSS
- React Router
- Axios
- jsPDF + jspdf-autotable
- Vitest + Testing Library

### Server
- Node.js (ESM)
- Express
- PostgreSQL (`pg`)
- JWT auth (`jsonwebtoken`)
- Password hashing (`bcryptjs`)
- Jest + Supertest
- Web Push (`web-push`)

## Repository Structure

```text
.
├── client/                 # React app (Vite)
├── server/                 # Express API
├── docker-compose.yaml     # Full stack local containers
├── GUIA_CONSTRUCAO.md      # Long-form build guide
└── formulario.html         # Static S-13 helper/form file
```

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 14+ (or compatible)
- Docker + Docker Compose (optional, for containerized run)

## Environment Variables

### Server

The server reads env vars from process environment (`dotenv` is enabled).

Required in most setups:
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

Optional:
- `PORT` (default: `3001`)
- `DATABASE_URL` (if set, used instead of discrete DB vars)
- `DB_SSL=true` (or `PGSSLMODE=require` / `SSLMODE=require`)
- `VAPID_SUBJECT`
- `DEFAULT_RESET_PASSWORD`

### Client

Optional:
- `VITE_API_BASE_URL`

Behavior:
- If `VITE_API_BASE_URL` is set, client uses it.
- Otherwise client uses `/api` and relies on Vite proxy (dev) or Nginx proxy (Docker).

## Local Development (without Docker)

## 1) Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

## 2) Start PostgreSQL

Make sure your database is running and accessible using server env vars.

## 3) Run migrations

```bash
cd server
npm run migrate
```

## 4) Start backend

```bash
cd server
npm run dev
```

Server runs at:
- `http://localhost:3001`
- Health check: `http://localhost:3001/health`

## 5) Start frontend

```bash
cd client
npm run dev
```

Client runs at:
- `http://localhost:5173`

In development, Vite proxies:
- `/api` -> `http://localhost:3001`
- `/maps` -> `http://localhost:3001`

## Docker Compose Run

Start full stack:

```bash
docker compose up --build
```

Services:
- Client: `http://localhost` (port 80)
- Server: `http://localhost:3001`

Stop:

```bash
docker compose down
```

Notes:
- Current compose file uses `host.docker.internal` for database host.
- On some Linux setups, you may need to replace it with your host IP or an internal DB container.
- The compose file currently includes real-looking secrets; rotate them for production.

## Test Commands

### Client tests

```bash
cd client
npm test
npm run test:watch
```

### Server tests

```bash
cd server
npm test
npm run test:watch
npm run test:coverage
```

## Build Commands

### Client

```bash
cd client
npm run build
npm run preview
```

### Server

```bash
cd server
npm start
```

## Available Scripts

### client/package.json
- `dev` - start Vite dev server
- `build` - production build
- `preview` - preview built app
- `test` - run tests once
- `test:watch` - watch mode tests

### server/package.json
- `start` - run API with Node
- `dev` - run API with nodemon
- `migrate` - run DB migration script
- `seed` - references `src/db/seed.js` (currently missing in repository)
- `generate-vapid` - generate push VAPID keys
- `test` - run Jest suite
- `test:watch` - run Jest in watch mode
- `test:coverage` - run Jest with coverage

## API Base Paths

- `/api/auth`
- `/api/users`
- `/api/territories`
- `/api/assignments`
- `/api/reports`
- `/api/maps`
- `/api/push`

## Troubleshooting

- 401 loop on client:
  - Token may be invalid/expired. The client auto-clears auth data and redirects to login on HTTP 401.

- Date shift issues:
  - The server customizes PostgreSQL DATE parsing to reduce timezone drift for date-only fields.

- Docker server health check mismatch:
  - Server Docker image sets `PORT=8080`, while compose overrides to `3001`.
  - If health checks fail unexpectedly, verify effective `PORT` and check logs.

## Additional Documentation

- See `GUIA_CONSTRUCAO.md` for a full implementation walkthrough.

## Contributing

**Se desejar ajudar com o desenvolvimento deste projeto, sinta-se a vontade para me contatar**
