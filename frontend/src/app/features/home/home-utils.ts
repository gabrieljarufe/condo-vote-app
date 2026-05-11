import { UserRoleInCondo } from '../../core/api/me-api.service';

export function rolesLabel(roles: readonly UserRoleInCondo[]): string {
  return roles.map(singleRoleLabel).join(' · ');
}

function singleRoleLabel(role: UserRoleInCondo): string {
  switch (role) {
    case 'ADMIN': return 'Síndico';
    case 'OWNER': return 'Proprietário';
    case 'TENANT': return 'Inquilino';
  }
}
