import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import {
  Invitation,
  InvitationsApiService,
  CreateInvitationRequest,
  BulkCreateRequest,
  BulkResultResponse,
} from './invitations-api.service';

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

describe('InvitationsApiService', () => {
  let service: InvitationsApiService;
  let httpMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    httpMock = { get: vi.fn(), post: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: httpMock as unknown as HttpClient }],
    });
    service = TestBed.inject(InvitationsApiService);
  });

  it('list_withoutFilters_callsCorrectUrl', () => {
    httpMock.get.mockReturnValue(of([mockInvitation]));
    let result: Invitation[] = [];
    service.list('condo-1').subscribe((r) => (result = r));
    expect(httpMock.get).toHaveBeenCalledWith(
      expect.stringContaining('/condominiums/condo-1/invitations'),
      expect.any(Object),
    );
    expect(result).toHaveLength(1);
  });

  it('list_withStatusFilter_appendsQueryParam', () => {
    httpMock.get.mockReturnValue(of([]));
    service.list('condo-1', { status: 'PENDING' }).subscribe();
    const [url, opts] = httpMock.get.mock.calls[0] as [string, { params: { toString(): string } }];
    expect(url).toContain('/condominiums/condo-1/invitations');
    expect(opts.params.toString()).toContain('status=PENDING');
  });

  it('list_withApartmentFilter_appendsQueryParam', () => {
    httpMock.get.mockReturnValue(of([]));
    service.list('condo-1', { apartmentId: 'apt-abc' }).subscribe();
    const [url, opts] = httpMock.get.mock.calls[0] as [string, { params: { toString(): string } }];
    expect(url).toContain('/condominiums/condo-1/invitations');
    expect(opts.params.toString()).toContain('apartmentId=apt-abc');
  });

  it('create_callsCorrectUrl_andPostsBody', () => {
    httpMock.post.mockReturnValue(of(mockInvitation));
    const req: CreateInvitationRequest = {
      apartmentId: 'apt-1',
      email: 'morador@exemplo.com',
      cpf: '12345678909',
      role: 'OWNER',
    };
    let result: Invitation | null = null;
    service.create('condo-1', req).subscribe((r) => (result = r));
    expect(httpMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/condominiums/condo-1/invitations'),
      req,
    );
    expect((result as Invitation | null)?.email).toBe('morador@exemplo.com');
  });

  it('createBulk_callsBulkEndpoint', () => {
    const bulkResponse: BulkResultResponse = {
      created: 1,
      invitations: [mockInvitation],
      errors: [],
    };
    httpMock.post.mockReturnValue(of(bulkResponse));
    const req: BulkCreateRequest = {
      entries: [
        { email: 'morador@exemplo.com', cpf: '12345678909', block: 'A', unitNumber: '101', role: 'OWNER' },
      ],
    };
    let result: BulkResultResponse | null = null;
    service.createBulk('condo-1', req).subscribe((r) => (result = r));
    expect(httpMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/condominiums/condo-1/invitations/bulk'),
      req,
    );
    expect((result as BulkResultResponse | null)?.created).toBe(1);
  });

  it('resend_callsResendEndpoint_withEmptyBody', () => {
    httpMock.post.mockReturnValue(of(mockInvitation));
    service.resend('inv-1').subscribe();
    expect(httpMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/invitations/inv-1/resend'),
      {},
    );
  });

  it('revoke_callsRevokeEndpoint', () => {
    httpMock.post.mockReturnValue(of(undefined));
    service.revoke('inv-1').subscribe();
    expect(httpMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/invitations/inv-1/revoke'),
      {},
    );
  });

  it('fixEmail_postsNewEmail', () => {
    httpMock.post.mockReturnValue(of({ ...mockInvitation, email: 'novo@exemplo.com' }));
    let result: Invitation | null = null;
    service.fixEmail('inv-1', { newEmail: 'novo@exemplo.com' }).subscribe((r) => (result = r));
    expect(httpMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/invitations/inv-1/fix-email'),
      { newEmail: 'novo@exemplo.com' },
    );
    expect((result as Invitation | null)?.email).toBe('novo@exemplo.com');
  });
});
