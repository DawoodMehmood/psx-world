import { useEffect, type ReactNode } from 'react';
import { BEACON } from '../world/motion';
import { useWorldStore } from '../store/useWorldStore';

/** Three tiny masts with the flag high, half and low: the direction channel. */
function FlagIcon() {
  return (
    <svg viewBox="0 0 36 22" width="36" height="22" aria-hidden="true">
      {[
        [5, 3],
        [17, 8],
        [29, 13],
      ].map(([x, y]) => (
        <g key={x}>
          <line x1={x} y1={2} x2={x} y2={21} stroke="currentColor" strokeWidth={1.5} />
          <rect x={x + 1} y={y} width={6} height={5} rx={1} fill="#e8524a" />
        </g>
      ))}
    </svg>
  );
}

const Dot = ({ color }: { color: string }) => <i className="dot" style={{ background: color }} />;

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
      <Row icon={<FlagIcon />} title="Flag on the mast: today">
        High when the price is up today, half-mast when flat, low when down.
      </Row>
      <Row
        icon={
          <span className="swatches">
            <Dot color={BEACON.UP_HARD} />
            <Dot color={BEACON.FLAT} />
            <Dot color={BEACON.DOWN_HARD} />
          </span>
        }
        title="Light on top of the mast"
      >
        Warm orange when up, white when flat, cool blue when down. The same colors are used for districts and the whole market.
      </Row>
      <Row icon={<span className="glyph">»</span>} title="Movement: trading activity">
        More people, vehicles and machines, moving faster, when volume is high. Busy is not the same as up: a falling stock can be frantic.
      </Row>
      <Row icon={<span className="glyph">≈</span>} title="Rhythm: volatility">
        Machines stutter, the flag flaps hard and the light flickers when the price swings around.
      </Row>
      <Row icon={<span className="glyph">▲</span>} title="The site: long-term health">
        A strong company builds: cranes, new buildings on reserved pads, then a bigger site. A weak one winds down: idle machines, TO LET boards, coned-off bays, weeds. Nothing is ever torn down.
      </Row>
      <div className="legend-events">
        {EVENTS.map(([what, means]) => (
          <span key={what}>
            <strong>{what}</strong> {means}
          </span>
        ))}
      </div>

      <h3>Each district (its park)</h3>
      <Row icon={<span className="glyph">✦</span>} title="Landmark, lamps, flag">
        The landmark works harder when the sector is busy. Lamps glow warm when most of its companies are up and cool when most are down; the district flag follows the same balance. Bunting goes up only when the whole sector rallies.
      </Row>

      <h3>The whole market</h3>
      <Row icon={<span className="glyph">☼</span>} title="Exchange and sky">
        The Exchange beacon and the big flag on its plaza follow the whole market; its plaza fills up when trading is busy. The sky warms in a broad rally, clouds over in a broad selloff and rains when the market is stormy.
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
