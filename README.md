# Narralytica Web

Narralytica Web is the frontend for the Narralytica signal platform.

It presents:
- major asset decision signals
- quick trade reads for supported assets
- relationship and market context views
- a public signal endpoint for asset-specific JSON output

## What It Does

This app reads the latest published signal data from backend infrastructure and turns it into a clean trading interface.

The product is designed to:
- surface the current directional read for an asset
- show supporting signal structure in a readable way
- expose a simple machine-friendly signal endpoint

## Stack

- Next.js
- React
- TypeScript
- Supabase

## Local Development

Install dependencies and run the app:

```bash
npm install
npm run dev
```

For local preview, the app runs on the default Next.js development port.

## Live Endpoint

Production signal endpoint example:

```bash
https://www.narralytica.xyz/api/signal-api?asset=BTC
```

## Environment

This project expects local environment variables for its backend connection.

Create a local `.env` file with the required values for:
- Supabase URL
- Supabase anon key
- any other server-side values used by local API routes

Do not commit secrets.

## Main Areas

- `app/` - routes, pages, and API endpoints
- `components/` - UI modules
- `lib/` - data access, formatting, and shared helpers
- `styles/` - styling utilities

## Notes

- `.next/` is generated build output
- `node_modules/` contains installed dependencies
- local log files can be deleted safely when not needed
