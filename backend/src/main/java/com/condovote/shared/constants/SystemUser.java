package com.condovote.shared.constants;

import java.util.UUID;

/**
 * UUID reservado para ações automáticas do sistema (jobs @Scheduled). Usado como actor_user_id em
 * audit_event quando não há síndico humano executando. Documentado em docs/data-model.md
 * §SystemUser.
 */
public final class SystemUser {
  public static final UUID ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

  private SystemUser() {}
}
