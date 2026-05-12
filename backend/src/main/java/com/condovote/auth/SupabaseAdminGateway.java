package com.condovote.auth;

import java.util.UUID;

/**
 * Cria usuários no Supabase Auth (GoTrue) usando a Admin API com {@code SERVICE_ROLE_KEY}.
 *
 * <p>Apropriado para fluxo de onboarding via convite (H4): backend cria o {@code auth.users}
 * server-side, com {@code email_confirm=true}, sem passar pelo signup público.
 */
public interface SupabaseAdminGateway {

  /**
   * Cria usuário com e-mail e senha; e-mail já confirmado. Retorna o UUID do usuário criado.
   *
   * @throws SupabaseAdminException se a API responder não-2xx ou o body for inesperado
   */
  UUID createUser(String email, String password);
}
