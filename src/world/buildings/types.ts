import type { Health, SlotState } from '../../engine/types';

export interface ArchetypeProps {
  /** 0–1, from the company definition. */
  scale: number;
  accent: string;
  seed: number;
  health: Health;
  /** Current site tier, from 1. */
  tier: number;
  slots: SlotState[];
}
