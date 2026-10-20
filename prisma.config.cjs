// Auth generates its own Prisma client. Web API alone owns database migrations.
// Catch accidental CLI writes here, including the old "pnpm exec prisma migrate".
const args = process.argv.slice(2);
const dbIndex = args.indexOf('db');
if (args.includes('migrate') ||
    (dbIndex !== -1 && ['push', 'execute'].includes(args[dbIndex + 1]))) {
  throw new Error(
    'APARTHA_MIGRATIONS_WEBAPI_ONLY: las migraciones se administran desde api-web/web-api. ' +
    'Ejecuta alli pnpm run db:check y consulta docs/DATABASE_MIGRATIONS.md. ' +
    'En Auth usa prisma generate; no restaures prisma/migrations.',
  );
}

const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const { defineConfig } = require('prisma/config');
module.exports = defineConfig({ schema: 'prisma/schema.prisma' });
