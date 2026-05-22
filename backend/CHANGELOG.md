# Changelog

## [0.0.5](https://github.com/gabrieljarufe/condo-vote-app/compare/backend-v0.0.4...backend-v0.0.5) (2026-05-17)


### Bug Fixes

* **h5:** adiciona endpoint accept-as-existing com auditoria dual ([f47cc0e](https://github.com/gabrieljarufe/condo-vote-app/commit/f47cc0e949b50ee96565c1d0ac4eb7f79a29f022))
* **h5:** emite RESIDENT_JOINED em complete() e exige declaração explícita ([606fad7](https://github.com/gabrieljarufe/condo-vote-app/commit/606fad7f344b8b9551c582a18764a4c1a3a63b9a))
* **h5:** expor emailHasAccount em ValidateInvitationResponse ([2f582e7](https://github.com/gabrieljarufe/condo-vote-app/commit/2f582e78a6da44a54abd52c65f8efc1b9a51c219))
* **h5:** permite aceite de convite para e-mail com conta existente ([1a999e1](https://github.com/gabrieljarufe/condo-vote-app/commit/1a999e1aafdc21d95a2789f2e459f0aec9b940cd))
* **h5:** remove CPF do fluxo LINK (minimizacao LGPD) ([932ec02](https://github.com/gabrieljarufe/condo-vote-app/commit/932ec02c6a074dca5d23417dc39094de526a0770))

## [0.0.4](https://github.com/gabrieljarufe/condo-vote-app/compare/backend-v0.0.3...backend-v0.0.4) (2026-05-17)


### Features

* **h5:** morador vê apartamentos onde reside + docs/repriorização MVP ([94fd63d](https://github.com/gabrieljarufe/condo-vote-app/commit/94fd63d314bb10e921a0460941a52d5d2f7efc3f))

## [0.0.3](https://github.com/gabrieljarufe/condo-vote-app/compare/backend-v0.0.2...backend-v0.0.3) (2026-05-17)


### Features

* **apartments:** pagina lista de apartamentos server-side ([1258694](https://github.com/gabrieljarufe/condo-vote-app/commit/1258694426120fadb4ae4855a4b2cb3fbe3b4a0f))
* **apartments:** paginação server-side da lista de apartamentos ([3f4a7fe](https://github.com/gabrieljarufe/condo-vote-app/commit/3f4a7feff4059f1c11b3f0d859782d4a6c33cf04))
* **h4:** aceite de convite via magic link ([ba1b96e](https://github.com/gabrieljarufe/condo-vote-app/commit/ba1b96e81cf9d93d6f4402e668f5ee2f5f568fb4))
* **h4:** aceite de convite via magic link (onboarding público) ([42338aa](https://github.com/gabrieljarufe/condo-vote-app/commit/42338aac10a52db31538b1b49ad60405e7d00436))


### Bug Fixes

* **backend:** boot não quebra mais quando SUPABASE_SERVICE_ROLE_KEY não está setada ([5d9ec66](https://github.com/gabrieljarufe/condo-vote-app/commit/5d9ec66b6e217c1ec30bdc1a403f5dee55d271bf))
* **backend:** boot resiliente quando SUPABASE_SERVICE_ROLE_KEY ausente ([b92d042](https://github.com/gabrieljarufe/condo-vote-app/commit/b92d04200479b1bb0d53f376f5488f93c23643c8))
* **email:** remove 'apartamento' redundante do subject do convite ([fd81189](https://github.com/gabrieljarufe/condo-vote-app/commit/fd81189fb7b4e2c11911ecbb6b1bc4b153c8ecb0))
* **h3:** mostra nome do condomínio + label do apartamento no e-mail ([50fd15a](https://github.com/gabrieljarufe/condo-vote-app/commit/50fd15a631a644fe541af538fec3609e9eff7150))
* **h3:** mostra nome do condomínio e label do apartamento no e-mail de convite ([7a9195a](https://github.com/gabrieljarufe/condo-vote-app/commit/7a9195aa0c5b822548d70ca7e1d20922bbf41182))
* **security:** credenciais do actuator via env vars e regra de secrets no CLAUDE.md ([736f7ce](https://github.com/gabrieljarufe/condo-vote-app/commit/736f7cee55e02389420f45b068a2975697857eda))
* **security:** remove JWT fallback hardcoded do application-local.yaml ([c7fb909](https://github.com/gabrieljarufe/condo-vote-app/commit/c7fb9095e1e4dd8de6cfe944101ceac4ffc0e08e))

## [0.0.2](https://github.com/gabrieljarufe/condo-vote-app/compare/backend-v0.0.1...backend-v0.0.2) (2026-05-13)


### Features

* **apartments:** endpoint batch POST /apartments/batch com ON CONFLICT idempotente ([14883d4](https://github.com/gabrieljarufe/condo-vote-app/commit/14883d496f29564c40a33af5a96541d2db57cc76))
* H2 cadastra apartamento e marca inadimplência ([94fa44b](https://github.com/gabrieljarufe/condo-vote-app/commit/94fa44b45bfabbc5668309f2490ad60a75dceee5))
* **h2:** finaliza wizard de cadastro em lote e polimentos de UX ([fbd2d87](https://github.com/gabrieljarufe/condo-vote-app/commit/fbd2d8799003e6aa9e078998735d2f902956665f))
* **h2:** síndico cadastra apartamento e marca inadimplência ([8bff106](https://github.com/gabrieljarufe/condo-vote-app/commit/8bff1069a7890cc41d2fd5818a1bbb85fe4e1bae))
* **h3:** adiciona aggregates Invitation e EmailNotification, repos, DTOs e CpfEncryptor byte[] ([4cd5c66](https://github.com/gabrieljarufe/condo-vote-app/commit/4cd5c668a0872206159026a5d07d878e2d96c518))
* **h3:** adiciona EmailGateway interface e SmtpEmailGateway com UTs ([d8e2f0c](https://github.com/gabrieljarufe/condo-vote-app/commit/d8e2f0c62388a46a7340b6cae89b0e6a8c3c065d))
* **h3:** adiciona EmailSenderJob com outbox FIFO e backoff exponencial ([92f42bf](https://github.com/gabrieljarufe/condo-vote-app/commit/92f42bf6646ef068379e4f01157f73afb4a58cb1))
* **h3:** adiciona infra de email (Inbucket dev + GreenMail test + Resend prod) e read-excel-file ([e65c44b](https://github.com/gabrieljarufe/condo-vote-app/commit/e65c44be87da8363cd342ddf1b6ac717bfd1f753))
* **h3:** adiciona InvitationController com 6 endpoints REST e ITs cobrindo todos os caminhos ([6331af2](https://github.com/gabrieljarufe/condo-vote-app/commit/6331af29b00c7356647f1ab26522dd0e993570d2))
* **h3:** adiciona InvitationExpirerJob (@Scheduled 1h) ([d9e8919](https://github.com/gabrieljarufe/condo-vote-app/commit/d9e8919428d74a71fa66cf50abd724fdb9635258))
* **h3:** adiciona InvitationService com criar/listar/revoke/resend/fix-email e bulk ACID ([51cea12](https://github.com/gabrieljarufe/condo-vote-app/commit/51cea12f12c0d79f2687df5891fc01bcbf72cb01))
* **h3:** adiciona ResendEmailGateway para envio em produção via HTTP ([b205dff](https://github.com/gabrieljarufe/condo-vote-app/commit/b205dff2a1446043e4fe96bcb55b70ffe386228c))
* **h3:** adiciona template Thymeleaf de convite e EmailTemplateRenderer ([0218a44](https://github.com/gabrieljarufe/condo-vote-app/commit/0218a446a51295681df4979693cc9ef80e8bba60))
* **h3:** habilita envio de convite via Resend ponta-a-ponta ([ec0fcc9](https://github.com/gabrieljarufe/condo-vote-app/commit/ec0fcc94e78a7dd343c66912c18df262c811d25a))
* **h3:** síndico convida morador por e-mail (individual + bulk XLSX) ([84cbd54](https://github.com/gabrieljarufe/condo-vote-app/commit/84cbd54753365df028483224ccd7b2f15006962b))


### Bug Fixes

* **apartments:** corrige ApartmentKey para evitar colisão de separador e adiciona guard de lista vazia ([5c453c6](https://github.com/gabrieljarufe/condo-vote-app/commit/5c453c65603a0a2f2ba5ea395fc58bfe63bdb461))

## 0.0.1 (2026-05-11)


### Bug Fixes

* **build:** compatibilidade Spotless/google-java-format com JDK 23+ ([2fc3d27](https://github.com/gabrieljarufe/condo-vote-app/commit/2fc3d27b3e72f412ec3adf8a66d58d1251762ef0))


### Documentation

* **phase-7:** pivota índice para histórias + adiciona workflow canônico ([3ecdc53](https://github.com/gabrieljarufe/condo-vote-app/commit/3ecdc53aa884d7b5b85bc38ec1d63e731b791c00))
