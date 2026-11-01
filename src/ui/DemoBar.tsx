import { useEffect, useMemo, useRef } from 'react';
import { TICKS_PER_DAY } from '../engine/types';
import { clockTime, SPEEDS, TICK_MS, useClock, useSimStore } from '../store/useSimStore';
import { SCENARIOS } from '../sim/scenarios';
import { siteNews, siteNewsLine } from './siteNews';

/** Advances the simulation while playing. */
export function Playback() {
  const playing = useSimStore((s) => s.playing);
  const speed = useSimStore((s) => s.speed);
  const stepTick = useSimStore((s) => s.stepTick);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => stepTick(1), TICK_MS / speed);
    return () => window.clearInterval(id);
  }, [playing, speed, stepTick]);
  return null;
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d={d} fill="currentColor" />
  </svg>
);
const ICONS = {
  play: 'M7 4.5v15l13-7.5z',
  pause: 'M6 4h4.5v16H6zM13.5 4H18v16h-4.5z',
  stepFwd: 'M5 5v14l10-7zM16 5h3v14h-3z',
  stepBack: 'M19 5v14L9 12zM5 5h3v14H5z',
  dayFwd: 'M3 5v14l8-7zM11 5v14l8-7zM19 5h2.5v14H19z',
  dayBack: 'M21 5v14l-8-7zM13 5v14l-8-7zM2.5 5H5v14H2.5z',
  reset: 'M12 4a8 8 0 1 1-7.4 5h2.2A6 6 0 1 0 12 6v3L7.5 5 12 1z',
};

/** Bottom bar: day caption, transport controls, speed, scrubber and clock. */
export function DemoBar() {
  const { scenario, snapshots, index, playing, speed } = useSimStore();
  const { setPlaying, stepTick, stepDay, setSpeed, setIndex, reset, loadScenario } = useSimStore();
  const clock = useClock();
  // What changed on the sites overnight: the day's start against the day before's.
  const news = useMemo(() => {
    const at = (day: number) => snapshots[(day - 1) * TICKS_PER_DAY]?.companies;
    return clock.day > 1 ? siteNewsLine(siteNews(at(clock.day - 1), at(clock.day))) : '';
  }, [snapshots, clock.day]);
  const days = snapshots.length / TICKS_PER_DAY;
  const bar = useRef<HTMLDivElement>(null);
  // Cards that sit above the bar (company and district cards) read its height from --demo-h, because it grows when its controls wrap.
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const publish = () => document.documentElement.style.setProperty('--demo-h', `${el.offsetHeight}px`);
    publish();
    const watcher = new ResizeObserver(publish);
    watcher.observe(el);
    return () => watcher.disconnect();
  }, []);

  return (
    <div className="panel demo" ref={bar}>
      <div className="caption">
        <span className="day">Day {clock.day}</span>
        <span className="note">{[scenario.notes[clock.day], news].filter(Boolean).join(' ')}</span>
        {SCENARIOS.length > 1 && (
          <select value={scenario.id} onChange={(e) => loadScenario(e.target.value)} aria-label="Scenario">
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="controls">
        <button onClick={reset} title="Reset">
          <Icon d={ICONS.reset} />
        </button>
        <span className="sep" />
        <button onClick={() => stepDay(-1)} title="Back a day">
          <Icon d={ICONS.dayBack} />
        </button>
        <button onClick={() => stepTick(-1)} title="Back a tick">
          <Icon d={ICONS.stepBack} />
        </button>
        <button className="play" onClick={() => setPlaying(!playing)} title={playing ? 'Pause' : 'Play'}>
          <Icon d={playing ? ICONS.pause : ICONS.play} />
        </button>
        <button onClick={() => stepTick(1)} title="Forward a tick">
          <Icon d={ICONS.stepFwd} />
        </button>
        <button onClick={() => stepDay(1)} title="Forward a day">
          <Icon d={ICONS.dayFwd} />
        </button>
        <button className="speed" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length])} title="Speed">
          {speed}×
        </button>
        <div className="scrub">
          <input type="range" min={0} max={snapshots.length - 1} value={index} onChange={(e) => setIndex(Number(e.target.value))} aria-label="Scenario position" />
          <div className="ticks">
            {Array.from({ length: days }, (_, d) => (
              <span key={d} className={d + 1 === clock.day ? 'on' : ''} />
            ))}
          </div>
        </div>
        <div className="clock">
          <strong>{clockTime(clock.tick)}</strong>
          <span>Simulated</span>
        </div>
      </div>
    </div>
  );
}
