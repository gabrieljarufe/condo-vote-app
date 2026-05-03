# Flyway e Migrations — Como o Schema do Banco Evolui

Este documento explica **o quê** é Flyway, **como** o projeto utiliza ele e
**quando** as migrations rodam. Cobre desde o conceito básico até as
particularidades do projeto: numeração reservada, repeatable migrations para
seed local, integração com Supabase e RLS, e a estratégia de rollback
forward-only.

---

## Visão geral da arquitetura

```
        Repositório git                  Backend Spring Boot              PostgreSQL (Supabase)
              │                                  │                                │
              │ src/main/resources/              │                                │
              │   db/migration/V1__enums.sql     │                                │
              │   db/migration/V2__condo.sql     │                                │
              │   db/migration/...               │                                │
              │   db/seed/R__seed_dev.sql        │                                │
              │                                  │                                │
              │── git push main ────────────────▶│                                │
              │                                  │                                │
              │                              ./mvnw spring-boot:run               │
              │                                  │                                │
              │                                  │── 1. Spring inicia ───────────▶│
              │                                  │── 2. Flyway scan classpath ───▶│
              │                                  │── 3. SELECT flyway_schema_history ▶│
              │                                  │◀── (vazio) ────────────────────│
              │                                  │                                │
              │                                  │── 4. Apply V1__enums.sql ─────▶│
              │                                  │── 5. Apply V2__condo.sql ─────▶│
              │                                  │── 6. ... ─────────────────────▶│
              │                                  │── 7. INSERT em                 │
              │                                  │       flyway_schema_history ──▶│
              │                                  │                                │
              │                                  │── 8. Spring continua boot ─────│
              │                                  │       (Hibernate, Tomcat, …)   │
```

Próximo deploy:

```
              │                              ./mvnw spring-boot:run
              │                                  │
              │                                  │── SELECT flyway_schema_history ▶│
              │                                  │◀── V1..V10 já aplicadas ───────│
              │                                  │                                │
              │                                  │── Comparar checksum SQL atual ─│
              │                                  │       com checksum no histórico│
              │                                  │── (igual) → não reaplica ─────▶│
              │                                  │── (diferente) → ABORTA boot ───│
              │                                  │      checksum mismatch         │
```

---

## O quê — Flyway em uma frase

Flyway é uma ferramenta de **versionamento de schema de banco de dados**: cada
mudança vira um arquivo SQL versionado no repo (`V1__...`, `V2__...`), e o
Flyway garante que cada arquivo é executado **exatamente uma vez** em cada
banco, na ordem correta, registrando o histórico em uma tabela própria
(`flyway_schema_history`).

O problema que resolve é trivial de descrever e crítico de errar: *como manter
o schema sincronizado entre máquina do dev, CI e produção, sem aplicar a mesma
mudança duas vezes nem perder nenhuma?*

A resposta do Flyway: **o git é a fonte da verdade do schema**. O banco apenas
reflete o que está versionado.

### Anatomia da `flyway_schema_history`

Tabela criada e gerenciada pelo próprio Flyway no schema `public`:

| installed_rank | version | description | type | script | checksum | installed_by | installed_on | execution_time | success |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | enums | SQL | V1__enums.sql | -1832742091 | postgres | 2026-04-26 14:22:11 | 47 | true |
| 2 | 2 | condominium | SQL | V2__condominium.sql | 982134567 | postgres | 2026-04-26 14:22:11 | 12 | true |
| ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |
| 10 | 10 | composite_foreign_keys | SQL | V10__composite_foreign_keys.sql | 73491823 | postgres | 2026-04-26 14:22:11 | 8 | true |

**`checksum`** é o hash CRC32 do conteúdo do arquivo SQL no momento da
aplicação. Se alguém editar uma migration já aplicada e tentar bootar o app, o
checksum do arquivo no classpath **não bate** com o gravado no histórico, e o
Flyway aborta com `Validate failed: Migration checksum mismatch for migration
version X`.

Esse comportamento é o que garante a invariante "**migrations são
forward-only**": uma vez aplicada, a migration é imutável; corrigir bug = nova
migration.

---

## Os três tipos de migration

### Versioned (`V<n>__nome.sql`) — a maioria

- Roda **exatamente uma vez** por banco
- Ordenadas pelo número da versão
- Schema imutável: editar um arquivo já aplicado quebra o boot

