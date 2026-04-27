# Narralytica Web

Narralytica Web is the frontend for the Narralytica signal platform.

## What It Does

Turns backend-generated market signals into a live trading interface and a simple asset-specific signal endpoint.

## Why It's Different

Narralytica does not stop at showing charts or raw indicators. It translates a multi-factor backend engine into a usable frontend layer with current decisions, tactical quick-trade reads, relationship context, and a clean signal endpoint that can be consumed directly.

## What The User Gets

- a live asset decision view
- a current directional read
- conviction and sizing context
- quick-trade setup inputs for supported assets
- relationship and market context views
- a public asset-specific signal endpoint

## What It Is

This app turns backend-published signal data into a trading-oriented interface.

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

## Live Endpoint

Production signal endpoint example:

```bash
https://www.narralytica.xyz/api/signal-api?asset=BTC
```

## Data Flow

1. The backend generates decision signals and quick-trade payloads.
2. Those outputs are published into Supabase.
3. This website reads the latest state from Supabase.
4. The frontend renders decision views, relationship views, quick-trade panels, and the public signal endpoint.

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

## News Data

Website news is handled on the web side through its own API routes and SoSoValue-powered news reads.

The backend signal repo is not the active news pipeline for the current website experience.

## Notes

- `.next/` is generated build output
- `node_modules/` contains installed dependencies
- local log files can be deleted safely when not needed
