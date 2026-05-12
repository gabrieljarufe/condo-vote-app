import { describe, it, expect } from 'vitest';
import { generateApartments, GeneratorConfig } from './generate-apartments';

describe('generateApartments', () => {
  /**
   * Test 1: Pattern {andar}{seq:02} (most common pattern)
   */
  it('gera apartamentos com padrão {andar}{seq:02}', () => {
    const config: GeneratorConfig = {
      block: 'A',
      floorStart: 1,
      floorEnd: 2,
      unitsPerFloor: 4,
      pattern: '{andar}{seq:02}',
      skipFloors: [],
    };

    const result = generateApartments(config);

    expect(result).toHaveLength(8);
    expect(result[0]).toEqual({ block: 'A', unitNumber: '101', floor: 1, seq: 1 });
    expect(result[1]).toEqual({ block: 'A', unitNumber: '102', floor: 1, seq: 2 });
    expect(result[2]).toEqual({ block: 'A', unitNumber: '103', floor: 1, seq: 3 });
    expect(result[3]).toEqual({ block: 'A', unitNumber: '104', floor: 1, seq: 4 });
    expect(result[4]).toEqual({ block: 'A', unitNumber: '201', floor: 2, seq: 1 });
    expect(result[5]).toEqual({ block: 'A', unitNumber: '202', floor: 2, seq: 2 });
    expect(result[6]).toEqual({ block: 'A', unitNumber: '203', floor: 2, seq: 3 });
    expect(result[7]).toEqual({ block: 'A', unitNumber: '204', floor: 2, seq: 4 });
  });

  /**
   * Test 2: Pattern with separator {andar}-{seq}
   */
  it('gera apartamentos com padrão {andar}-{seq}', () => {
    const config: GeneratorConfig = {
      block: 'B',
      floorStart: 1,
      floorEnd: 2,
      unitsPerFloor: 3,
      pattern: '{andar}-{seq}',
      skipFloors: [],
    };

    const result = generateApartments(config);

    expect(result).toHaveLength(6);
    expect(result[0]).toEqual({ block: 'B', unitNumber: '1-1', floor: 1, seq: 1 });
    expect(result[1]).toEqual({ block: 'B', unitNumber: '1-2', floor: 1, seq: 2 });
    expect(result[2]).toEqual({ block: 'B', unitNumber: '1-3', floor: 1, seq: 3 });
    expect(result[3]).toEqual({ block: 'B', unitNumber: '2-1', floor: 2, seq: 1 });
    expect(result[4]).toEqual({ block: 'B', unitNumber: '2-2', floor: 2, seq: 2 });
    expect(result[5]).toEqual({ block: 'B', unitNumber: '2-3', floor: 2, seq: 3 });
  });

  /**
   * Test 3: Pattern {seq:03} - sequence per floor with padding
   */
  it('gera apartamentos com padrão {seq:03}', () => {
    const config: GeneratorConfig = {
      block: 'C',
      floorStart: 1,
      floorEnd: 2,
      unitsPerFloor: 2,
      pattern: '{seq:03}',
      skipFloors: [],
    };

    const result = generateApartments(config);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ block: 'C', unitNumber: '001', floor: 1, seq: 1 });
    expect(result[1]).toEqual({ block: 'C', unitNumber: '002', floor: 1, seq: 2 });
    expect(result[2]).toEqual({ block: 'C', unitNumber: '001', floor: 2, seq: 1 });
    expect(result[3]).toEqual({ block: 'C', unitNumber: '002', floor: 2, seq: 2 });
  });

  /**
   * Test 4: Token {seq} without padding
   */
  it('gera apartamentos com token {seq} sem padding', () => {
    const config: GeneratorConfig = {
      block: 'D',
      floorStart: 1,
      floorEnd: 2,
      unitsPerFloor: 3,
      pattern: '{andar}{seq}',
      skipFloors: [],
    };

    const result = generateApartments(config);

    expect(result).toHaveLength(6);
    expect(result[0]).toEqual({ block: 'D', unitNumber: '11', floor: 1, seq: 1 });
    expect(result[1]).toEqual({ block: 'D', unitNumber: '12', floor: 1, seq: 2 });
    expect(result[2]).toEqual({ block: 'D', unitNumber: '13', floor: 1, seq: 3 });
    expect(result[3]).toEqual({ block: 'D', unitNumber: '21', floor: 2, seq: 1 });
    expect(result[4]).toEqual({ block: 'D', unitNumber: '22', floor: 2, seq: 2 });
    expect(result[5]).toEqual({ block: 'D', unitNumber: '23', floor: 2, seq: 3 });
  });

  /**
   * Test 5: Skip single floor (floor 13)
   */
  it('pula um andar específico (andar 13)', () => {
    const config: GeneratorConfig = {
      block: 'A',
      floorStart: 12,
      floorEnd: 14,
      unitsPerFloor: 1,
      pattern: '{andar}{seq:02}',
      skipFloors: [13],
    };

    const result = generateApartments(config);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ block: 'A', unitNumber: '1201', floor: 12, seq: 1 });
    expect(result[1]).toEqual({ block: 'A', unitNumber: '1401', floor: 14, seq: 1 });
  });

  /**
   * Test 6: Skip multiple floors
   */
  it('pula múltiplos andares', () => {
    const config: GeneratorConfig = {
      block: 'A',
      floorStart: 1,
      floorEnd: 5,
      unitsPerFloor: 1,
      pattern: '{andar}{seq:02}',
      skipFloors: [2, 4],
    };

    const result = generateApartments(config);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ block: 'A', unitNumber: '101', floor: 1, seq: 1 });
    expect(result[1]).toEqual({ block: 'A', unitNumber: '301', floor: 3, seq: 1 });
    expect(result[2]).toEqual({ block: 'A', unitNumber: '501', floor: 5, seq: 1 });
  });

  /**
   * Test 7: floorStart > floorEnd returns empty array
   */
  it('retorna array vazio quando floorStart > floorEnd', () => {
    const config: GeneratorConfig = {
      block: 'A',
      floorStart: 5,
      floorEnd: 3,
      unitsPerFloor: 2,
      pattern: '{andar}{seq:02}',
      skipFloors: [],
    };

    const result = generateApartments(config);

    expect(result).toHaveLength(0);
  });

  /**
   * Test 8: unitsPerFloor <= 0 returns empty array
   */
  it('retorna array vazio quando unitsPerFloor <= 0', () => {
    const config: GeneratorConfig = {
      block: 'A',
      floorStart: 1,
      floorEnd: 3,
      unitsPerFloor: 0,
      pattern: '{andar}{seq:02}',
      skipFloors: [],
    };

    const result = generateApartments(config);

    expect(result).toHaveLength(0);
  });

  /**
   * Test 9: Empty block becomes null
   */
  it('converte block vazio para null', () => {
    const config: GeneratorConfig = {
      block: '',
      floorStart: 1,
      floorEnd: 1,
      unitsPerFloor: 2,
      pattern: '{andar}{seq:02}',
      skipFloors: [],
    };

    const result = generateApartments(config);

    expect(result).toHaveLength(2);
    expect(result[0].block).toBeNull();
    expect(result[1].block).toBeNull();
    expect(result[0]).toEqual({ block: null, unitNumber: '101', floor: 1, seq: 1 });
  });

  /**
   * Test 10: Non-empty block is preserved
   */
  it('preserva block não vazio', () => {
    const config: GeneratorConfig = {
      block: 'Torre A',
      floorStart: 1,
      floorEnd: 1,
      unitsPerFloor: 1,
      pattern: '{andar}{seq:02}',
      skipFloors: [],
    };

    const result = generateApartments(config);

    expect(result).toHaveLength(1);
    expect(result[0].block).toBe('Torre A');
  });

  /**
   * Test 11: Unknown token remains literal in result
   */
  it('mantém token desconhecido literal no resultado', () => {
    const config: GeneratorConfig = {
      block: 'A',
      floorStart: 1,
      floorEnd: 1,
      unitsPerFloor: 2,
      pattern: '{andar}-{seq}-{unknown}',
      skipFloors: [],
    };

    const result = generateApartments(config);

    expect(result).toHaveLength(2);
    expect(result[0].unitNumber).toBe('1-1-{unknown}');
    expect(result[1].unitNumber).toBe('1-2-{unknown}');
  });

  /**
   * Additional test: Complex pattern with multiple seq:XX occurrences
   */
  it('suporta múltiplas ocorrências de {seq:XX} no padrão', () => {
    const config: GeneratorConfig = {
      block: 'A',
      floorStart: 1,
      floorEnd: 1,
      unitsPerFloor: 3,
      pattern: '{seq:03}-{andar}-{seq:02}',
      skipFloors: [],
    };

    const result = generateApartments(config);

    expect(result).toHaveLength(3);
    expect(result[0].unitNumber).toBe('001-1-01');
    expect(result[1].unitNumber).toBe('002-1-02');
    expect(result[2].unitNumber).toBe('003-1-03');
  });

  /**
   * Additional test: Complex real-world scenario
   */
  it('gera apartamentos em cenário real complexo', () => {
    // Edifício com 15 andares, 4 aptos por andar, sem andar 13
    const config: GeneratorConfig = {
      block: '',
      floorStart: 1,
      floorEnd: 15,
      unitsPerFloor: 4,
      pattern: '{andar}{seq:02}',
      skipFloors: [13],
    };

    const result = generateApartments(config);

    // 14 andares × 4 aptos = 56 apartamentos
    expect(result).toHaveLength(56);

    // Verify first apartment
    expect(result[0]).toEqual({ block: null, unitNumber: '101', floor: 1, seq: 1 });

    // Verify last apartment on floor 12
    expect(result[47]).toEqual({ block: null, unitNumber: '1204', floor: 12, seq: 4 });

    // Verify floor 13 is skipped (next apartment is from floor 14)
    expect(result[48]).toEqual({ block: null, unitNumber: '1401', floor: 14, seq: 1 });

    // Verify last apartment on floor 15
    expect(result[55]).toEqual({ block: null, unitNumber: '1504', floor: 15, seq: 4 });
  });

  /**
   * Additional test: Edge case - single floor, single unit
   */
  it('gera um único apartamento', () => {
    const config: GeneratorConfig = {
      block: 'X',
      floorStart: 5,
      floorEnd: 5,
      unitsPerFloor: 1,
      pattern: '{andar}{seq:02}',
      skipFloors: [],
    };

    const result = generateApartments(config);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ block: 'X', unitNumber: '501', floor: 5, seq: 1 });
  });

  /**
   * Additional test: Large number of units per floor
   */
  it('gera múltiplos aptos com padding correto', () => {
    const config: GeneratorConfig = {
      block: 'A',
      floorStart: 1,
      floorEnd: 1,
      unitsPerFloor: 20,
      pattern: '{andar}{seq:02}',
      skipFloors: [],
    };

    const result = generateApartments(config);

    expect(result).toHaveLength(20);
    expect(result[8].unitNumber).toBe('109'); // seq=9 → 09
    expect(result[9].unitNumber).toBe('110'); // seq=10 → 10
    expect(result[18].unitNumber).toBe('119'); // seq=19 → 19
    expect(result[19].unitNumber).toBe('120'); // seq=20 → 20
  });
});
