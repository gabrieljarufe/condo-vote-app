-- pgcrypto: utilitários criptográficos. PKs UUID v7 são geradas pela aplicação
-- (Hibernate @UuidGenerator(style = TIME)), não pelo banco. Migrations futuras
-- não declaram DEFAULT gen_random_uuid() em colunas PK — INSERT sem ID falha
-- cedo em vez de gerar v4 silencioso. Ver docs/data-model.md "UUID v7 como
-- padrão do projeto".
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Moradores
CREATE TYPE resident_role AS ENUM ('OWNER', 'TENANT');

CREATE TYPE resident_end_reason AS ENUM (
    'REMOVED_BY_ADMIN',
    'PROMOTED_TO_OWNER'
);

-- Votações
CREATE TYPE convocation_type AS ENUM ('FIRST', 'SECOND');

CREATE TYPE quorum_mode AS ENUM (
    'SIMPLE_MAJORITY',
    'ABSOLUTE_MAJORITY',
    'QUALIFIED_2_3',
    'QUALIFIED_3_4'
);

CREATE TYPE poll_status AS ENUM (
    'DRAFT',
    'SCHEDULED',
    'OPEN',
    'CLOSED',
    'CANCELLED',
    'INVALIDATED'
);

CREATE TYPE poll_invalidation_reason AS ENUM (
    'PRESENCE_QUORUM_NOT_REACHED',
    'NO_OPTION_REACHED_THRESHOLD'
);

CREATE TYPE poll_close_trigger AS ENUM (
    'AUTOMATIC_END_TIME',
    'AUTOMATIC_ALL_VOTED'
);

-- Convites
CREATE TYPE invitation_status AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REVOKED',
    'EXPIRED',
    'BOUNCED'
);

-- Auditoria
CREATE TYPE audit_event_type AS ENUM (
    'POLL_CREATED',
    'POLL_SCHEDULED',
    'POLL_OPENED_MANUALLY',
    'POLL_CLOSED',
    'POLL_INVALIDATED',
    'POLL_CANCELLED',
    'INVITATION_SENT',
    'INVITATION_REVOKED',
    'INVITATION_ACCEPTED',
    'ADMIN_GRANTED',
    'ADMIN_REVOKED',
    'APARTMENT_CREATED',
    'APARTMENT_DELINQUENCY_CHANGED',
    'APARTMENT_VOTER_CHANGED',
    'RESIDENT_JOINED',
    'RESIDENT_REMOVED',
    'RESIDENT_PROMOTED_TO_OWNER'
);

-- Notificações
CREATE TYPE email_type AS ENUM (
    'INVITATION',
    'POLL_SCHEDULED',
    'POLL_OPENED',
    'POLL_REMINDER_24H',
    'POLL_CLOSED_RESULT',
    'POLL_INVALIDATED',
    'POLL_CANCELLED',
    'PASSWORD_RESET'
);

CREATE TYPE email_status AS ENUM (
    'PENDING',
    'SENT',
    'FAILED',
    'BOUNCED'
);
