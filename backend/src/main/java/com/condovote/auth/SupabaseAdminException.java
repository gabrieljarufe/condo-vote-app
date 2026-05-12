package com.condovote.auth;

/** Falha ao invocar Supabase Admin API. */
public class SupabaseAdminException extends RuntimeException {

  public SupabaseAdminException(String message) {
    super(message);
  }

  public SupabaseAdminException(String message, Throwable cause) {
    super(message, cause);
  }
}
