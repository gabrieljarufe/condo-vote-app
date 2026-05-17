-- Adiciona valor ao enum para rastrear quando eligible_voter_user_id é definido/alterado.
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'APARTMENT_ELIGIBLE_VOTER_SET';

-- Backfill: garante a invariante do eligible_voter_user_id (condo-vote-principles.md §4)
-- para apartamentos criados antes do fix do OnboardingService.
-- Regra v1: apartment com OWNER ativo e sem eligible_voter_user_id definido
-- recebe o user_id do OWNER. Delegação (H6) virá com sua própria migration.
UPDATE apartment a
   SET eligible_voter_user_id = ar.user_id
  FROM apartment_resident ar
 WHERE ar.apartment_id = a.id
   AND ar.role = 'OWNER'
   AND ar.ended_at IS NULL
   AND a.eligible_voter_user_id IS NULL;
