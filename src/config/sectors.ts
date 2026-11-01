export type SectorId = 'banks' | 'oil' | 'cement' | 'tech';

export interface SectorDefinition {
  id: SectorId;
  name: string;
  /** Quadrant of the city: sign of x and z. Camera looks from +x,+z, so (-1,-1) is the back of the screen. */
  quadrant: [1 | -1, 1 | -1];
  /** Ground tint for the district. */
  ground: string;
  /** Plot pad color. */
  pad: string;
  /** UI color for chips and labels. */
  color: string;
}

export const SECTORS: SectorDefinition[] = [
  { id: 'banks', name: 'Commercial Banks', quadrant: [-1, -1], ground: '#9fd16a', pad: '#e9e2d0', color: '#3b82c4' },
  { id: 'tech', name: 'Tech & Communication', quadrant: [1, -1], ground: '#8fcf86', pad: '#dfe7e4', color: '#7c5cd6' },
  { id: 'oil', name: 'Oil & Gas Exploration', quadrant: [-1, 1], ground: '#d8bf86', pad: '#cfae74', color: '#d9822b' },
  { id: 'cement', name: 'Cement', quadrant: [1, 1], ground: '#cdc3ad', pad: '#bdb39f', color: '#7d7468' },
];

export const SECTOR_BY_ID = Object.fromEntries(SECTORS.map((s) => [s.id, s])) as Record<SectorId, SectorDefinition>;
