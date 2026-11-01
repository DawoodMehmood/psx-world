import { useEffect, type ReactNode } from 'react';
import { useWorldStore } from '../store/useWorldStore';

/** A sunlit patch and a cloud-shadow patch: the direction channel. */
function PoolIcon() {
  return (
    <svg viewBox="0 0 36 22" width="36" height="22" aria-hidden="true">
      <ellipse cx="10" cy="11" rx="9" ry="6" fill="#ffe27a" />
      <ellipse cx="26" cy="11" rx="9" ry="6" fill="#2b3a5c" opacity="0.55" />
    </svg>
  );
}

function Row({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="legend-row">
      <div className="legend-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}

const EVENTS: [string, string][] = [
  ['Confetti', 'big jump up'],
  ['Siren and smoke', 'big drop'],
  ['Searchlights', 'volume spike'],
  ['Gold ring', 'new 20-day high'],
  ['Rain cloud', 'new 20-day low'],
  ['Barrier tape', 'trading halted'],
  ['Green pulse', 'trading resumed'],
  ['Coin shower', 'dividend'],
];

/** What each visual means (SPEC §7): one channel per dimension, in plain words. */
export function Legend() {
  const show = useWorldStore((s) => s.showLegend);
  const setShow = useWorldStore((s) => s.setShowLegend);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'l' || e.key === 'L') setShow(!useWorldStore.getState().showLegend);
      if (e.key === 'Escape') setShow(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setShow]);

  if (!show) return null;
  return (
    <aside className="panel legend" aria-label="Legend">
      <button className="close" onClick={() => setShow(false)} aria-label="Close legend">
        ×
      </button>
      <h2>How to read the city</h2>

      <h3>Each company</h3>
      <Row icon={<PoolIcon />} title="Light on the ground: today">
        A warm sunlit patch over the plot when the price is up today, a cloud shadow when it is down, plain daylight when flat. The same light and shade appears over a district's park and the Exchange plaza for how many companies are up.
      </Row>
      <Row icon={<span className="glyph">»</span>} title="Movement: trading activity">
        More people, vehicles and machines, moving faster, when volume is high. Busy is not the same as up: a falling stock can be frantic.
      </Row>
      <Row icon={<span className="glyph">≈</span>} title="Rhythm: volatility">
        People, vehicles and machines run instead of stroll when the price swings around.
      </Row>
      <Row icon={<span className="glyph">▲</span>} title="The site: size and health">
        A bigger market cap builds: cranes, new buildings on reserved pads, then a bigger site; a falling one winds buildings down under tarps. Health is separate: a weak company idles machines, puts up TO LET boards, cones off bays and lets weeds grow.
      </Row>
      <div className="legend-events">
        {EVENTS.map(([what, means]) => (
          <span key={what}>
            <strong>{what}</strong> {means}
          </span>
        ))}
      </div>

      <h3>Each district (its park)</h3>
      <Row icon={<span className="glyph">✦</span>} title="Landmark and lamps">
        The landmark works harder when the sector is busy. Lamps shine bright when most of its companies are up and dim when most are down, with a sunlit or shaded patch over the park. Bunting goes up only when the whole sector rallies.
      </Row>

      <h3>The whole market</h3>
      <Row icon={<span className="glyph">☼</span>} title="Exchange and sky">
        The Exchange's dome light and the light over its plaza follow the whole market; its plaza fills up when trading is busy. The sky warms in a broad rally, clouds over in a broad selloff and rains when the market is stormy.
      </Row>

      <p className="legend-note">Building height comes from company size, never from price.</p>
    </aside>
  );
}

export function LegendButton() {
  const show = useWorldStore((s) => s.showLegend);
  const setShow = useWorldStore((s) => s.setShowLegend);
  return (
    <button className={`legend-button${show ? ' on' : ''}`} onClick={() => setShow(!show)} title="Legend (L)">
      Legend
    </button>
  );
}
