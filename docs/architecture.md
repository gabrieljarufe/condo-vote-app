# Condo Vote — Arquitetura do Sistema

> Este documento define as decisões arquiteturais do projeto.
> Cada seção contém perguntas que devem ser respondidas antes de avançar para implementação.
> As seções estão ordenadas por **dependência** — decisões anteriores influenciam as posteriores.

---

## 0. Restrições e Contexto

Antes de qualquer decisão técnica, é preciso entender os limites reais do projeto.

### Perguntas

- **Tamanho do time:** quantas pessoas vão desenvolver e manter o sistema? (1 dev solo? time pequeno?)
- **Budget de infraestrutura:** há orçamento mensal definido? Qual a faixa aceitável? (ex: R$0, R$50, R$200+)
- **Timeline:** existe pressão de prazo para v1? (ex: precisa estar no ar em 3 meses, ou é projeto pessoal sem deadline?)
- **Domínio técnico do time:** onde o time tem mais experiência? Onde tem menos? (ex: forte em Java/Spring, fraco em DevOps)
- **Escala esperada na v1:** quantos condomínios simultâneos? (1? 10? 100?)

### Decisões

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Tamanho do time | | |
| Budget mensal de infra | | |
| Deadline v1 | | |
| Expertise principal | | |
| Escala v1 | | |

---

## 1. Autenticação e Identidade

Esta é a decisão de maior impacto. Muda o schema do banco (a tabela `refresh_token` existe ou não?), os endpoints, o fluxo de onboarding, e o modelo de autorização inteiro.

### Perguntas

**1.1 — Quem gerencia identidade e login?**

O sistema será responsável por autenticar usuários (signup, login, reset de senha, emissão de tokens), ou isso será delegado a um Identity Provider externo?

| Opção | O que implica |
|-------|---------------|
| **Auth própria (Spring Security + JWT)** | Controle total. Tabelas `app_user`, `refresh_token` no schema. Implementar signup, login, refresh rotation, reset de senha manualmente. Mais código, mais responsabilidade de segurança |
| **Keycloak self-hosted** | Identity server dedicado. Gerencia users, tokens, roles. O app Spring só valida tokens. Elimina `refresh_token` do schema. Adiciona complexidade de deploy (mais um serviço) |
| **Auth0 / Clerk / Supabase Auth (SaaS)** | Mesma ideia do Keycloak mas gerenciado. Zero infra adicional. Custo mensal. Vendor lock-in potencial |

Perguntas de follow-up dependendo da escolha:
- Se auth própria: quem é responsável por auditar a segurança da implementação?
- Se Keycloak: o time tem experiência em operar Keycloak? Sabe configurar realms, clients, mappers?
- Se SaaS: o free tier comporta a escala v1? O que acontece quando escalar?

**1.2 — Onde vivem os papéis (síndico, owner, tenant)?**

Independente de quem autentica, alguém precisa saber que "este usuário é síndico do condomínio X".

| Opção | O que implica |
|-------|---------------|
| **No identity provider** | Roles como claims no JWT. O app não precisa consultar o banco para verificar permissões. Mas: trocar role exige atualizar o IdP, não só o banco |
| **Na aplicação (tabela `condominium_role`)** | O app consulta o banco para cada verificação de permissão. Mas: controle total, alinhado com RLS, sem dependência externa |
| **Híbrido** | IdP sabe que o user existe e está ativo. App sabe quais papéis ele tem em cada condo. JWT tem só user_id, app resolve o resto |

**1.3 — Fluxo de convite e onboarding**

O síndico envia convite por e-mail. O morador clica no link e cria conta.

- Se auth própria: o link leva para uma tela de cadastro do app. O app cria o user.
- Se IdP externo: o link leva para onde? O IdP precisa saber sobre o convite? Ou o morador cria conta no IdP e depois o app vincula via callback?

**Pergunta crítica:** o fluxo de convite é a primeira experiência do morador com o sistema. Quanto atrito é aceitável? (1 tela? 2 telas? redirecionamento para domínio externo?)

### Decisões

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Gestão de identidade | | |
| Onde vivem os papéis | | |
| Fluxo de onboarding | | |

---

## 2. Arquitetura do Backend

### Perguntas

**2.1 — Monolito ou serviços?**

| Opção | Quando faz sentido |
|-------|-------------------|
| **Monolito Spring Boot** | Time pequeno, v1, domínio coeso. Um artefato para deploy, um banco, menos overhead operacional |
| **Monolito modular** | Monolito mas com módulos bem separados (auth, polls, apartments). Permite extrair para serviços no futuro sem reescrever |
| **Microserviços** | Time grande, domínios muito diferentes, necessidade de escalar componentes independentemente. Overhead operacional alto |

**2.2 — Estrutura interna do projeto**

Como o código é organizado dentro do monolito?

