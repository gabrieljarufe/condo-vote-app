import { UserRoleInCondo } from '../../core/api/me-api.service';

/**
 * Lógica compartilhada do "chip de papel" — rótulo visual e aria-label dos
 * papéis do usuário no condomínio ativo. Reutilizado por `AppHeader` (desktop)
 * e `BottomNav` (sheet "Mais" no mobile) para não duplicar regra/ordenação.
 */

export const ROLE_LABELS_PT_BR: Record<UserRoleInCondo, string> = {
  ADMIN: 'Síndico',
  OWNER: 'Proprietário',
  TENANT: 'Inquilino',
};

// Ordem canônica ADMIN → OWNER → TENANT para gerar labels estáveis
// (ex.: "Síndico · Proprietário", nunca "Proprietário · Síndico"),
// independente da ordem de inserção no Set de papéis.
const CANONICAL_ORDER = ['ADMIN', 'OWNER', 'TENANT'] as const;

export function getOrderedRoles(
  roles: ReadonlySet<UserRoleInCondo>,
): readonly UserRoleInCondo[] {
  return CANONICAL_ORDER.filter((r) => roles.has(r));
}

/** Texto visual do chip (ex.: "Síndico · Proprietário"), ou `null` se sem papéis. */
export function getRoleChipLabel(roles: ReadonlySet<UserRoleInCondo>): string | null {
  const ordered = getOrderedRoles(roles);
  if (ordered.length === 0) return null;
  return ordered.map((r) => ROLE_LABELS_PT_BR[r]).join(' · ');
}

/** Rótulo para leitor de tela, usando "e" como conjunção natural. `null` se sem papéis. */
export function getRoleChipAriaLabel(roles: ReadonlySet<UserRoleInCondo>): string | null {
  const ordered = getOrderedRoles(roles);
  if (ordered.length === 0) return null;
  const names = ordered.map((r) => ROLE_LABELS_PT_BR[r]);
  const joined =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
  return `Seus papéis neste condomínio: ${joined}`;
}