Exemplo:
```
V1__enums.sql                  ← roda na 1ª vez que o banco vê
V2__condominium.sql            ← roda depois de V1
V10__composite_foreign_keys.sql
```

### Repeatable (`R__nome.sql`) — checksum-driven

- Roda **toda vez que o checksum muda**
- Sempre executadas **depois** das versioned, em ordem alfabética
- Útil para objetos idempotentes: views, procedures, e **seeds de dev**

Exemplo no projeto: `R__seed_dev.sql` faz `DELETE` + `INSERT` para repopular
dados de teste. Sempre que o conteúdo muda, o Flyway reexecuta.

### Undo (`U<n>__nome.sql`) — não usado

Feature do **Flyway Teams** (paga). O projeto usa Flyway Community → não há
undo nativo. Estratégia: rollback via migration compensatória (ver §Rollback).

---

## Como — convenções de numeração

O projeto reserva **faixas de versão** para evitar conflitos entre PRs
paralelas (DDL de schema vs. bootstrap de condomínio):

| Faixa | Uso | Exemplo |
|---|---|---|
| `V1` – `V999` | DDL do schema de domínio | `V7__poll_domain.sql` |
| `V1001` – `V1999` | Bootstraps de condomínio (1 arquivo por condomínio) | `V1001__bootstrap_condo_piloto.sql` |
| `V9000+` | Migrations compensatórias (rollback via forward) | `V9042__fix_v42_column_type.sql` |
| `R__*.sql` | Repeatable — só roda em profile `local` | `R__seed_dev.sql` |

**Por que faixas e não numeração contínua:** se um PR de schema (V11) está em
review enquanto outro PR de bootstrap precisa subir urgentemente, ambos
querem "a próxima versão livre". Sem reserva, vão colidir e o segundo a
mergear precisa renumerar — quebrando o checksum se já aplicado em algum dev.

---

## Como — onde cada configuração vive

### `application.yaml` (default — usado em prod e CI)

```yaml
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration   # somente migrations versioned
    baseline-on-migrate: true
    baseline-version: 0
    validate-on-migrate: true
    out-of-order: false
```

| Config | O que faz | Por que assim |
|---|---|---|
| `enabled: true` | Liga o auto-configure do Spring Boot | Default. Explicitar evita "ah, achei que estava ligado" |
| `locations: classpath:db/migration` | Onde procurar `V*.sql` e `R*.sql` | **Não inclui `db/seed`** — seed jamais roda em prod |
| `baseline-on-migrate: true` + `baseline-version: 0` | Se o banco existe mas não tem `flyway_schema_history`, cria a tabela e marca a baseline na versão 0 | Necessário no primeiro deploy contra um Supabase já com `auth.users`. Sem isto, Flyway aborta porque o schema não está vazio |
| `validate-on-migrate: true` | Compara checksum do classpath com o gravado | Detecta edição em migration já aplicada — falha cedo |
| `out-of-order: false` | Migrations devem rodar em ordem estrita de versão | Evita armadilha do tipo "V11 mergeada antes de V10 ser aplicada em prod" |

### `application-local.yaml` (perfil de dev)

```yaml
spring:
  flyway:
    locations:
      - classpath:db/migration
      - classpath:db/seed       # <-- ATIVA o R__seed_dev.sql
```

A única diferença é incluir `db/seed`. Esse diretório contém
`R__seed_dev.sql`, que apaga e repopula dados de teste a cada vez que o
checksum muda. **Jamais** adicionar `db/seed` em `application.yaml` — em prod
isso apagaria o condomínio piloto.

### `pom.xml` — dependências

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-flyway</artifactId>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-database-postgresql</artifactId>
</dependency>
```

A segunda dependência é **obrigatória no Flyway 10+**: o suporte a Postgres
foi extraído do core. Sem ela: `No database found to handle jdbc:postgresql://...`.

---

## Quando — o ciclo de vida exato

### Cenário 1 — `./mvnw spring-boot:run` em máquina nova

