import { describe, expect, it } from 'vitest';
import type { CompanyState, SlotState } from '../src/engine/types';
import { siteNews, siteNewsLine } from '../src/ui/siteNews';

const slot = (stage: SlotState['stage'], paused = false): SlotState => ({ stage, paused });
const co = (slots: SlotState[], extra: Partial<CompanyState> = {}) => ({ MEBL: { tier: 1, expansion: null, slots, ...extra } as CompanyState });

describe('siteNews', () => {
  it('reports ground broken, a finished building, a wind-down and a cleared site', () => {
    expect(siteNews(co([slot('EMPTY')]), co([slot('STAKED')]))).toEqual(['MEBL breaks ground on a new building']);
    expect(siteNews(co([slot('FRAME')]), co([slot('COMPLETE')]))).toEqual(['MEBL finishes a new building']);
    expect(siteNews(co([slot('COMPLETE')]), co([slot('FRAME', true)]))).toEqual(['MEBL starts winding down a building']);
    expect(siteNews(co([slot('FOUNDATION', true)]), co([slot('EMPTY', true)]))).toEqual(['MEBL clears a wound-down building']);
  });

  it('reports the site growing, shrinking and being enlarged', () => {
    expect(siteNews(co([], { tier: 1 }), co([], { tier: 2 }))).toEqual(["MEBL's site grows"]);
    expect(siteNews(co([], { tier: 2 }), co([], { tier: 1 }))).toEqual(["MEBL's site shrinks back"]);
    expect(siteNews(co([], { tier: 1 }), co([], { tier: 1, expansion: slot('STAKED') }))).toEqual(['MEBL starts enlarging its site']);
  });

  it('says nothing when nothing changed', () => {
    expect(siteNews(co([slot('COMPLETE')]), co([slot('COMPLETE')]))).toEqual([]);
    expect(siteNewsLine([])).toBe('');
  });

  it('limits the line and counts the rest', () => {
    expect(siteNewsLine(['a', 'b', 'c', 'd', 'e'])).toBe('Sites: a; b; c; +2 more.');
    expect(siteNewsLine(['a'])).toBe('Sites: a.');
  });
});
