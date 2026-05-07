package com.condovote.shared.tenant;

import java.util.UUID;

public final class TenantContext {

  private static final ThreadLocal<UUID> HOLDER = new ThreadLocal<>();

  public static void set(UUID tenantId) {
    HOLDER.set(tenantId);
  }

  public static UUID get() {
    return HOLDER.get();
  }

  public static void clear() {
    HOLDER.remove();
  }

  private TenantContext() {}
}
