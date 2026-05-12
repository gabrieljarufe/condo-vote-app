import { Component, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { Apartment, ApartmentsApiService } from '../../../core/api/apartments-api.service';
import {
  BulkInvitationEntry,
  BulkResultResponse,
  InvitationsApiService,
} from '../../../core/api/invitations-api.service';
import { TenantService } from '../../../core/tenant/tenant.service';
import { SUPABASE_CLIENT } from '../../../core/auth/supabase.client';
import InvitationBulkPage from './invitation-bulk-page';
import { AppHeader } from '../../../shared/layout/app-header';
import { InvitationBulkUploadForm, ParsedRow } from './invitation-bulk-upload-form';
import { InvitationBulkPreviewGrid } from './invitation-bulk-preview-grid';

@Component({ selector: 'app-app-header', template: '', standalone: true })
class AppHeaderStub {}

@Component({ selector: 'app-invitation-bulk-upload-form', template: '', standalone: true })
class UploadFormStub {
  readonly parsed = output<ParsedRow[]>();
  readonly cancel = output<void>();
}

@Component({ selector: 'app-invitation-bulk-preview-grid', template: '', standalone: true })
class PreviewGridStub {
  readonly rows = input<ParsedRow[]>([]);
  readonly apartments = input<readonly Apartment[]>([]);
  readonly disabled = input<boolean>(false);
  readonly back = output<void>();
  readonly cancel = output<void>();
  readonly submitBatch = output<BulkInvitationEntry[]>();
}

const mockSupabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => void 0 } } }),
    signOut: () => Promise.resolve({ error: null }),
  },
};

const mockTenant = {
  activeCondominiumId: () => 'condo-1',
  activeRoles: () => new Set(['ADMIN']),
  setActive: vi.fn(),
  clear: vi.fn(),
};

const mockRouter = { navigate: vi.fn(), navigateByUrl: vi.fn() };
const mockActivatedRoute = {
  snapshot: {},
  params: { subscribe: vi.fn() },
  queryParams: { subscribe: vi.fn() },
};

const sampleParsedRows: ParsedRow[] = [
  { rowIndex: 2, email: 'a@b.com', cpf: '12345678909', block: 'A', unitNumber: '101', role: 'OWNER', errors: [] },
  { rowIndex: 3, email: 'c@d.com', cpf: '98765432100', block: 'A', unitNumber: '102', role: 'TENANT', errors: [] },
];

const sampleEntries: BulkInvitationEntry[] = [
  { email: 'a@b.com', cpf: '12345678909', block: 'A', unitNumber: '101', role: 'OWNER' },
  { email: 'c@d.com', cpf: '98765432100', block: 'A', unitNumber: '102', role: 'TENANT' },
];

const successResponse: BulkResultResponse = {
  created: 2,
  invitations: [],
  errors: [],
};

function makeInvApi(overrides: Partial<{ createBulk: unknown }> = {}) {
  return {
    list: vi.fn(() => of([])),
    create: vi.fn(() => of({})),
    createBulk: vi.fn(() => of(successResponse)),
    resend: vi.fn(() => of({})),
    revoke: vi.fn(() => of(undefined)),
    fixEmail: vi.fn(() => of({})),
    ...overrides,
  };
}

function makeAptApi() {
  return {
    list: vi.fn(() => of([])),
    create: vi.fn(() => of({})),
    setDelinquent: vi.fn(() => of({})),
  };
}

async function setup(invApi = makeInvApi(), tenant = mockTenant) {
  await TestBed.configureTestingModule({
    imports: [InvitationBulkPage],
    providers: [
      { provide: InvitationsApiService, useValue: invApi },
      { provide: ApartmentsApiService, useValue: makeAptApi() },
      { provide: TenantService, useValue: tenant },
      { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      { provide: Router, useValue: mockRouter },
      { provide: ActivatedRoute, useValue: mockActivatedRoute },
    ],
  })
    .overrideComponent(InvitationBulkPage, {
      set: {
        imports: [AppHeaderStub, RouterLink, UploadFormStub, PreviewGridStub],
      },
    })
    .compileComponents();

  const fixture = TestBed.createComponent(InvitationBulkPage);
  fixture.detectChanges();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = fixture.componentInstance as any;
  return { fixture, component };
}

describe('InvitationBulkPage', () => {
  beforeEach(() => {
    mockRouter.navigate.mockClear();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('step1Initially_uploadForm', async () => {
    const { component } = await setup();
    expect(component.step()).toBe('upload');
    expect(component.parsedRows()).toEqual([]);
  });

  it('onParsed_transitionsToPreview', async () => {
    const { component } = await setup();
    expect(component.step()).toBe('upload');
    component.onParsed(sampleParsedRows);
    expect(component.step()).toBe('preview');
    expect(component.parsedRows()).toEqual(sampleParsedRows);
  });

  it('onSubmit_callsApi_andOnSuccessRedirects', async () => {
    vi.useFakeTimers();
    const invApi = makeInvApi({ createBulk: vi.fn(() => of(successResponse)) });
    const { component } = await setup(invApi);
    component.step.set('preview');
    component.onSubmit(sampleEntries);
    expect(invApi.createBulk).toHaveBeenCalledWith('condo-1', { entries: sampleEntries });
    expect(component.submitStatus()).toBe('success');
    vi.advanceTimersByTime(1500);
    expect(mockRouter.navigate).toHaveBeenCalledWith([
      '/app/condominiums',
      'condo-1',
      'invitations',
    ]);
    vi.useRealTimers();
  });

  it('onSubmit_backendReturnsErrors_appliesErrorsToRows', async () => {
    const responseWithErrors: BulkResultResponse = {
      created: 0,
      invitations: [],
      errors: [
        { rowIndex: 2, field: 'email', message: 'E-mail já utilizado' },
      ],
    };
    const invApi = makeInvApi({ createBulk: vi.fn(() => of(responseWithErrors)) });
    const { component } = await setup(invApi);
    component.step.set('preview');
    component.parsedRows.set(sampleParsedRows);
    component.onSubmit(sampleEntries);
    expect(component.submitStatus()).toBe('error');
    const row2 = component.parsedRows().find((r: ParsedRow) => r.rowIndex === 2);
    expect(row2?.errors).toContain('E-mail já utilizado');
  });

  it('onSubmit_httpError_setsErrorStatus', async () => {
    const invApi = makeInvApi({
      createBulk: vi.fn(() => throwError(() => new Error('Erro de rede'))),
    });
    const { component } = await setup(invApi);
    component.step.set('preview');
    component.onSubmit(sampleEntries);
    expect(component.submitStatus()).toBe('error');
    expect(component.submitError()).toBe('Erro de rede');
  });

  it('navigateToInvitations navega para a rota correta', async () => {
    const { component } = await setup();
    component.navigateToInvitations();
    expect(mockRouter.navigate).toHaveBeenCalledWith([
      '/app/condominiums',
      'condo-1',
      'invitations',
    ]);
  });
});
