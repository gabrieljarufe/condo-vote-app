# Changelog

## 1.0.0 (2026-05-17)


### Features

* **apartments:** pagina lista de apartamentos server-side ([1258694](https://github.com/gabrieljarufe/condo-vote-app/commit/1258694426120fadb4ae4855a4b2cb3fbe3b4a0f))
* **apartments:** paginação server-side da lista de apartamentos ([3f4a7fe](https://github.com/gabrieljarufe/condo-vote-app/commit/3f4a7feff4059f1c11b3f0d859782d4a6c33cf04))
* **frontend:** adiciona tenantGuard e specs para auth/tenant guards ([3351df4](https://github.com/gabrieljarufe/condo-vote-app/commit/3351df4d785711fe36773d816673d6067b168ff1))
* função pura generateApartments com suite de testes completa ([356b2fa](https://github.com/gabrieljarufe/condo-vote-app/commit/356b2fa9de008a9f7f0859e33dd84cfcc50acd9e))
* H2 cadastra apartamento e marca inadimplência ([94fa44b](https://github.com/gabrieljarufe/condo-vote-app/commit/94fa44b45bfabbc5668309f2490ad60a75dceee5))
* **h2:** adiciona ApartmentBulkPreviewGrid — Step 2 do wizard de cadastro em lote ([224667b](https://github.com/gabrieljarufe/condo-vote-app/commit/224667b3f13a7cc780f7f0c419407196c39fdd55))
* **h2:** adiciona ApartmentsBulkPage — wizard completo com Step 1 e Step 2 ([12a78b7](https://github.com/gabrieljarufe/condo-vote-app/commit/12a78b71cb0a144138b30431b3bb1b8c70f6aa94))
* **h2:** API service batch, chooser modal, rota bulk de apartamentos ([727b41e](https://github.com/gabrieljarufe/condo-vote-app/commit/727b41e1f1e385d01fb13ccec764a7099fa61133))
* **h2:** cria ApartmentBulkGeneratorForm — Step 1 do wizard de criação em lote ([f1f3f62](https://github.com/gabrieljarufe/condo-vote-app/commit/f1f3f62f5a7daebb00be339b0c1716e317bc1c8e))
* **h2:** finaliza wizard de cadastro em lote e polimentos de UX ([fbd2d87](https://github.com/gabrieljarufe/condo-vote-app/commit/fbd2d8799003e6aa9e078998735d2f902956665f))
* **h2:** síndico cadastra apartamento e marca inadimplência ([8bff106](https://github.com/gabrieljarufe/condo-vote-app/commit/8bff1069a7890cc41d2fd5818a1bbb85fe4e1bae))
* **h3:** adiciona infra de email (Inbucket dev + GreenMail test + Resend prod) e read-excel-file ([e65c44b](https://github.com/gabrieljarufe/condo-vote-app/commit/e65c44be87da8363cd342ddf1b6ac717bfd1f753))
* **h3:** adiciona página de convites com lista, filtros e form individual ([04451ab](https://github.com/gabrieljarufe/condo-vote-app/commit/04451abe5207418c67b93db89ac84d7a077a2264))
* **h3:** adiciona wizard XLSX para criar convites em lote (Step 1 upload + Step 2 preview) ([49c79ad](https://github.com/gabrieljarufe/condo-vote-app/commit/49c79ad5e005089eaeddce669ebb273e31d11935))
* **h3:** habilita envio de convite via Resend ponta-a-ponta ([ec0fcc9](https://github.com/gabrieljarufe/condo-vote-app/commit/ec0fcc94e78a7dd343c66912c18df262c811d25a))
* **h3:** síndico convida morador por e-mail (individual + bulk XLSX) ([84cbd54](https://github.com/gabrieljarufe/condo-vote-app/commit/84cbd54753365df028483224ccd7b2f15006962b))
* **h4:** aceite de convite via magic link ([ba1b96e](https://github.com/gabrieljarufe/condo-vote-app/commit/ba1b96e81cf9d93d6f4402e668f5ee2f5f568fb4))
* **h4:** aceite de convite via magic link (onboarding público) ([42338aa](https://github.com/gabrieljarufe/condo-vote-app/commit/42338aac10a52db31538b1b49ad60405e7d00436))


### Bug Fixes

* **apartments:** adiciona inputs projetados no ApartmentForm e expande cobertura de testes ([10fa1d6](https://github.com/gabrieljarufe/condo-vote-app/commit/10fa1d6d341107ec7af331ac28752e07a73532f7))
* **bulk-grid:** addCustomRow sugere próximo andar em vez de label CB ([b7d0d9d](https://github.com/gabrieljarufe/condo-vote-app/commit/b7d0d9ddf9ec24022e1870906af3d3b2c78e5a64))
* **email:** remove 'apartamento' redundante do subject e corrige toast de conta criada ([6049a32](https://github.com/gabrieljarufe/condo-vote-app/commit/6049a32c2002ea40b2ebae76596916c23e57bd24))
* **frontend:** preserva bloco no bulk, fecha banner parcial com fade e valida CPF com dígitos iguais ([3ad46a7](https://github.com/gabrieljarufe/condo-vote-app/commit/3ad46a79c7ccba8998aea1827ee1a8f05f362865))
* **frontend:** remove imports e variáveis não usados (ESLint do PR [#70](https://github.com/gabrieljarufe/condo-vote-app/issues/70)) ([dd1106c](https://github.com/gabrieljarufe/condo-vote-app/commit/dd1106cc68d0598302a894338fad0290db3cefc9))
* **frontend:** remove imports e variáveis não usados reportados pelo ESLint ([5eb4a47](https://github.com/gabrieljarufe/condo-vote-app/commit/5eb4a47e96c8235cc3c2974a4882630e9c7fe30a))
* **h2:** corrige erros de compilação TypeScript nos specs ([69b6d74](https://github.com/gabrieljarufe/condo-vote-app/commit/69b6d745c72f851d4843cff8b68b113b2b3181a1))
* **lint:** remove import não usado de beforeEach em auth.guard.spec ([dbff376](https://github.com/gabrieljarufe/condo-vote-app/commit/dbff376bde71a4eeffd70dce42904c5cc130226b))
* **lint:** remove imports não usados em specs frontend ([ec3f4ca](https://github.com/gabrieljarufe/condo-vote-app/commit/ec3f4ca519cf5c7e6eeab7c4a0a139e4c016dc7c))
* **lint:** resolve violações do reviewdog no PR de paginação ([bd09334](https://github.com/gabrieljarufe/condo-vote-app/commit/bd093347e7ca118d6994c2d9c37f6e0c5e7ca780))

## 1.0.0 (2026-05-13)


### Features

* **frontend:** adiciona tenantGuard e specs para auth/tenant guards ([3351df4](https://github.com/gabrieljarufe/condo-vote-app/commit/3351df4d785711fe36773d816673d6067b168ff1))
* função pura generateApartments com suite de testes completa ([356b2fa](https://github.com/gabrieljarufe/condo-vote-app/commit/356b2fa9de008a9f7f0859e33dd84cfcc50acd9e))
* H2 cadastra apartamento e marca inadimplência ([94fa44b](https://github.com/gabrieljarufe/condo-vote-app/commit/94fa44b45bfabbc5668309f2490ad60a75dceee5))
* **h2:** adiciona ApartmentBulkPreviewGrid — Step 2 do wizard de cadastro em lote ([224667b](https://github.com/gabrieljarufe/condo-vote-app/commit/224667b3f13a7cc780f7f0c419407196c39fdd55))
* **h2:** adiciona ApartmentsBulkPage — wizard completo com Step 1 e Step 2 ([12a78b7](https://github.com/gabrieljarufe/condo-vote-app/commit/12a78b71cb0a144138b30431b3bb1b8c70f6aa94))
* **h2:** API service batch, chooser modal, rota bulk de apartamentos ([727b41e](https://github.com/gabrieljarufe/condo-vote-app/commit/727b41e1f1e385d01fb13ccec764a7099fa61133))
* **h2:** cria ApartmentBulkGeneratorForm — Step 1 do wizard de criação em lote ([f1f3f62](https://github.com/gabrieljarufe/condo-vote-app/commit/f1f3f62f5a7daebb00be339b0c1716e317bc1c8e))
* **h2:** finaliza wizard de cadastro em lote e polimentos de UX ([fbd2d87](https://github.com/gabrieljarufe/condo-vote-app/commit/fbd2d8799003e6aa9e078998735d2f902956665f))
* **h2:** síndico cadastra apartamento e marca inadimplência ([8bff106](https://github.com/gabrieljarufe/condo-vote-app/commit/8bff1069a7890cc41d2fd5818a1bbb85fe4e1bae))
* **h3:** adiciona infra de email (Inbucket dev + GreenMail test + Resend prod) e read-excel-file ([e65c44b](https://github.com/gabrieljarufe/condo-vote-app/commit/e65c44be87da8363cd342ddf1b6ac717bfd1f753))
* **h3:** adiciona página de convites com lista, filtros e form individual ([04451ab](https://github.com/gabrieljarufe/condo-vote-app/commit/04451abe5207418c67b93db89ac84d7a077a2264))
* **h3:** adiciona wizard XLSX para criar convites em lote (Step 1 upload + Step 2 preview) ([49c79ad](https://github.com/gabrieljarufe/condo-vote-app/commit/49c79ad5e005089eaeddce669ebb273e31d11935))
* **h3:** habilita envio de convite via Resend ponta-a-ponta ([ec0fcc9](https://github.com/gabrieljarufe/condo-vote-app/commit/ec0fcc94e78a7dd343c66912c18df262c811d25a))
* **h3:** síndico convida morador por e-mail (individual + bulk XLSX) ([84cbd54](https://github.com/gabrieljarufe/condo-vote-app/commit/84cbd54753365df028483224ccd7b2f15006962b))


### Bug Fixes

* **apartments:** adiciona inputs projetados no ApartmentForm e expande cobertura de testes ([10fa1d6](https://github.com/gabrieljarufe/condo-vote-app/commit/10fa1d6d341107ec7af331ac28752e07a73532f7))
* **frontend:** remove imports e variáveis não usados (ESLint do PR [#70](https://github.com/gabrieljarufe/condo-vote-app/issues/70)) ([dd1106c](https://github.com/gabrieljarufe/condo-vote-app/commit/dd1106cc68d0598302a894338fad0290db3cefc9))
* **frontend:** remove imports e variáveis não usados reportados pelo ESLint ([5eb4a47](https://github.com/gabrieljarufe/condo-vote-app/commit/5eb4a47e96c8235cc3c2974a4882630e9c7fe30a))
* **h2:** corrige erros de compilação TypeScript nos specs ([69b6d74](https://github.com/gabrieljarufe/condo-vote-app/commit/69b6d745c72f851d4843cff8b68b113b2b3181a1))
* **lint:** remove import não usado de beforeEach em auth.guard.spec ([dbff376](https://github.com/gabrieljarufe/condo-vote-app/commit/dbff376bde71a4eeffd70dce42904c5cc130226b))
* **lint:** remove imports não usados em specs frontend ([ec3f4ca](https://github.com/gabrieljarufe/condo-vote-app/commit/ec3f4ca519cf5c7e6eeab7c4a0a139e4c016dc7c))

## 1.0.0 (2026-05-13)


### Features

* **frontend:** adiciona tenantGuard e specs para auth/tenant guards ([3351df4](https://github.com/gabrieljarufe/condo-vote-app/commit/3351df4d785711fe36773d816673d6067b168ff1))
* função pura generateApartments com suite de testes completa ([356b2fa](https://github.com/gabrieljarufe/condo-vote-app/commit/356b2fa9de008a9f7f0859e33dd84cfcc50acd9e))
* H2 cadastra apartamento e marca inadimplência ([94fa44b](https://github.com/gabrieljarufe/condo-vote-app/commit/94fa44b45bfabbc5668309f2490ad60a75dceee5))
* **h2:** adiciona ApartmentBulkPreviewGrid — Step 2 do wizard de cadastro em lote ([224667b](https://github.com/gabrieljarufe/condo-vote-app/commit/224667b3f13a7cc780f7f0c419407196c39fdd55))
* **h2:** adiciona ApartmentsBulkPage — wizard completo com Step 1 e Step 2 ([12a78b7](https://github.com/gabrieljarufe/condo-vote-app/commit/12a78b71cb0a144138b30431b3bb1b8c70f6aa94))
* **h2:** API service batch, chooser modal, rota bulk de apartamentos ([727b41e](https://github.com/gabrieljarufe/condo-vote-app/commit/727b41e1f1e385d01fb13ccec764a7099fa61133))
* **h2:** cria ApartmentBulkGeneratorForm — Step 1 do wizard de criação em lote ([f1f3f62](https://github.com/gabrieljarufe/condo-vote-app/commit/f1f3f62f5a7daebb00be339b0c1716e317bc1c8e))
* **h2:** finaliza wizard de cadastro em lote e polimentos de UX ([fbd2d87](https://github.com/gabrieljarufe/condo-vote-app/commit/fbd2d8799003e6aa9e078998735d2f902956665f))
* **h2:** síndico cadastra apartamento e marca inadimplência ([8bff106](https://github.com/gabrieljarufe/condo-vote-app/commit/8bff1069a7890cc41d2fd5818a1bbb85fe4e1bae))
* **h3:** adiciona infra de email (Inbucket dev + GreenMail test + Resend prod) e read-excel-file ([e65c44b](https://github.com/gabrieljarufe/condo-vote-app/commit/e65c44be87da8363cd342ddf1b6ac717bfd1f753))
* **h3:** adiciona página de convites com lista, filtros e form individual ([04451ab](https://github.com/gabrieljarufe/condo-vote-app/commit/04451abe5207418c67b93db89ac84d7a077a2264))
* **h3:** adiciona wizard XLSX para criar convites em lote (Step 1 upload + Step 2 preview) ([49c79ad](https://github.com/gabrieljarufe/condo-vote-app/commit/49c79ad5e005089eaeddce669ebb273e31d11935))
* **h3:** habilita envio de convite via Resend ponta-a-ponta ([ec0fcc9](https://github.com/gabrieljarufe/condo-vote-app/commit/ec0fcc94e78a7dd343c66912c18df262c811d25a))
* **h3:** síndico convida morador por e-mail (individual + bulk XLSX) ([84cbd54](https://github.com/gabrieljarufe/condo-vote-app/commit/84cbd54753365df028483224ccd7b2f15006962b))


### Bug Fixes

* **apartments:** adiciona inputs projetados no ApartmentForm e expande cobertura de testes ([10fa1d6](https://github.com/gabrieljarufe/condo-vote-app/commit/10fa1d6d341107ec7af331ac28752e07a73532f7))
* **frontend:** remove imports e variáveis não usados (ESLint do PR [#70](https://github.com/gabrieljarufe/condo-vote-app/issues/70)) ([dd1106c](https://github.com/gabrieljarufe/condo-vote-app/commit/dd1106cc68d0598302a894338fad0290db3cefc9))
* **frontend:** remove imports e variáveis não usados reportados pelo ESLint ([5eb4a47](https://github.com/gabrieljarufe/condo-vote-app/commit/5eb4a47e96c8235cc3c2974a4882630e9c7fe30a))
* **h2:** corrige erros de compilação TypeScript nos specs ([69b6d74](https://github.com/gabrieljarufe/condo-vote-app/commit/69b6d745c72f851d4843cff8b68b113b2b3181a1))
* **lint:** remove import não usado de beforeEach em auth.guard.spec ([dbff376](https://github.com/gabrieljarufe/condo-vote-app/commit/dbff376bde71a4eeffd70dce42904c5cc130226b))
* **lint:** remove imports não usados em specs frontend ([ec3f4ca](https://github.com/gabrieljarufe/condo-vote-app/commit/ec3f4ca519cf5c7e6eeab7c4a0a139e4c016dc7c))
