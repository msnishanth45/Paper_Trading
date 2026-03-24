# Paper Trading App — Deployment Guide

This project is fully prepared for a production deployment footprint with a **Node.js/Express backend on Render** and a **Next.js frontend on Vercel**.

---

## 🚀 Backend Deployment (Render)

The backend is pre-configured with `process.env.PORT` handling, a `start` script, CORS, and a `/health` endpoint.

### Prerequisites (Database)
1. You must have a **MySQL database** accessible over the public internet (e.g., PlanetScale, Aiven, AWS RDS, DigitalOcean).
2. Execute the `backend/db/schema.sql` script on your MySQL database to create the required tables.

### Steps on Render.com
1. Create a new **Web Service** on Render and connect your GitHub repository.
2. Set the `Root Directory` to `backend`.
3. Set the Environment to `Node`.
4. Define the Build Command: `npm install`
5. Define the Start Command: `npm start`
6. Expand **Advanced** and add the following Environment Variables:

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `PORT`     | `10000` | (Render will auto-assign, optional to set) |
| `MYSQL_HOST` | `aws.connect.psdb.cloud` | Your MySQL public hostname |
| `MYSQL_PORT` | `3306` | Default MySQL port |
| `MYSQL_USER` | `admin` | Your database user |
| `MYSQL_PASSWORD` | `supersecret` | Your database password |
| `MYSQL_DATABASE` | `paper_trading_db` | Your database name |
| `JWT_SECRET` | `generate_a_random_long_string_here` | Secret for signing tokens |
| `UPSTOX_CLIENT_ID` | `xyz` | Your Upstox API key (Alias) |
| `UPSTOX_CLIENT_SECRET` | `xyz` | Your Upstox API secret (Alias) |
| `UPSTOX_ACCESS_TOKEN` | `Bearer ...` | Valid token to auto-start the feed |

7. Click **Create Web Service**. Render will build and deploy the application.
8. Verify the deployment by visiting the generated render URL at `/health`.

---

## 🖥 Frontend Deployment (Vercel)

The Next.js App Router application is built for zero-config Vercel deployment.

### Steps on Vercel.com
1. Create a **New Project** and import your GitHub repository.
2. Set the `Framework Preset` to **Next.js**.
3. Set the `Root Directory` to `web`.
4. Expand **Environment Variables** and add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://your-backend-app.onrender.com/api` |
| `NEXT_PUBLIC_SOCKET_URL` | `https://your-backend-app.onrender.com` |

5. Click **Deploy**. Vercel will install dependencies, build the Next.js production bundle, and deploy the application.

---

## 🧪 Testing the Production Build

1. **Visit your Vercel URL:** `https://your-frontend-app.vercel.app`
2. **Register a User:** Create a new account (which generates a temporary wallet balance).
3. **Dashboard Load:** Verify pricing cards are updating automatically (Socket.IO feed).
4. **Place Order:** Execute a trade and verify PnL updates dynamically based on the market feed.
