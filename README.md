# ArchanaStock

Inventory dan laporan penjualan untuk Archana Caps.

## Tech Stack

- Next.js
- React
- Supabase Auth
- Supabase PostgreSQL
- Tailwind CSS

## Environment Variables

Buat `.env.local` dari `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

## Database

Jalankan SQL migration di Supabase SQL Editor:

```text
supabase/schema.sql
```

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
