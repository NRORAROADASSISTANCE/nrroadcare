# NRORA — Production Starter

Domain: https://nrroadcare.in
Phone: 9160264439
Membership: ₹4,500/year

## Structure
- frontend: React + Vite
- backend: Node.js + Express + PostgreSQL
- database: PostgreSQL schema

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

## Remaining production integrations
- OTP/auth provider
- UPI payment gateway/QR
- PDF receipt generation
- live GPS/service request workflow
- notifications
- HTTPS/domain DNS
