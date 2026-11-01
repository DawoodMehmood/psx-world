import { AGGREGATE_RULES as R } from '../config/thresholds';
import { ACTIVITY, DIRECTION, VOLATILITY, type CompanyState, type MarketMood, type MarketState, type SectorMood, type SectorState } from './types';

/** Holds a value until a different candidate has persisted for `dwell` updates, so moods don't flicker. */
class Dwell<T> {
  private candidate: T;
  private count = 0;
  constructor(
    public value: T,
    private dwell: number,
  ) {
    this.candidate = value;
  }
  update(next: T): T {
    if (next === this.value) {
      this.candidate = next;
      this.count = 0;
    } else if (next === this.candidate) {
      if (++this.count >= this.dwell) this.value = next;
    } else {
      this.candidate = next;
      this.count = 1;
      if (this.dwell <= 1) this.value = next;
    }
    return this.value;
  }
}

/** +1 for UP or better, −1 for DOWN or worse, 0 for FLAT. */
const sign = (c: CompanyState) => {
  const d = DIRECTION.indexOf(c.direction);
  return d > 2 ? 1 : d < 2 ? -1 : 0;
};
const meanActivity = (cs: CompanyState[]) => cs.reduce((a, c) => a + ACTIVITY.indexOf(c.activity), 0) / cs.length;
const toActivity = (mean: number) => ACTIVITY[Math.min(ACTIVITY.length - 1, Math.round(mean))];

/** Computes sector and market state from company states, tick by tick (SPEC §11). */
export class Aggregator {
  private sectorMood = new Map<string, Dwell<SectorMood>>();
  private marketMood = new Dwell<MarketMood>('NORMAL', R.moodDwellTicks);
  private stormy = new Dwell<boolean>(false, R.moodDwellTicks);

  constructor(
    private sectorOf: Record<string, string>,
    private scaleOf: Record<string, number>,
  ) {}

  update(companies: Record<string, CompanyState>): { sectors: Record<string, SectorState>; market: MarketState } {
    const all = Object.values(companies);
    const groups = new Map<string, CompanyState[]>();
    all.forEach((c) => {
      const id = this.sectorOf[c.ticker];
      groups.set(id, [...(groups.get(id) ?? []), c]);
    });

    const sectors: Record<string, SectorState> = {};
    groups.forEach((cs, id) => {
      const breadth = cs.reduce((a, c) => a + sign(c), 0) / cs.length;
      const raw: SectorMood = breadth >= R.sectorMoodBreadth ? 'RALLY' : breadth <= -R.sectorMoodBreadth ? 'SELLOFF' : 'MIXED';
      if (!this.sectorMood.has(id)) this.sectorMood.set(id, new Dwell<SectorMood>('MIXED', R.moodDwellTicks));
      sectors[id] = { id, breadth, activity: toActivity(meanActivity(cs)), mood: this.sectorMood.get(id)!.update(raw) };
    });

    const weight = (c: CompanyState) => R.breadthWeightBase + this.scaleOf[c.ticker];
    const totalWeight = all.reduce((a, c) => a + weight(c), 0);
    const breadth = all.reduce((a, c) => a + weight(c) * sign(c), 0) / totalWeight;
    const activityMean = meanActivity(all);
    const raw: MarketMood =
      breadth >= R.marketMoodBreadth ? 'BROAD_RALLY' : breadth <= -R.marketMoodBreadth ? 'BROAD_SELLOFF' : activityMean < R.quietActivity ? 'QUIET' : 'NORMAL';
    const wild = all.filter((c) => c.volatility === 'WILD').length / all.length;
    const choppy = all.filter((c) => VOLATILITY.indexOf(c.volatility) > 0).length / all.length;
    // A broad rally is never stormy: jumpy prices there are good news, not weather.
    const stormy = raw !== 'BROAD_RALLY' && (wild >= R.stormyWildShare || choppy >= R.stormyChoppyShare);

    return {
      sectors,
      market: { breadth, activity: toActivity(activityMean), mood: this.marketMood.update(raw), stormy: this.stormy.update(stormy) },
    };
  }
}