| Opção | Descrição |
|-------|-----------|
| **Package by layer** | `controller/`, `service/`, `repository/` — simples, familiar, mas acopla domínios diferentes |
| **Package by feature** | `poll/`, `apartment/`, `auth/` — cada feature tem seu controller, service, repository. Melhor isolamento |
| **Hexagonal / Ports & Adapters** | Domain core sem dependência de framework. Adapters para HTTP, DB, email. Mais abstração, mais boilerplate |

**2.3 — Como o app gerencia transações e RLS?**

O data model usa RLS com `SET LOCAL app.current_tenant`. Isso implica:

- Cada request precisa abrir uma transação e setar o tenant antes de qualquer query
- Onde isso acontece? Filter? Interceptor? AOP?
- O que acontece em operações cross-tenant? (ex: um user logado precisa ver em quais condos está vinculado — isso é uma query sem tenant)

**2.4 — Validação e error handling**

- Validação de domínio (ex: mínimo 2 opções por poll) — onde vive? Na entity? No service? Em um domain validator separado?
- Erros de constraint do banco (ex: voto duplicado) — como são mapeados para HTTP? (ex: `DataIntegrityViolationException` → `409 Conflict`)
- Existe uma estratégia unificada ou cada endpoint trata individualmente?

### Decisões

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Arquitetura geral | | |
| Estrutura de packages | | |
| Estratégia de RLS no app | | |
| Estratégia de validação | | |

---

## 3. Banco de Dados e Persistência

### Perguntas

**3.1 — Banco gerenciado ou self-hosted?**

| Opção | Trade-off |
|-------|-----------|
| **Self-hosted (Docker/VPS)** | Custo menor, controle total, responsabilidade de backup/recovery/upgrade é sua |
| **Gerenciado (RDS, Supabase, Neon)** | Backup automático, scaling, patching. Custo mensal. Menos controle sobre extensões e configs |

**3.2 — Estratégia de migrations**

O data model está definido em Markdown. Como vira schema real?

| Opção | Descrição |
|-------|-----------|
| **Flyway** | Migrations SQL versionadas (`V1__create_condominium.sql`, `V2__...`). Controle total do SQL |
| **Liquibase** | Migrations em XML/YAML/SQL. Mais features (rollback, diff), mais complexidade |
| **JPA/Hibernate auto-DDL** | Gera schema a partir das entities. Conveniente para dev, perigoso em produção |

**3.3 — Ambiente de desenvolvimento local**

- Docker Compose com PostgreSQL para dev local?
- Seed de dados para dev (síndico, condo, apartments) — existe ou precisa criar?
- Testcontainers para testes de integração?

### Decisões

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Hosting do banco | | |
| Ferramenta de migrations | | |
| Setup local | | |

---

## 4. Jobs e Automação

O ciclo de vida do poll depende de ações automáticas: abrir na `scheduled_start`, fechar na `scheduled_end` ou quando todos votaram, gerar snapshot na abertura.

### Perguntas

**4.1 — Como os jobs automáticos são executados?**

| Opção | Trade-off |
|-------|-----------|
| **Spring `@Scheduled`** | Simples. Roda dentro do mesmo processo. Não sobrevive a restart. Problemático com múltiplas instâncias (execução duplicada) |
| **Spring + ShedLock** | `@Scheduled` com lock distribuído via banco. Resolve duplicação em múltiplas instâncias. Simples de adicionar |
| **Fila de mensagens (RabbitMQ, SQS)** | Eventos agendados como mensagens com delay. Mais robusto, mais infraestrutura |
| **Cron externo (GitHub Actions, AWS EventBridge)** | Job externo chama um endpoint do app. Desacoplado, mas adiciona dependência externa |

**4.2 — Granularidade do polling**

- Com que frequência o job verifica se um poll deve abrir/fechar? (a cada minuto? 5 minutos? 30 segundos?)
- Qual a tolerância de atraso aceitável? (se o poll deveria abrir às 14:00, abrir às 14:01 é ok?)

**4.3 — Idempotência**

- Se o job rodar duas vezes para o mesmo poll, o resultado deve ser o mesmo (snapshot não duplica, status não transita duas vezes)
- Como garantir isso? (status check antes de transitar? lock pessimista?)

### Decisões

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Mecanismo de jobs | | |
| Frequência de polling | | |
| Estratégia de idempotência | | |

---

## 5. E-mail e Notificações

A spec define 8 tipos de notificação por e-mail na v1.

### Perguntas

**5.1 — Provider de e-mail transacional**

| Opção | Free tier | Custo |
|-------|-----------|-------|
| **Amazon SES** | 62K/mês (se no EC2) | ~$0.10/1000 emails |
| **SendGrid** | 100/dia | A partir de $20/mês |
| **Resend** | 3K/mês | $20/mês para 50K |
| **Mailgun** | Sem free tier | $35/mês |
| **SMTP próprio** | Ilimitado | Alto risco de cair em spam |

**5.2 — Envio síncrono ou assíncrono?**

- **Síncrono:** o endpoint que cria o poll também envia os e-mails na mesma request. Simples, mas lento e frágil (se o SMTP falhar, a request falha?)
- **Assíncrono:** o endpoint cria o poll e publica um evento. Um listener/worker envia os e-mails. Resiliente, mas mais complexidade

