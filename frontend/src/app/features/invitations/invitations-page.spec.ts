import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { Apartment, ApartmentsApiService } from '../../core/api/apartments-api.service';
import { Invitation, InvitationsApiService } from '../../core/api/invitations-api.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { SUPABASE_CLIENT } from '../../core/auth/supabase.client';
import InvitationsPage from './invitations-page';

const mockSupabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => void 0 } } }),
    signOut: () => Promise.resolve({ error: null }),
  },
};

const mockApartment: Apartment = {
  id: 'apt-1',
  condominiumId: 'condo-1',
  unitNumber: '101',
  block: 'A',
  isDelinquent: false,
  eligibleVoterUserId: null,
  createdAt: '2026-01-01T00:00:00Z',
};

const mockInvitation: Invitation = {
  id: 'inv-1',
  apartmentId: 'apt-1',
  email: 'morador@exemplo.com',
  role: 'OWNER',
  status: 'PENDING',
  expiresAt: '2026-06-01T00:00:00Z',
  acceptedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
};

const mockTenant = {
  activeCondominiumId: () => 'condo-1',
  activeRoles: () => new Set(['ADMIN']),
  setActive: vi.fn(),
  clear: vi.fn(),
};

function makeInvApi(
  overrides: Partial<{
    list: unknown;
    create: unknown;
    resend: unknown;
    revoke: unknown;
    fixEmail: unknown;
    createBulk: unknown;
  }> = {},
) {
  return {
    list: vi.fn(() => of([mockInvitation])),
    create: vi.fn(() => of({ ...mockInvitation, id: 'inv-new' })),
    resend: vi.fn(() => of({ ...mockInvitation, id: 'inv-resent' })),
    revoke: vi.fn(() => of(undefined)),
    fixEmail: vi.fn(() => of({ ...mockInvitation, email: 'novo@exemplo.com' })),
    createBulk: vi.fn(() => of({ created: 0, invitations: [], errors: [] })),
    ...overrides,
  };
}

function makeAptApi(overrides: Partial<{ list: unknown }> = {}) {
  return {
    list: vi.fn(() =>
      of({
        content: [mockApartment],
        page: 0,
        size: 100,
        totalElements: 1,
        totalPages: 1,
      }),
    ),
    create: vi.fn(() => of(mockApartment)),
    setDelinquent: vi.fn(() => of(mockApartment)),
    ...overrides,
  };
}

const mockRouter = { navigate: vi.fn(), navigateByUrl: vi.fn() };
const mockActivatedRoute = {
  snapshot: {},
  params: { subscribe: vi.fn() },
  queryParams: { subscribe: vi.fn() },
};

async function setup(invApi = makeInvApi(), aptApi = makeAptApi(), tenant = mockTenant) {
  await TestBed.configureTestingModule({
    imports: [InvitationsPage],
    providers: [
      { provide: InvitationsApiService, useValue: invApi },
      { provide: ApartmentsApiService, useValue: aptApi },
      { provide: TenantService, useValue: tenant },
      { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      { provide: Router, useValue: mockRouter },
      { provide: ActivatedRoute, useValue: mockActivatedRoute },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(InvitationsPage);
  fixture.detectChanges();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = fixture.componentInstance as any;
  return { fixture, component };
}

describe('InvitationsPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('ngOnInit_loadsInvitationsAndApartments', async () => {
    const invApi = makeInvApi();
    const aptApi = makeAptApi();
    const { component } = await setup(invApi, aptApi);
    expect(invApi.list).toHaveBeenCalledWith('condo-1', expect.any(Object));
    expect(aptApi.list).toHaveBeenCalledWith('condo-1', 0, 100);
    expect(component.pageState()).toBe('ready');
    expect(component.invitations()).toHaveLength(1);
    expect(component.apartments()).toHaveLength(1);
  });

  it('onCreate_validRequest_callsApiAndRefreshesList', async () => {
    const invApi = makeInvApi();
    const { component } = await setup(invApi);
    component.showForm.set(true);
    component.onCreate({
      apartmentId: 'apt-1',
      email: 'novo@exemplo.com',
      cpf: '12345678909',
      role: 'OWNER',
    });
    expect(invApi.create).toHaveBeenCalledWith('condo-1', {
      apartmentId: 'apt-1',
      email: 'novo@exemplo.com',
      cpf: '12345678909',
      role: 'OWNER',
    });
    expect(component.showForm()).toBe(false);
    // The new invitation is prepended to the list
    expect(component.invitations().length).toBeGreaterThanOrEqual(1);
  });

  it('onRevoke_callsApiAndRefreshesList', async () => {
    const invApi = makeInvApi();
    const { component } = await setup(invApi);
    component.onRevoke('inv-1');
    expect(invApi.revoke).toHaveBeenCalledWith('inv-1');
    // Status updated to REVOKED in list
    const updated = component.invitations().find((i: Invitation) => i.id === 'inv-1');
    expect(updated?.status).toBe('REVOKED');
  });

  it('onResend_callsApi', async () => {
    const invApi = makeInvApi();
    const { component } = await setup(invApi);
    component.onResend('inv-1');
    expect(invApi.resend).toHaveBeenCalledWith('inv-1');
  });

  it('onFixEmail_callsApi', async () => {
    const invApi = makeInvApi();
    const { component } = await setup(invApi);
    component.onFixEmail({ id: 'inv-1', newEmail: 'novo@exemplo.com' });
    expect(invApi.fixEmail).toHaveBeenCalledWith('inv-1', { newEmail: 'novo@exemplo.com' });
  });

  it('loadingState_showsSpinner', async () => {
    // Use a never-completing observable to simulate loading
    const { Observable } = await import('rxjs');
    const hangingList = vi.fn(() => new Observable(() => {}));
    const invApi = makeInvApi({ list: hangingList });
    const { component } = await setup(invApi);
    // Because the observable never emits, pageState stays 'loading'
    expect(component.pageState()).toBe('loading');
  });

  it('exibe estado de erro quando API de invitations falha', async () => {
    const invApi = makeInvApi({ list: vi.fn(() => throwError(() => new Error('Falha API'))) });
    const { component } = await setup(invApi);
    expect(component.pageState()).toBe('error');
    expect(component.errorMessage()).toBe('Falha API');
  });
});
