/**
 * Environment — desenvolvimento local.
 *
 * Em produção (Cloudflare Pages), este arquivo é substituído por
 * environment.prod.ts via fileReplacements no angular.json.
 * O environment.prod.ts é gerado em build time por scripts/inject-env.mjs
 * a partir das env vars NG_APP_*.
 *
 * Valores locais sincronizados com api-collection/environments/local.bru
 * (Supabase CLI demo keys + backend docker-compose em :8080).
 */
export const environment = {
  production: false,
  supabaseUrl: 'http://localhost:54321',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  apiUrl: 'http://localhost:8080',
} as const;
