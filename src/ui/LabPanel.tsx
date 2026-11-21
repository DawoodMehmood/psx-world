import { useEffect, useMemo, useState } from 'react';
import { COMPANIES } from '../config/companies';
import { applyOverride, LAB_EVENTS, labTour, type BuildMode, type LabBuild, type Override } from '../engine/lab';
import { kindOf, MAX_LEVEL } from '../engine/ladder';
import { ACTIVITY, DIRECTION, HEALTH, VOLATILITY } from '../engine/types';
import { useSimStore } from '../store/useSimStore';
import { useWorldStore } from '../store/useWorldStore';
import { EVENT_LABEL } from './explain';

const ROWS = [
  { key: 'direction', label: 'Today', levels: DIRECTION },
  { key: 'activity', label: 'Activity', levels: ACTIVITY },
  { key: 'volatility', label: 'Volatility', levels: VOLATILITY },
  { key: 'health', label: 'Health', levels: HEALTH },
] as const;

const nice = (level: string) => level.charAt(0) + level.slice(1).toLowerCase().replace('_', ' ');
const KIND = { CORE: 'core', BUILDING: 'building', UPGRADE: 'upgrade' } as const;

/** Key B toggles the lab; it also pauses playback so what you set stays on screen. */
export function useLabKey() {
  const setShow = useWorldStore((s) => s.setShowLab);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'b' || e.key === 'B') setShow(!useWorldStore.getState().showLab);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setShow]);
}

/**
 * The lab, as the second tab of the bottom dock: pick a company, then set any level of the ladder, any stage of its
 * construction or wind-down, any health, activity, direction or volatility,
 * and switch on any event, to see exactly how it looks. Step through every
 * state in order with the arrows. Nothing here touches the simulation.
 */
export function LabBody() {
  const selected = useWorldStore((s) => s.selectedTicker);
  const select = useWorldStore((s) => s.select);
  const ticker = selected ?? COMPANIES[0].ticker;
  const override = useSimStore((s) => s.overrides[ticker]);
  const raw = useSimStore((s) => s.snapshots[s.index].companies[ticker]);
  const setOverride = useSimStore((s) => s.setOverride);
  const setPlaying = useSimStore((s) => s.setPlaying);
  const tour = useMemo(labTour, []);
  const [step, setStep] = useState(0);

  const flyTo = useWorldStore((s) => s.flyTo);
  // the lab pauses the simulation while it is open and lets it carry on, if it was playing, when you go back to the player
  useEffect(() => {
    const wasPlaying = useSimStore.getState().playing;
    setPlaying(false);
    return () => {
      if (wasPlaying) useSimStore.getState().setPlaying(true);
    };
  }, [setPlaying]);
  // opening the lab, and every change of company inside it, flies the camera there
  useEffect(() => {
    if (!selected) select(ticker);
    flyTo(ticker);
  }, [selected, ticker, select, flyTo]);

  const state = applyOverride(raw, override);
  const build: LabBuild = override?.build ?? { level: raw.level, mode: 'idle', q: 0.5 };
  const events = override?.events ?? [];

  const patch = (next: Partial<Override>) => setOverride(ticker, { ...override, ...next });
  const setBuild = (b: Partial<LabBuild>) => patch({ build: { ...build, ...b } });
  const go = (i: number) => {
    const n = (i + tour.length) % tour.length;
    setStep(n);
    const { label: _label, ...b } = tour[n];
    patch({ build: b });
  };
  const setLevel = (key: 'direction' | 'activity' | 'volatility' | 'health', value: string) => {
    const next = { ...override } as Record<string, unknown>;
    if (value === '') delete next[key];
    else next[key] = value;
    setOverride(ticker, next as Override);
  };
  const toggleEvent = (type: (typeof LAB_EVENTS)[number]) => patch({ events: events.includes(type) ? events.filter((t) => t !== type) : [...events, type] });
  const pads = state.slots.filter((s) => s.stage === 'COMPLETE').length;
  const ups = state.upgrades.filter((s) => s.stage === 'COMPLETE').length;

  return (
    <div className="lab-body" aria-label="Lab">
      <div className="lab-col">
      <p className="lab-note">Forces what you pick on the plot. Simulation time is paused; press B to switch tabs.</p>

      <label className="lab-row">
        Company
        <select value={ticker} onChange={(e) => select(e.target.value)}>
          {COMPANIES.map((c) => (
            <option key={c.ticker} value={c.ticker}>
              {c.ticker} · {c.archetype}
            </option>
          ))}
        </select>
      </label>

      <button className="link" onClick={() => flyTo(ticker)}>
        Fly the camera here
      </button>

      <h3>Every stage, in order</h3>
      <div className="lab-tour">
        <button onClick={() => go(step - 1)} aria-label="Previous stage">
          ◀
        </button>
        <span>
          {step + 1}/{tour.length} · {tour[step].label}
        </span>
        <button onClick={() => go(step + 1)} aria-label="Next stage">
          ▶
        </button>
      </div>

      <h3>Site</h3>
      <label className="lab-row">
        Level
        <select value={build.level} onChange={(e) => setBuild({ level: Number(e.target.value) })}>
          {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((l) => (
            <option key={l} value={l}>
              {l} · {KIND[kindOf(l)]}
            </option>
          ))}
        </select>
      </label>
      <label className="lab-row">
        Work
        <select value={build.mode} onChange={(e) => setBuild({ mode: e.target.value as BuildMode })}>
          <option value="idle">Nothing underway</option>
          <option value="up" disabled={build.level >= MAX_LEVEL}>
            Building the next level
          </option>
          <option value="down" disabled={build.level <= 1}>
            Winding this level down
          </option>
        </select>
      </label>
      {build.mode !== 'idle' && (
        <label className="lab-row">
          Progress {Math.round(build.q * 100)}%
          <input type="range" min={1} max={99} value={Math.round(build.q * 100)} onChange={(e) => setBuild({ q: Number(e.target.value) / 100 })} />
        </label>
      )}
      <p className="lab-note">
        Tier {state.tier} · {pads}/6 pads · {ups}/3 upgrades
        {state.expansion ? ` · enlarging the site (${state.expansion.stage.toLowerCase()})` : ''}
      </p>

      </div>
      <div className="lab-col">
      <h3>State</h3>
      {ROWS.map((row) => (
        <label className="lab-row" key={row.key}>
          {row.label}
          <select value={override?.[row.key] ?? ''} onChange={(e) => setLevel(row.key, e.target.value)}>
            <option value="">Sim: {nice(raw[row.key])}</option>
            {row.levels.map((l) => (
              <option key={l} value={l}>
                {nice(l)}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="lab-row">
        Halted
        <input type="checkbox" checked={!!override?.halted} onChange={(e) => patch({ halted: e.target.checked })} />
      </label>

      </div>
      <div className="lab-col">
      <h3>Events (stay on until switched off)</h3>
      <div className="lab-chips">
        {LAB_EVENTS.map((t) => (
          <button key={t} className={events.includes(t) ? 'on' : ''} onClick={() => toggleEvent(t)}>
            {EVENT_LABEL[t] ?? t}
          </button>
        ))}
      </div>

      <button className="link" onClick={() => setOverride(ticker, null)}>
        Back to the simulation
      </button>
      </div>
    </div>
  );
}
