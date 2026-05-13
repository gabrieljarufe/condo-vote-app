import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { Apartment } from '../../core/api/apartments-api.service';
import { Invitation, InvitationStatus } from '../../core/api/invitations-api.service';

function statusLabel(status: InvitationStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Pendente';
    case 'ACCEPTED':
      return 'Aceito';
    case 'REVOKED':
      return 'Revogado';
    case 'EXPIRED':
      return 'Expirado';
    case 'BOUNCED':
      return 'Rebounced';
  }
}

function statusClass(status: InvitationStatus): string {
  switch (status) {
    case 'PENDING':
      return 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800';
    case 'ACCEPTED':
      return 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800';
    case 'BOUNCED':
      return 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800';
    case 'EXPIRED':
      return 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500';
    case 'REVOKED':
      return 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-400 line-through';
  }
}

function roleLabel(role: string): string {
  return role === 'OWNER' ? 'Proprietário' : 'Inquilino';
}

function expiresLabel(inv: Invitation): string {
  if (inv.status !== 'PENDING') return '—';
  const diff = new Date(inv.expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expirado';
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'em menos de 1h';
  return `em ${hours}h`;
}

@Component({
  selector: 'app-invitation-list',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (invitations().length === 0) {
      <p class="text-sm text-on-surface-variant py-4 text-center">
        Nenhum convite encontrado.
      </p>
    } @else {
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-outline-variant text-left text-on-surface-variant">
              <th class="py-2 pr-4 font-medium">Apartamento</th>
              <th class="py-2 pr-4 font-medium">E-mail</th>
              <th class="py-2 pr-4 font-medium">Papel</th>
              <th class="py-2 pr-4 font-medium">Status</th>
              <th class="py-2 pr-4 font-medium">Expira em</th>
              <th class="py-2 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            @for (inv of invitations(); track inv.id) {
              <tr class="border-b border-outline-variant/50 hover:bg-surface-container-low">
                <td class="py-3 pr-4 font-medium whitespace-nowrap">{{ aptLabel(inv.apartmentId) }}</td>
                <td class="py-3 pr-4 truncate max-w-[180px]">{{ inv.email }}</td>
                <td class="py-3 pr-4 whitespace-nowrap">{{ roleLabel(inv.role) }}</td>
                <td class="py-3 pr-4">
                  <span [class]="statusClass(inv.status)">{{ statusLabel(inv.status) }}</span>
                </td>
                <td class="py-3 pr-4 whitespace-nowrap text-on-surface-variant">{{ expiresLabel(inv) }}</td>
                <td class="py-3">
                  <div class="flex items-center gap-2 flex-wrap">
                    @if (inv.status === 'PENDING' || inv.status === 'EXPIRED') {
                      <button
                        type="button"
                        (click)="resend.emit(inv.id)"
                        class="text-xs text-secondary hover:underline whitespace-nowrap"
                      >
                        Reenviar
                      </button>
                    }
                    @if (inv.status === 'PENDING') {
                      <button
                        type="button"
                        (click)="revoke.emit(inv.id)"
                        class="text-xs text-error hover:underline whitespace-nowrap"
                      >
                        Revogar
                      </button>
                    }
                    @if (inv.status === 'BOUNCED') {
                      @if (fixEmailOpenId() === inv.id) {
                        <div class="flex items-center gap-1">
                          <input
                            type="email"
                            [formControl]="fixEmailControl"
                            placeholder="Novo e-mail"
                            class="px-2 py-1 rounded border border-outline-variant text-xs bg-surface-container-lowest text-on-surface focus:border-secondary"
                          />
                          <button
                            type="button"
                            [disabled]="fixEmailControl.invalid"
                            (click)="submitFixEmail(inv.id)"
                            class="text-xs text-secondary hover:underline disabled:opacity-50 whitespace-nowrap"
                          >
                            Reenviar
                          </button>
                          <button
                            type="button"
                            (click)="fixEmailOpenId.set(null)"
                            class="text-xs text-on-surface-variant hover:underline whitespace-nowrap"
                          >
                            Cancelar
                          </button>
                        </div>
                      } @else {
                        <button
                          type="button"
                          (click)="openFixEmail(inv.id)"
                          class="text-xs text-secondary hover:underline whitespace-nowrap"
                        >
                          Corrigir e-mail
                        </button>
                        <button
                          type="button"
                          (click)="revoke.emit(inv.id)"
                          class="text-xs text-error hover:underline whitespace-nowrap"
                        >
                          Revogar
                        </button>
                      }
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class InvitationList {
  readonly apartments = input<readonly Apartment[]>([]);
  readonly invitations = input<readonly Invitation[]>([]);

  readonly resend = output<string>();
  readonly revoke = output<string>();
  readonly fixEmail = output<{ id: string; newEmail: string }>();

  protected readonly fixEmailOpenId = signal<string | null>(null);
  protected readonly fixEmailControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });

  protected readonly statusLabel = statusLabel;
  protected readonly statusClass = statusClass;
  protected readonly roleLabel = roleLabel;
  protected readonly expiresLabel = expiresLabel;

  protected aptLabel(apartmentId: string): string {
    const apt = this.apartments().find((a) => a.id === apartmentId);
    if (!apt) return apartmentId.slice(0, 8) + '…';
    return apt.block ? `Bloco ${apt.block} · ${apt.unitNumber}` : apt.unitNumber;
  }

  protected openFixEmail(id: string): void {
    this.fixEmailOpenId.set(id);
    this.fixEmailControl.reset('');
  }

  protected submitFixEmail(id: string): void {
    if (this.fixEmailControl.invalid) return;
    this.fixEmail.emit({ id, newEmail: this.fixEmailControl.getRawValue() });
    this.fixEmailOpenId.set(null);
  }
}
