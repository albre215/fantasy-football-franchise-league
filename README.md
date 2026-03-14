# Fantasy Franchise League

Fantasy Franchise League is a production-oriented web application foundation for running long-term fantasy leagues where each owner controls three real NFL franchises per season.

## Stack

- Next.js 14 App Router
- React + TypeScript
- Tailwind CSS
- ShadCN-style UI primitives
- Next.js API routes
- Prisma ORM
- PostgreSQL

## Project Structure

```text
app/
  api/
    health/
  dashboard/
  league/
components/
  dashboard/
  league/
  ui/
lib/
prisma.ts
utils/
server/
  integrations/
  jobs/
  services/
types/
prisma/
  schema.prisma
```

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and update values as needed:

   ```bash
   cp .env.example .env
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:3000`.

## Notes

- The Prisma schema is prepared for PostgreSQL, but no database setup or migrations are required yet.
- Ownership constraints such as "exactly three NFL teams per owner per season" should be enforced in the application layer during future business logic implementation.
