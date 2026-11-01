import type { ComponentType } from 'react';
import type { Archetype } from '../../config/companies';
import { BankComplex } from './BankComplex';
import { CementPlant } from './CementPlant';
import { OilField } from './OilField';
import { TechCampus } from './TechCampus';
import type { ArchetypeProps } from './types';

/** Building recipe per archetype, drawn in site coordinates (origin at the lot's front corner, site in −x/−z). */
export const ARCHETYPES: Record<Archetype, ComponentType<ArchetypeProps>> = {
  bank: BankComplex,
  oil: OilField,
  cement: CementPlant,
  tech: TechCampus,
};

/** Rough top of each archetype, used to place the hover label and event effects. */
export function archetypeHeight(archetype: Archetype, scale: number): number {
  switch (archetype) {
    case 'bank':
      return Math.round(5 + scale * 6) + 3;
    case 'oil':
      return 6.5 + scale * 2.5;
    case 'cement':
      return 6.2 + scale * 1.5;
    case 'tech':
      return Math.round(4 + scale * 6) * 0.9 + 2.5;
  }
}
