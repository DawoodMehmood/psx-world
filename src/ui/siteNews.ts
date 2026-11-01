import { COMPANIES } from '../config/companies';
import type { CompanyState } from '../engine/types';

/**
 * What changed on the sites between two readings, in plain words: the line the
 * demo bar adds under each day's caption. Computed from the states, so it is
 * always true of what is on screen.
 */
export function siteNews(before: Record<string, CompanyState>, after: Record<string, CompanyState>): string[] {
  const news: string[] = [];
  for (const { ticker } of COMPANIES) {
    const a = before[ticker];
    const b = after[ticker];
    if (!a || !b) continue;
    const slots = b.slots.map((s, i) => ({ now: s, was: a.slots[i] }));
    if (slots.some(({ now, was }) => now.stage === 'STAKED' && !now.paused && was.stage === 'EMPTY')) news.push(`${ticker} breaks ground on a new building`);
    if (slots.some(({ now, was }) => now.stage === 'COMPLETE' && was.stage !== 'COMPLETE')) news.push(`${ticker} finishes a new building`);
    if (slots.some(({ now, was }) => now.paused && !was.paused)) news.push(`${ticker} starts winding down a building`);
    if (slots.some(({ now, was }) => now.stage === 'EMPTY' && was.stage !== 'EMPTY' && was.stage !== 'COMPLETE' && was.paused)) news.push(`${ticker} clears a wound-down building`);
    if (b.tier > a.tier) news.push(`${ticker}'s site grows`);
    else if (b.tier < a.tier) news.push(`${ticker}'s site shrinks back`);
    else if (b.expansion && !a.expansion) news.push(`${ticker} starts enlarging its site`);
  }
  return news;
}

/** The line to show: a few items, with a count for the rest; empty when nothing changed. */
export function siteNewsLine(news: string[], max = 3): string {
  if (!news.length) return '';
  const shown = news.slice(0, max).join('; ');
  return `Sites: ${shown}${news.length > max ? `; +${news.length - max} more` : ''}.`;
}
