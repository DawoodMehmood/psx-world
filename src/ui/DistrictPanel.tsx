import { useEffect } from 'react';
import { COMPANIES } from '../config/companies';
import { SECTOR_BY_ID, type SectorId } from '../config/sectors';
import { ACTIVITY, DIRECTION, type CompanyState, type SectorState } from '../engine/types';
import { useSimStore } from '../store/useSimStore';
import { useWorldStore } from '../store/useWorldStore';

const nice = (level: string) => level.charAt(0) + level.slice(1).toLowerCase().replace('_', ' ');
const ARROW: Record<string, string> = { DOWN_HARD: '▼▼', DOWN: '▼', FLAT: '–', UP: '▲', UP_HARD: '▲▲' };
const MOOD_LABEL = { RALLY: 'Rally', MIXED: 'Mixed', SELLOFF: 'Selloff' } as const;

/** Card for a district (SPEC §15): breadth, activity, mood, and which companies drive it. */
export function DistrictPanel() {
  const id = useWorldStore((s) => s.selectedSector);
  const selectSector = useWorldStore((s) => s.selectSector);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && selectSector(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectSector]);
  if (!id) return null;
  return <DistrictCard id={id} onClose={() => selectSector(null)} />;
}

function DistrictCard({ id, onClose }: { id: SectorId; onClose: () => void }) {
  const sector = SECTOR_BY_ID[id];
  const state = useSimStore((s) => s.snapshots[s.index].sectors[id]);
  const companies = useSimStore((s) => s.snapshots[s.index].companies);
  const select = useWorldStore((s) => s.select);
  const members = COMPANIES.filter((c) => c.sectorId === id).map((c) => ({ def: c, state: companies[c.ticker] }));
  const breadthPct = Math.round(state.breadth * 100);
  const activityIdx = ACTIVITY.indexOf(state.activity);
  return (
    <aside className="panel info district" style={{ borderTopColor: sector.color }}>
      <button className="close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="ticker" style={{ color: sector.color }}>
        {sector.name}
      </div>
      <div className="name">District</div>
      <span className={`chip mood-${state.mood.toLowerCase()}`}>{MOOD_LABEL[state.mood]}</span>

      <div className="levels">
        <div className="level">
          <span className="label">Breadth</span>
          <span className="breadth" title="Share of companies up minus share down">
            <span className="breadth-fill" style={breadthStyle(state.breadth)} />
            <span className="breadth-mid" />
          </span>
          <span className="value">
            {breadthPct > 0 ? '+' : ''}
            {breadthPct}%
          </span>
        </div>
        <div className="level">
          <span className="label">Activity</span>
          <span className="dots">
            {ACTIVITY.map((l, i) => (
              <i key={l} className={i === activityIdx ? 'on' : ''} />
            ))}
          </span>
          <span className="value">{nice(state.activity)}</span>
        </div>
      </div>

      <div className="members">
        {members.map(({ def, state: c }) => (
          <button key={def.ticker} className="member" onClick={() => select(def.ticker)} title={`Open ${def.name}`}>
            <span className="member-ticker" style={{ color: def.accent }}>
              {def.ticker}
            </span>
            <span className={`member-dir dir-${dirClass(c)}`}>
              {ARROW[c.direction]} {c.dayChangePct >= 0 ? '+' : ''}
              {c.dayChangePct.toFixed(1)}%
            </span>
            <span className="member-meta">
              {nice(c.activity)} · {nice(c.health)}
            </span>
          </button>
        ))}
      </div>

      <div className="why">
        <div className="why-title">Why it looks like this</div>
        <ul>
          {explainSector(state, members.map((m) => m.state)).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/** The meter fills from the middle: right and warm for up, left and cool for down. */
function breadthStyle(b: number) {
  const w = Math.abs(b) * 50;
  return b >= 0 ? { left: '50%', width: `${w}%`, background: '#ffa526' } : { left: `${50 - w}%`, width: `${w}%`, background: '#3d7bff' };
}

function dirClass(c: CompanyState) {
  const d = DIRECTION.indexOf(c.direction);
  return d > 2 ? 'up' : d < 2 ? 'down' : 'flat';
}

function explainSector(s: SectorState, members: CompanyState[]): string[] {
  const up = members.filter((c) => DIRECTION.indexOf(c.direction) > 2).map((c) => c.ticker);
  const down = members.filter((c) => DIRECTION.indexOf(c.direction) < 2).map((c) => c.ticker);
  const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0]);
  const why: string[] = [];
  if (s.mood === 'RALLY') why.push(`Rally: ${list(up)} are all up today, so bunting is out and the lamps glow warm.`);
  else if (s.mood === 'SELLOFF') why.push(`Selloff: ${list(down)} are all down today, so the lamps glow cool and the district flag is low.`);
  else if (up.length && down.length) why.push(`Mixed: ${list(up)} up, ${list(down)} down, so the district flag sits near half-mast.`);
  else if (up.length) why.push(`Leaning up: ${list(up)} ${up.length > 1 ? 'are' : 'is'} up, but not the whole district, so no bunting.`);
  else if (down.length) why.push(`Leaning down: ${list(down)} ${down.length > 1 ? 'are' : 'is'} down; the lamps cool a little.`);
  else why.push('Flat: no company is moving much today.');
  why.push(
    {
      QUIET: 'Quiet: the landmark idles and few cars use the district streets.',
      NORMAL: 'Normal activity on the district streets.',
      BUSY: 'Busy: the landmark works harder and more cars are about.',
      FRENZY: 'Frenzy: the landmark is flat out and the streets are full.',
    }[s.activity],
  );
  return why;
}
