import type { SlotState } from '../../engine/types';
import { Workers } from '../agents';
import { Tarp } from '../kit';
import { Scaffold } from './ConstructionSlot';

/**
 * An upgrade in progress (DESIGN.md §4): scaffolding around the thing being
 * improved, with a couple of workers on it; while it is being wound down the
 * crew leaves and a tarp goes on. Nothing is drawn once it is finished or
 * before it starts: the upgraded parts then draw themselves.
 */
export function UpgradeSite({ state, at, w, d, h }: { state: SlotState; at: [number, number]; w: number; d: number; h: number }) {
  if (state.stage !== 'FRAME') return null;
  return (
    <group position={[at[0], 0, at[1]]}>
      <Scaffold w={w} d={d} h={h} />
      {state.paused ? (
        <Tarp w={w + 0.2} d={d + 0.2} top={h + 0.25} drop={h * 0.55} />
      ) : (
        <Workers
          lanes={[
            [-w / 2, d / 2 + 0.3, w / 2, d / 2 + 0.3],
            [w / 2 + 0.3, -d / 2, w / 2 + 0.3, d / 2],
          ]}
          max={3}
          min={2}
        />
      )}
    </group>
  );
}
