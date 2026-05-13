import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { Apartment, ApartmentsApiService, Page } from './apartments-api.service';

const mockApartment: Apartment = {
  id: 'apt-1',
  condominiumId: 'condo-1',
  unitNumber: '101',
  block: 'A',
  isDelinquent: false,
  eligibleVoterUserId: null,
  createdAt: '2026-01-01T00:00:00Z',
};

describe('ApartmentsApiService', () => {
  let service: ApartmentsApiService;
  let httpMock: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    httpMock = { get: vi.fn(), post: vi.fn(), patch: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: httpMock as unknown as HttpClient }],
    });
    service = TestBed.inject(ApartmentsApiService);
  });

  it('list faz GET no endpoint correto com page/size default', () => {
    const page: Page<Apartment> = {
      content: [mockApartment],
      page: 0,
      size: 10,
      totalElements: 1,
      totalPages: 1,
    };
    httpMock.get.mockReturnValue(of(page));
    let result: Page<Apartment> | null = null;
    service.list('condo-1').subscribe((r) => (result = r));
    expect(httpMock.get).toHaveBeenCalledWith(
      expect.stringContaining('/condominiums/condo-1/apartments'),
      expect.objectContaining({ params: expect.anything() }),
    );
    const params = httpMock.get.mock.calls[0][1].params;
    expect(params.get('page')).toBe('0');
    expect(params.get('size')).toBe('10');
    expect((result as Page<Apartment> | null)?.content).toHaveLength(1);
  });

  it('list propaga page/size customizados', () => {
    httpMock.get.mockReturnValue(
      of({ content: [], page: 2, size: 10, totalElements: 25, totalPages: 3 }),
    );
    service.list('condo-1', 2, 10).subscribe();
    const params = httpMock.get.mock.calls[0][1].params;
    expect(params.get('page')).toBe('2');
    expect(params.get('size')).toBe('10');
  });

  it('create faz POST com body correto', () => {
    httpMock.post.mockReturnValue(of(mockApartment));
    let result: Apartment | null = null;
    service.create('condo-1', { unitNumber: '101', block: 'A' }).subscribe((r) => (result = r));
    expect(httpMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/condominiums/condo-1/apartments'),
      { unitNumber: '101', block: 'A' },
    );
    expect((result as Apartment | null)?.unitNumber).toBe('101');
  });

  it('setDelinquent faz PATCH com flag', () => {
    httpMock.patch.mockReturnValue(of({ ...mockApartment, isDelinquent: true }));
    let result: Apartment | null = null;
    service.setDelinquent('apt-1', true).subscribe((r) => (result = r));
    expect(httpMock.patch).toHaveBeenCalledWith(
      expect.stringContaining('/apartments/apt-1/delinquent'),
      { isDelinquent: true },
    );
    expect((result as Apartment | null)?.isDelinquent).toBe(true);
  });
});
