/**
 * Pure function to generate apartments based on a configuration pattern.
 * Completely isolated from Angular - no @angular/* imports.
 */

export interface GeneratorConfig {
  block: string;            // bloco/torre, pode ser ''
  floorStart: number;       // andar inicial (inclusive)
  floorEnd: number;         // andar final (inclusive)
  unitsPerFloor: number;    // número de aptos por andar
  pattern: string;          // padrão de numeração com tokens
  skipFloors: number[];     // andares a pular
}

export interface GeneratedApartment {
  block: string | null;   // null quando block é ''
  unitNumber: string;     // número calculado pelo padrão
  floor: number;          // andar
  seq: number;            // sequência no andar (1-based)
}

/**
 * Generates a list of apartments based on configuration.
 *
 * Tokens in the pattern:
 * - {andar} → floor number (no padding)
 * - {seq} → sequence within floor (no padding, 1-based)
 * - {seq:02} → sequence with 2-digit zero-padding (01, 02, 03...)
 * - {seq:03} → sequence with 3-digit zero-padding (001, 002, 003...)
 *
 * @param config Configuration for apartment generation
 * @returns Array of generated apartments
 */
export function generateApartments(config: GeneratorConfig): GeneratedApartment[] {
  // Validate inputs
  if (config.floorStart > config.floorEnd) {
    return [];
  }

  if (config.unitsPerFloor <= 0) {
    return [];
  }

  const apartments: GeneratedApartment[] = [];
  const blockValue = config.block === '' ? null : config.block;
  const skipSet = new Set(config.skipFloors);

  // Iterate through each floor
  for (let floor = config.floorStart; floor <= config.floorEnd; floor++) {
    // Skip floors in the skipFloors list
    if (skipSet.has(floor)) {
      continue;
    }

    // Generate apartments for this floor
    for (let seq = 1; seq <= config.unitsPerFloor; seq++) {
      const unitNumber = substitutePattern(config.pattern, floor, seq);

      apartments.push({
        block: blockValue,
        unitNumber,
        floor,
        seq,
      });
    }
  }

  return apartments;
}

/**
 * Substitutes tokens in the pattern with actual values.
 *
 * @param pattern Pattern string with tokens
 * @param floor Current floor number
 * @param seq Current sequence (1-based)
 * @returns Substituted string
 */
function substitutePattern(pattern: string, floor: number, seq: number): string {
  let result = pattern;

  // Replace {seq:XX} tokens (with padding)
  // Match {seq:02}, {seq:03}, etc.
  result = result.replace(/\{seq:(\d+)\}/g, (match, paddingStr) => {
    const padding = parseInt(paddingStr, 10);
    return seq.toString().padStart(padding, '0');
  });

  // Replace {seq} token (no padding)
  result = result.replace(/\{seq\}/g, seq.toString());

  // Replace {andar} token
  result = result.replace(/\{andar\}/g, floor.toString());

  return result;
}
