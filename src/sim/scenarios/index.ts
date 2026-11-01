import type { Scenario } from '../types';
import { luckyInFocus } from './luckyInFocus';
import { twoMonths } from './twoMonths';

/** The first one loads at start. */
export const SCENARIOS: Scenario[] = [twoMonths, luckyInFocus];
