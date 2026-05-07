#!/usr/bin/env node
/**
 * inject-env.mjs — gera src/environments/environment.prod.ts a partir
 * das env vars NG_APP_* no momento do build.
 *
 * Roda no prebuild (Cloudflare Pages, CI, ou localmente para reproduzir prod).
 * Falha o build se alguma var obrigatória estiver faltando — preferimos
 * quebrar cedo a deployar com config quebrada.
 *
 * Uso:
 *   NG_APP_SUPABASE_URL=... NG_APP_SUPABASE_ANON_KEY=... NG_APP_API_URL=... \
 *     node scripts/inject-env.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '..', 'src', 'environments', 'environment.prod.ts');

const required = ['NG_APP_SUPABASE_URL', 'NG_APP_SUPABASE_ANON_KEY', 'NG_APP_API_URL'];
const missing = required.filter((k) => !process.env[k]);

if (missing.length > 0) {
  console.error(`[inject-env] FAIL — env vars ausentes: ${missing.join(', ')}`);
  console.error('[inject-env] Configure no dashboard Cloudflare Pages (Production + Preview)');
  console.error('[inject-env] ou exporte localmente antes de "npm run build:prod".');
  process.exit(1);
}

const escape = (v) => String(v).replace(/'/g, "\\'");

const content = `/**
 * Environment — produção.
 * GERADO AUTOMATICAMENTE por scripts/inject-env.mjs no prebuild.
 * NÃO EDITAR MANUALMENTE — sobrescrito a cada build.
 */
export const environment = {
  production: true,
  supabaseUrl: '${escape(process.env.NG_APP_SUPABASE_URL)}',
  supabaseAnonKey: '${escape(process.env.NG_APP_SUPABASE_ANON_KEY)}',
  apiUrl: '${escape(process.env.NG_APP_API_URL)}',
} as const;
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, content, 'utf8');
console.log(`[inject-env] OK — ${outPath}`);
