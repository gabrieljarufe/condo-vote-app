import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { Apartment, ApartmentsApiService } from './apartments-api.service';

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
      providers: [{ provide: HttpClient, useValue: httpMock }],
    });
    service = TestBed.inject(ApartmentsApiService);
  });

  it('list faz GET no endpoint correto', () => {
    httpMock.get.mockReturnValue(of([mockApartment]));
    let result: Apartment[] = [];
    service.list('condo-1').subscribe((r) => (result = r));
    expect(httpMock.get).toHaveBeenCalledWith(expect.stringContaining('/condominiums/condo-1/apartments'));
    expect(result).toHaveLength(1);
  });

  it('create faz POST com body correto', () => {
    httpMock.post.mockReturnValue(of(mockApartment));
    let result: Apartment | null = null;
    service.create('condo-1', { unitNumber: '101', block: 'A' }).subscribe((r) => (result = r));
    expect(httpMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/condominiums/condo-1/apartments'),
      { unitNumber: '101', block: 'A' },
    );
    expect(result?.unitNumber).toBe('101');
  });

  it('setDelinquent faz PATCH com flag', () => {
    httpMock.patch.mockReturnValue(of({ ...mockApartment, isDelinquent: true }));
    let result: Apartment | null = null;
    service.setDelinquent('apt-1', true).subscribe((r) => (result = r));
    expect(httpMock.patch).toHaveBeenCalledWith(
      expect.stringContaining('/apartments/apt-1/delinquent'),
      { isDelinquent: true },
    );
    expect(result?.isDelinquent).toBe(true);
  });
});