```
1. Spring Boot inicia → DataSource configurado pelo auto-configure
2. FlywayAutoConfiguration cria o bean Flyway, lendo spring.flyway.*
3. Flyway.migrate() é chamado ANTES de Hibernate/EntityManager
4. Flyway lê classpath:db/migration → descobre V1..V10 + R__seed_dev (se local)
5. SELECT * FROM flyway_schema_history → tabela não existe
6. baseline-on-migrate=true → cria tabela, insere baseline (version=0)
7. Aplica V1, V2, ... V10 em ordem; INSERT em flyway_schema_history a cada
8. Aplica R__seed_dev.sql (se local)
9. Spring continua: cria EntityManager, levanta Tomcat, etc.
```

### Cenário 2 — restart após código novo (sem migration nova)

```
1..3. (igual)
4. Flyway descobre V1..V10 no classpath
5. SELECT * FROM flyway_schema_history → V1..V10 todas marcadas success
6. Para cada migration: hash do arquivo == checksum gravado? sim → skip
7. R__seed_dev.sql: hash mudou? sim → reexecuta. não → skip
8. Spring continua
```

### Cenário 3 — desenvolvedor adiciona V11

```
1..3. (igual)
4. Flyway descobre V1..V11
5. SELECT * FROM flyway_schema_history → V1..V10 marcadas
6. V1..V10: checksums batem → skip
7. V11: ainda não aplicada → executa, INSERT em flyway_schema_history
8. R__seed_dev.sql: roda se hash mudou
9. Spring continua
```

### Cenário 4 — alguém editou V5 já aplicada (proibido)

```
1..3. (igual)
4. Flyway descobre V1..V10
5. SELECT * FROM flyway_schema_history → V5 marcada com checksum X
6. V5 no classpath tem checksum Y ≠ X
7. validate-on-migrate=true → ABORTA com:
   "Validate failed: Migration checksum mismatch for migration version 5"
8. Spring NÃO sobe. Único caminho: reverter o arquivo ou criar V9005__fix.sql
```

### Cenário 5 — testes de integração (`./mvnw verify`)

```
1. Testcontainers sobe PostgreSQL container efêmero
2. AbstractIntegrationTest configura DataSource apontando para o container
3. Spring Boot Test inicia → Flyway aplica V1..V10 do zero
4. Testes rodam contra schema real (RlsIsolationIT testa policies)
5. Container morre ao fim da suite
```

Esse cenário é o que garante que **a migration testada localmente é a mesma
que vai rodar em prod**. Não há "schema sincronizado por JPA auto-DDL" — o
artefato testado é o SQL versionado.

---

## Particularidades do projeto

### 1. UUID v7 — sem `DEFAULT gen_random_uuid()`

As migrations **não** declaram `DEFAULT gen_random_uuid()` em colunas PK. O
projeto adota UUID v7 (RFC 9562) como padrão, gerado pela aplicação via
Hibernate `@UuidGenerator(style = TIME)`. INSERT sem ID falha cedo em vez de
silenciosamente gerar v4.

Para SQL puro (seed `R__seed_dev.sql` e bootstraps `V1001+`), os UUIDs são
gerados offline (`python3 -c "import uuid; print(uuid.uuid7())"`) e
hardcodados. Comentário inline com a data de geração para rastreabilidade.

Única exceção: `app_user.id` herda do Supabase Auth (UUID v4).

### 2. RLS habilitada na mesma migration que cria a tabela

Regra inegociável: cada tabela com `condominium_id` nasce com RLS na mesma
migration. Não existe "adicionar RLS depois". `V9__rls_policies.sql` agrupa
todas as policies do schema inicial — em migrations futuras, a RLS da nova
tabela acompanha o `CREATE TABLE`.

### 3. `auth.*` é gerenciado pelo Supabase, não pelo Flyway

O schema `auth` do Supabase (tabelas `auth.users`, `auth.identities`, etc.) é
gerenciado pelo GoTrue — Flyway **nunca** toca nele. Migrations versionadas
operam exclusivamente no schema `public`. Ver `auth-flow.md` para o fluxo
completo de autenticação.

### 4. Seed de dev via repeatable migration

`R__seed_dev.sql` faz `DELETE` + `INSERT` para repopular dados de teste
(condomínio + síndico + apartamentos). Como é repeatable:

- Roda toda vez que o conteúdo do arquivo muda
- Ordem dos `DELETE` respeita FKs (filhos antes dos pais)
- UUIDs hardcoded — mesmos UUIDs em cada execução, queries de teste
  determinísticas

