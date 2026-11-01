import { COMPANY_BY_TICKER, type Archetype } from '../config/companies';
import type { Activity, CompanyState, EventType, Health } from '../engine/types';

export const EVENT_LABEL: Record<EventType, string> = {
  VOLUME_SPIKE: 'Volume spike',
  BIG_UP: 'Big jump up',
  BIG_DOWN: 'Big drop',
  NEW_HIGH: 'New 20-day high',
  NEW_LOW: 'New 20-day low',
  HALT: 'Trading halted',
  RESUME: 'Trading resumed',
  DIVIDEND: 'Dividend',
};

/** What each activity level looks like on each kind of site (SPEC §9). */
const ACTIVITY_LOOK: Record<Archetype, Record<Activity, string>> = {
  cement: {
    QUIET: 'few trucks and workers',
    NORMAL: 'trucks and workers coming and going',
    BUSY: 'more trucks, workers and a faster conveyor',
    FRENZY: 'every bay busy, the conveyor and kilns flat out',
  },
  bank: {
    QUIET: 'few people, few lit windows',
    NORMAL: 'people and cars coming and going',
    BUSY: 'more people and cars, most windows lit',
    FRENZY: 'crowds, every bay busy, every window lit',
  },
  oil: {
    QUIET: 'pumpjacks nodding slowly, a small flare',
    NORMAL: 'pumpjacks at a steady pace',
    BUSY: 'pumpjacks speed up, the flare grows, more tankers',
    FRENZY: 'everything pumping flat out, a big flare, tankers in every bay',
  },
  tech: {
    QUIET: 'rare data pulses, few lit windows',
    NORMAL: 'steady data pulses and server lights',
    BUSY: 'rapid pulses, blinking servers, drones out',
    FRENZY: 'pulses racing, every window lit, a swarm of drones',
  },
};

/** What weak and struggling health look like on each kind of site (SPEC §8, decline). */
const DECLINE_LOOK: Record<Archetype, Partial<Record<Health, string>>> = {
  cement: {
    WEAK: 'the newest kiln line is mothballed, a truck bay is closed and the crew is cut back',
    STRUGGLING: 'only the first kiln runs, most bays are closed, windows are boarded up and weeds come through the yard',
  },
  bank: {
    WEAK: 'the front-most building has closed with a TO LET board, a car bay is coned off and fewer people come in',
    STRUGGLING: 'only the HQ stays open, the rest is dark and to let, the ATM is out and the fountain is dry',
  },
  oil: {
    WEAK: 'the newest pumpjack is shut in, a tanker bay is closed and the crew is cut back',
    STRUGGLING: 'only the first pumpjack runs, the flare is out, the tanks are rusting and scrub grows in the yard',
  },
  tech: {
    WEAK: 'the front-most building has gone dark with a TO LET board, a courier bay is coned off and fewer people are around',
    STRUGGLING: 'only the HQ stays open, the data centers are dark, the café is shut and the lawn is overgrown',
  },
};

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

/** Plain-language reasons for what the plot looks like right now (SPEC §15). */
export function explain(c: CompanyState, forced: boolean): string[] {
  if (c.halted) return ['Trading is halted, so the whole plot is frozen behind barrier tape.'];
  const archetype = COMPANY_BY_TICKER[c.ticker].archetype;
  const why: string[] = [];
  const vol = forced ? '' : ` (volume ${c.volumeRatio.toFixed(1)}× a normal day)`;
  why.push(`${{ QUIET: 'Quiet', NORMAL: 'Normal activity', BUSY: 'Busy', FRENZY: 'Frenzy' }[c.activity]}: ${ACTIVITY_LOOK[archetype][c.activity]}${vol}.`);
  const today = forced ? '' : ` (${pct(c.dayChangePct)} today)`;
  why.push(
    {
      UP_HARD: `Flag at the top, beacon orange: up strongly${today}.`,
      UP: `Flag raised, beacon warm: up${today}.`,
      FLAT: `Flag at half-mast: about flat${today}.`,
      DOWN: `Flag lowered, beacon cool: down${today}.`,
      DOWN_HARD: `Flag near the bottom, beacon blue: down sharply${today}.`,
    }[c.direction],
  );
  if (c.volatility !== 'CALM') {
    why.push(c.volatility === 'WILD' ? 'Machines stutter and the beacon flickers: the price is swinging wildly.' : 'Machines run a little unevenly: the price is choppy.');
  }
  const r20 = forced ? '' : ` (${pct(c.return20Pct)} over 20 days)`;
  const decline = DECLINE_LOOK[archetype][c.health];
  const thriving = archetype === 'cement' ? ': pennants fly on the silos' : '';
  why.push(`Health ${c.health.toLowerCase()}${r20}${decline ? `: ${decline}` : c.health === 'THRIVING' ? thriving : ''}.`);
  const project = c.expansion ? { what: 'Enlarging the site', ...c.expansion } : c.slots.find((s) => s.stage !== 'EMPTY' && s.stage !== 'COMPLETE');
  if (project) {
    const what = 'what' in project ? project.what : 'Building on a reserved pad';
    why.push(project.paused ? `${what}, paused until health is strong again.` : `${what} (${project.stage.toLowerCase()} stage) after a run of strong days.`);
  }
  return why;
}
