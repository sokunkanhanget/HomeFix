# HomeFix

HomeFix is a JavaScript web application with a React and Tailwind CSS frontend, a Node.js/Express API, and PostgreSQL.

The project is organized into `frontend/` (React + Tailwind) and `backend/` (Node.js + Express + PostgreSQL).

## Project structure

```text
frontend/
  src/
    components/  Reusable React UI components
    App.jsx      Main page and API connection status
    main.jsx     React entry point
    style.css    Tailwind import and global styles
backend/
  src/
    config/      Database connection
    routes/      Express API routes
    index.js     API entry point
```

## Requirements

- Node.js 20.19+ or 22.12+
- npm 10+
- Docker Desktop (for the included PostgreSQL container), or a local PostgreSQL 16+ instance

## Getting started

1. Install dependencies from the repository root:

   ```sh
   npm install
   ```

2. Create the backend environment file:

   ```powershell
   Copy-Item backend\.env.example backend\.env
   ```

   Adjust `DATABASE_URL` in `backend/.env` if your PostgreSQL credentials differ from the defaults.

3. Start PostgreSQL:

   ```sh
   docker compose up -d db
   ```

4. Start the frontend and API in development mode:

   ```sh
   npm run dev
   ```

   Open the Vite URL printed in the terminal (normally `http://localhost:5173`). The API is available at `http://localhost:3001/api/health`; Vite proxies `/api` requests to it.

## Scripts

- `npm run dev` — run the frontend and API together
- `npm run dev:frontend` — run only the Vite frontend
- `npm run dev:backend` — run only the Express API
- `npm run build` — build the frontend for production
- `npm start` — start the API

The API reads `PORT` and `DATABASE_URL` from `backend/.env`. The health endpoint checks both API and PostgreSQL connectivity and returns an error status if the database is unavailable.
