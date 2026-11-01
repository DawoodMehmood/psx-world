import type { DayPlan, Scenario } from '../types';

/**
 * The full demo (SPEC §14): every company has a story over two months of
 * trading. Fictional data, not a historical record.
 *
 * Each segment applies a plan to some tickers over a range of days; a later
 * segment overrides an earlier one on the same day. '*' means every company.
 */
type Segment = [tickers: string[] | '*', from: number, to: number, plan: DayPlan];

const OIL = ['OGDC', 'PPL', 'MARI'];
const CEMENT = ['LUCK', 'DGKC', 'FCCL'];

const SEGMENTS: Segment[] = [
  // 1–8: a quiet day, a tech spike, a bank rally, a frantic but flat oil day
  ['*', 2, 2, { volume: 0.45 }],
  [['SYS'], 3, 3, { drift: 3.5, volume: 4.5 }],
  [['SYS'], 4, 8, { drift: 0.5, volume: 1.3 }],
  // the banks gap up at the open together, so the district rallies all day
  [['MEBL'], 5, 8, { gap: 1, drift: 0.6, volume: 2 }],
  [['HBL'], 5, 8, { gap: 0.9, drift: 0.5, volume: 1.8 }],
  [['UBL'], 5, 8, { gap: 0.9, drift: 0.4, volume: 1.6 }],
  [['OGDC'], 6, 6, { volume: 4.2, zigzag: 0.6 }],

  // 9–13: cement weakens broadly; a DGKC halt; AVN swings wildly
  [CEMENT, 9, 11, { drift: -1.1, volume: 0.45 }],
  [['DGKC'], 10, 10, { drift: -0.8, volume: 0.45, halt: [2, 5] }],
  [['MEBL'], 9, 13, { drift: -0.3 }],
  [['HBL'], 9, 13, { drift: -0.4 }],
  [['UBL'], 9, 13, { drift: -0.5 }],
  [['SYS'], 9, 13, { drift: 0.1 }],
  // the zigzag nets half a swing up, so a matching drift down ends the day flat
  [['AVN'], 12, 12, { zigzag: 2, drift: -1, volume: 2.2 }],

  // 14–15: a broad selloff, day 15 the worst
  ['*', 14, 14, { drift: -2.2, volume: 1.8 }],
  ['*', 15, 15, { drift: -5, volume: 3.2 }],

  // 16–25: an uneven recovery: banks and tech first, cement lags
  [['MEBL'], 16, 25, { drift: 0.9, volume: 1.3 }],
  [['UBL'], 16, 25, { drift: 0.7, volume: 1.2 }],
  [['HBL'], 16, 23, { drift: 0.4, volume: 1.1 }],
  [['SYS'], 16, 25, { drift: 0.6, volume: 1.2 }],
  [['TRG', 'AVN'], 16, 25, { drift: 0.5, volume: 1.1 }],
  [OIL, 16, 25, { drift: 0.3 }],
  [CEMENT, 16, 25, { drift: 0.1, volume: 0.7 }],
  [['LUCK'], 18, 18, { drift: 0.6, dividendTick: 3 }],
  // a relief rally: nearly everything jumps for a day
  ['*', 17, 17, { gap: 1.2, drift: 0.6, volume: 1.6 }],
  [['MARI'], 16, 40, { drift: 1.1, volume: 1.3 }],

  // 26–40: long arcs: growers keep growing, two old names slide
  [['MEBL'], 26, 40, { drift: 0.4 }],
  [['UBL'], 26, 40, { drift: 0.2 }],
  [['HBL'], 24, 40, { drift: -0.9, volume: 0.8 }],
  [['SYS'], 26, 40, { drift: 0.5, volume: 1.3 }],
  [['TRG', 'AVN'], 26, 40, { drift: 0.1 }],
  [['OGDC'], 26, 40, { drift: -0.8, volume: 0.8 }],
  [['PPL'], 26, 40, { drift: 0.1 }],
  [['FCCL'], 26, 40, { drift: 1.1, volume: 1.4 }],
  [['LUCK', 'DGKC'], 26, 40, { drift: 0.2 }],
];

