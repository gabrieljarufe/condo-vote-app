-- Composite FKs adicionadas em migration separada para facilitar revisão.
-- Garantem que apartment_id + condominium_id em tabelas filhas apontam para
-- o mesmo par na tabela pai — defesa contra mismatch silencioso de tenant.
-- As constraints UNIQUE (id, condominium_id) em apartment e poll foram criadas
-- em V4 e V7 respectivamente para suportar estas FKs.

ALTER TABLE apartment_resident
    ADD CONSTRAINT fk_apartment_resident_apartment_tenant
        FOREIGN KEY (apartment_id, condominium_id) REFERENCES apartment (id, condominium_id);

ALTER TABLE invitation
    ADD CONSTRAINT fk_invitation_apartment_tenant
        FOREIGN KEY (apartment_id, condominium_id) REFERENCES apartment (id, condominium_id);

ALTER TABLE poll_eligible_snapshot
    ADD CONSTRAINT fk_poll_eligible_snapshot_poll_tenant
        FOREIGN KEY (poll_id, condominium_id) REFERENCES poll (id, condominium_id);

ALTER TABLE poll_eligible_snapshot
    ADD CONSTRAINT fk_poll_eligible_snapshot_apartment_tenant
        FOREIGN KEY (apartment_id, condominium_id) REFERENCES apartment (id, condominium_id);

ALTER TABLE vote
    ADD CONSTRAINT fk_vote_poll_tenant
        FOREIGN KEY (poll_id, condominium_id) REFERENCES poll (id, condominium_id);

ALTER TABLE vote
    ADD CONSTRAINT fk_vote_apartment_tenant
        FOREIGN KEY (apartment_id, condominium_id) REFERENCES apartment (id, condominium_id);
