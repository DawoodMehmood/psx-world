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
  // Demo clock: real sizes move over months, so this demo smooths over days and uses a narrow 5-year range.
  size: { smoothDays: 12, dwellDays: 3, rangeRatio: 1.3 },
  // Construction follows market cap and moves at each day's close; the demo bar adds a "site news" line computed from the data.
  notes: {
    1: 'A normal day. Every company ticks along.',
    2: 'A quiet day: thin trading everywhere, the Exchange plaza nearly empty.',
    3: 'Tech: SYS volume spikes. Searchlights and racing data pulses on its campus; the rest of the city carries on.',
    4: 'SYS keeps climbing; everyone else has an ordinary day.',
    5: 'Banks: all three open higher together, and the district rallies. MEBL leads.',
    6: 'Oil: OGDC frenzy, yet its flag stays at half-mast: busy is not up.',
    7: 'The bank rally holds.',
    8: 'The banks rally for a fourth day.',
    9: 'Cement weakens: fewer trucks, slower conveyors.',
    10: 'Cement: DGKC is halted mid-day; only its plot freezes.',
    11: 'Cement keeps sliding on thin trading.',
    12: 'Tech: AVN swings wildly and ends flat: stutter and flicker, no direction.',
    13: 'LUCK has turned weak, and the rest of cement follows.',
    14: 'A selloff starts across the whole market: flags drop in every district and the sky clouds over.',
    15: 'The worst day: heavy selling everywhere, and rain over the city.',
    16: 'After the selloff: cement is struggling and OGDC is weak.',
    17: 'A relief rally: almost everything opens higher, and the sky clears.',
    18: 'LUCK announces a dividend, but cement still lags.',
    19: 'Sizes follow market cap, which moves slowly: the selloff is only now reaching the sites.',
    20: 'Banks and tech keep recovering; cement lags.',
    21: 'The recovery runs on in banks and tech.',
    22: 'Banks and tech keep recovering.',
    23: 'Oil: MARI has climbed steadily since the selloff.',
    24: 'HBL has started to slide.',
    25: 'The recovery runs on in banks and tech.',
    26: 'Oil: OGDC begins a long slide.',
    27: 'MARI keeps climbing.',
    28: 'HBL turns weak: its branch hall closes with a TO LET board.',
    29: 'OGDC is struggling: a pumpjack shut in, the flare out.',
    30: 'MARI keeps climbing.',
    31: 'HBL is struggling: only its HQ stays open.',
    32: 'FCCL, UBL, PPL and TRG keep edging up.',
    33: 'Cement: FCCL keeps recovering; LUCK and DGKC barely move.',
    34: 'Tech: SYS keeps growing.',
    35: 'Cement: FCCL keeps recovering.',
    36: 'MEBL and SYS keep climbing.',
    37: 'Banks hold their gains; HBL and OGDC keep sliding.',
    38: 'PPL and TRG, steady risers, edge up again.',
    39: 'FCCL and MARI keep climbing.',
    40: 'The end of two months: growers have grown, sliders have wound down.',
  },
  plan,
};