function plan(ticker: string, day: number): DayPlan | undefined {
  let found: DayPlan | undefined;
  for (const [tickers, from, to, p] of SEGMENTS) {
    if (day >= from && day <= to && (tickers === '*' || tickers.includes(ticker))) found = p;
  }
  return found;
}

export const twoMonths: Scenario = {
  id: 'two-months',
  name: 'Two months on the Exchange',
  seed: 11,
  days: 40,
  // Construction moves on at each day's close, so each caption describes what you see during that day.
  notes: {
    1: 'A normal day. Every company ticks along.',
    2: 'A quiet day: thin trading everywhere, the Exchange plaza nearly empty.',
    3: 'Tech: SYS volume spikes. Searchlights and racing data pulses on its campus; the rest of the city carries on.',
    4: 'SYS keeps climbing; everyone else has an ordinary day.',
    5: 'Banks: all three open higher together, and the district rallies. MEBL leads.',
    6: 'Oil: OGDC frenzy, yet its flag stays at half-mast: busy is not up. SYS stakes out a pad for an office block.',
    7: 'SYS office block: foundations in. The bank rally holds.',
    8: 'The banks rally for a fourth day. SYS office block: the frame goes up.',
    9: 'Cement weakens: fewer trucks, slower conveyors. MEBL and HBL, strong for days, stake out new towers. SYS finishes its office block.',
    10: 'Cement: DGKC is halted mid-day; only its plot freezes. UBL stakes out a branch hall.',
    11: 'Cement keeps sliding on thin trading. The new bank towers’ frames go up; UBL’s project has stalled.',
    12: 'Tech: AVN swings wildly and ends flat: stutter and flicker, no direction. MEBL’s and HBL’s new towers are finished.',
    13: 'LUCK has turned weak, and the rest of cement follows. SYS finishes a second data center; MEBL and HBL start office wings.',
    14: 'A selloff starts across the whole market: flags drop in every district and the sky clouds over. SYS stakes out more land.',
    15: 'The worst day: heavy selling everywhere, and rain over the city.',
    16: 'After the selloff: MEBL, HBL and SYS have stopped building, cranes still and tarps on. Cement is struggling; OGDC is weak.',
    17: 'A relief rally: almost everything opens higher, and the sky clears.',
    18: 'LUCK announces a dividend, but cement still lags. SYS is building again.',
    19: 'SYS’s site has grown to tier 3. HBL’s office wing stays shelved under its tarp.',
    20: 'MEBL is strong again: its office wing is finished.',
    21: 'Banks and tech keep recovering; cement lags.',
    22: 'MEBL’s site is full: surveyors stake out more of its lot.',
    23: 'MEBL’s new land is cleared and graded.',
    24: 'Fence and gravel go in around MEBL’s new land. HBL has started to slide.',
    25: 'MEBL’s site has grown to tier 3.',
    26: 'Oil: OGDC begins a long slide. MEBL starts its tallest tower.',
    27: 'MARI has climbed steadily since the selloff.',
    28: 'HBL turns weak: its branch hall closes with a TO LET board. MARI stakes out a new pumpjack.',
    29: 'OGDC is struggling: a pumpjack shut in, the flare out. MARI’s pumpjack: foundations in.',
    30: 'MARI’s pumpjack goes up.',
    31: 'HBL is struggling: only its HQ stays open. MARI’s new pumpjack is pumping. SYS has built out its whole lot.',
    32: 'MARI’s site is full: surveyors stake out more land.',
    33: 'MARI grades its new land.',
    34: 'Fence and gravel go in around MARI’s new land.',
    35: 'MARI’s site has grown to tier 2. Cement: FCCL is strong again and stakes out a new silo bay.',
    36: 'FCCL silo bay: foundations in. UBL’s long-stalled branch hall is moving again.',
    37: 'MEBL has built out its whole lot. FCCL’s silo bay goes up.',
    38: 'PPL and TRG, steady risers, each start a project. UBL’s branch hall and FCCL’s silo bay are done.',
    39: 'UBL and FCCL have filled their sites: surveyors stake out more land.',
    40: 'The end of two months: growers have grown, sliders have wound down, and nothing was ever torn down.',
  },
  plan,
};
