# NRORA — Production Starter

Domain: https://nrroadcare.in
Phone: 9160264439
Membership: ₹4,500/year

## Structure
- frontend: React + Vite
- backend: Node.js + Express + PostgreSQL
- database: PostgreSQL schema

### CEO authority
CEO controls Admin, Division Manager, Area Manager, TL, Staff, Telecaller and Mechanic roles.
CEO modules use the same authenticated operations session; no second Admin login is required.

## Local run
### Database
Create a PostgreSQL database named `nrroadcare`, then run:
psql "$DATABASE_URL" -f database/schema.sql

### Backend
cd backend
copy .env.example to .env
npm install
npm start

### Frontend
cd frontend
copy .env.example to .env
npm install
npm run dev

## Production
Set frontend VITE_API_URL to the HTTPS API URL.
Set backend DATABASE_URL and FRONTEND_ORIGIN.
Do not commit .env files or API keys.