Em prod, o diretório `db/seed` **nunca** é incluído nas `locations`, então
esse arquivo é invisível.

### 5. Bootstrap de condomínio = migration `V1001+`

Criar um novo condomínio + síndico em prod **não** é operação ad-hoc no
Studio. É uma migration `V1001__bootstrap_<condo>.sql` versionada via PR. O
mesmo Flyway que aplica DDL aplica o bootstrap — auditável via git, revisável
via PR, reproduzível em local/CI/prod. Ver `docs/architecture.md §1` e
runbook em `docs/runbooks/bootstrap-condominio.md`.

### 6. Migrations rodam no startup do Spring (v1)

Decisão consciente: na v1 (1-3 devs), Flyway roda automaticamente quando o
Spring sobe. Quando o time crescer (≥3 devs ou múltiplas instâncias rodando
simultaneamente), migrar para **CI-driven**: pipeline aplica migrations antes
do deploy, app sobe com `spring.flyway.enabled=false`. Evita race condition
de duas instâncias tentando aplicar a mesma migration ao mesmo tempo.

---

## Estratégia de rollback

Flyway Community não tem undo nativo. Política do projeto:

### Migrations são forward-only

Nunca editar uma migration já aplicada — mesmo que ainda não tenha saído do
`develop`. Se outro dev aplicou localmente, a edição vai gerar `checksum
mismatch` no boot dele.

### Correção de bug = nova migration compensatória

```
V42__add_column.sql            ← errou o tipo
V9042__fix_v42_column_type.sql ← corrige forward
```

Faixa `V9000+` reservada para isso. Naming convencional:
`V9<original>__fix_<descrição>.sql` para rastreabilidade.

### Migrations destrutivas seguem ritual

`DROP TABLE`, `DROP COLUMN`, `ALTER ... TYPE` que perde dados:

1. PR dedicado (nunca junto com feature)
2. Review por 2 devs (em vez de 1)
3. Backup manual do Supabase **antes** do deploy (Dashboard → Backups → "Create backup")
4. Janela fora do horário de uso do piloto
5. Migration compensatória pronta no branch (não recupera dados, mas restaura schema)

### Rollback de aplicação ≠ rollback de banco

Se o deploy do Spring quebrar pós-migration, Coolify faz rollback do container
mas **a migration permanece aplicada**. Por isso:

- **Toda mudança de schema deve ser forward-compatible com o app N-1**
- Mudanças destrutivas ficam em **duas fases**: (1) adicionar coluna nullable
  → deploy → app popula → (2) PR posterior torna `NOT NULL` e remove código
  legado

---

## Comandos úteis

```bash
# Aplicar migrations contra o Supabase local (sem subir Spring inteiro)
cd backend && ./mvnw flyway:migrate

# Ver estado das migrations (aplicadas, pendentes, com checksum mismatch)
cd backend && ./mvnw flyway:info

# Validar checksums sem aplicar nada
cd backend && ./mvnw flyway:validate

# Inspecionar histórico direto no Postgres
psql "$DATABASE_URL" -c "SELECT installed_rank, version, description, success, installed_on FROM flyway_schema_history ORDER BY installed_rank;"

# Quando pisar feio em dev local: começar do zero
cd infra/supabase && supabase db reset
# (resetar o Supabase local recria auth.* e dispara o seed.sql do CLI;
#  o Flyway reaplica V1..V10 + R__seed_dev no próximo boot do Spring)
```

---

## Recapitulando — o quê, como, quando

**O quê.** Flyway é o versionador de schema do projeto: cada mudança no banco
é um arquivo SQL no git, executado uma única vez por banco, com checksum para
garantir imutabilidade.

**Como.** Versioned migrations (`V<n>__`) para DDL e bootstraps; repeatable
(`R__`) para seed de dev. Numeração reservada por faixas (`V1-V999` schema,
`V1001+` bootstrap, `V9000+` compensatória). RLS sempre na mesma migration
que cria a tabela. UUIDs gerados pela app, não pelo banco. `auth.*` fica fora
— é território do Supabase/GoTrue.

**Quando.** No startup do Spring Boot (v1), antes de Hibernate/Tomcat. O
mesmo SQL roda em local (Supabase CLI), CI (Postgres Testcontainer) e prod
(Supabase Cloud) — o artefato versionado é a única fonte da verdade do
schema.