**5.3 — Templates**

- Quem renderiza o HTML do e-mail? (Thymeleaf? FreeMarker? Template no provider?)
- Os templates ficam no código ou são editáveis externamente?

### Decisões

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Provider de e-mail | | |
| Síncrono vs assíncrono | | |
| Renderização de templates | | |

---

## 6. Frontend ↔ Backend

### Perguntas

**6.1 — Contrato da API**

- REST puro com convenções próprias, ou um padrão formal? (OpenAPI/Swagger gerado pelo Spring?)
- Versionamento de API: via path (`/v1/polls`), header, ou não versionar na v1?
- Paginação: offset-based ou cursor-based?

**6.2 — Contexto de tenant no frontend**

O morador pode estar em múltiplos condomínios. Como o frontend comunica qual condo está ativo?

| Opção | Descrição |
|-------|-----------|
| **Header customizado** | `X-Tenant-Id: <uuid>` em toda request. Angular interceptor injeta automaticamente |
| **Path prefix** | `/api/condominiums/{id}/polls`. Tenant explícito na URL. Mais RESTful, mais verboso |
| **Sessão/cookie** | Tenant selecionado é salvo server-side. Menos flexível |

**6.3 — Token refresh no Angular**

- Interceptor automático que detecta 401 e renova o access token?
- Se auth própria: implementar refresh rotation. Se IdP: o SDK do provider faz isso?
- Queue de requests durante o refresh para evitar múltiplas renovações simultâneas?

### Decisões

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Contrato de API | | |
| Tenant context | | |
| Token refresh | | |

---

## 7. Infraestrutura e Deploy

### Perguntas

**7.1 — Onde o sistema roda?**

| Opção | Custo | Complexidade |
|-------|-------|-------------|
| **VPS simples (Hetzner, DigitalOcean)** | ~$5-20/mês | Baixa. Docker Compose, Nginx, Certbot |
| **AWS (ECS/EKS + RDS)** | ~$30-100/mês | Média-alta. Mais serviços gerenciados, mais config |
| **PaaS (Railway, Fly.io, Render)** | ~$10-30/mês | Baixa. Push-to-deploy, menos controle |
| **Vercel (frontend) + separado (backend)** | Variável | Frontend simples, backend precisa de outro host |

**7.2 — Como o deploy acontece?**

- Push to main → deploy automático?
- Pipeline CI/CD (GitHub Actions, GitLab CI)?
- Ambientes: só produção, ou staging também?

**7.3 — Containerização**

- Docker para o backend Spring Boot?
- Docker Compose para dev local (app + postgres + keycloak se aplicável)?
- Mesmo Dockerfile para dev e prod?

### Decisões

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Hosting | | |
| Pipeline de deploy | | |
| Containerização | | |

---

## 8. Segurança (além de auth)

### Perguntas

- **Rate limiting:** endpoints públicos (login, signup, reset password) precisam de rate limit? (ex: Spring Cloud Gateway, Bucket4j, ou Nginx)
- **CORS:** quais origens são permitidas?
- **Criptografia do CPF:** AES-256 com qual gerenciamento de chave? (variável de ambiente? AWS KMS? Vault?)
- **Auditoria de ações do síndico:** log simples no banco, ou event sourcing formal?
- **HTTPS:** TLS terminado onde? (Nginx? Load balancer? PaaS gerencia?)

### Decisões

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Rate limiting | | |
| Gestão de chave de criptografia | | |
| Auditoria | | |
| TLS termination | | |

---

## 9. Observabilidade

### Perguntas

- **Logging:** estruturado (JSON) ou texto? Onde os logs são armazenados? (stdout + agregador? arquivo local?)
- **Métricas:** Micrometer + Prometheus? Ou não na v1?
- **Alertas:** quem é notificado se o sistema cair? Como? (e-mail, Slack, PagerDuty?)
- **Health checks:** endpoint `/actuator/health` exposto? O que ele verifica? (banco, fila, SMTP?)

### Decisões

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Formato de logging | | |
| Métricas v1 | | |
| Alertas | | |

---

## Ordem de Preenchimento Recomendada

As decisões se encadeiam. A ordem sugerida para preencher este documento:

```
0. Restrições e Contexto ← preencher primeiro, define os limites de tudo
      ↓
1. Autenticação ← maior impacto no schema e no fluxo do sistema
      ↓
2. Backend Architecture ← define como o código é organizado
      ↓
3. Banco de Dados ← define como o schema é gerenciado
      ↓
4. Jobs ← depende de 2 (onde rodam) e 3 (como acessam dados)
      ↓
5. E-mail ← depende de 4 (síncrono ou via job)
      ↓
6. Frontend ↔ Backend ← depende de 1 (auth) e 2 (API shape)
      ↓
7. Infra e Deploy ← depende de tudo acima (o que precisa rodar)
      ↓
8. Segurança ← refinamento transversal
      ↓
9. Observabilidade ← última camada
```
