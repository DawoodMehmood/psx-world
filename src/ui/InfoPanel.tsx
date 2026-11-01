import { useEffect, useState } from 'react';
import { COMPANY_BY_TICKER, SITE_TIERS } from '../config/companies';
import { SECTOR_BY_ID } from '../config/sectors';
import { ACTIVITY, DIRECTION, HEALTH, VOLATILITY } from '../engine/types';
import { useCompany, useSimStore, type Override } from '../store/useSimStore';
import { useWorldStore } from '../store/useWorldStore';
import { EVENT_LABEL, explain } from './explain';

const ROWS = [
  { key: 'direction', label: 'Today', levels: DIRECTION },
  { key: 'activity', label: 'Activity', levels: ACTIVITY },
  { key: 'volatility', label: 'Volatility', levels: VOLATILITY },
  { key: 'health', label: 'Health', levels: HEALTH },
] as const;

const nice = (level: string) => level.charAt(0) + level.slice(1).toLowerCase().replace('_', ' ');

/** Compact company card: price, each state dimension, active events and why the plot looks the way it does. */
export function InfoPanel() {
  const ticker = useWorldStore((s) => s.selectedTicker);
  const select = useWorldStore((s) => s.select);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && select(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select]);

  if (!ticker) return null;
  return <CompanyCard ticker={ticker} onClose={() => select(null)} />;
}

function CompanyCard({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const company = COMPANY_BY_TICKER[ticker];
  const sector = SECTOR_BY_ID[company.sectorId];
  const state = useCompany(ticker);
  const override = useSimStore((s) => s.overrides[ticker]);
  const forced = !!override;
  const up = state.dayChangePct >= 0;

  return (
    <aside className="panel info" style={{ borderTopColor: company.accent }}>
      <button className="close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="ticker" style={{ color: company.accent }}>
        {company.ticker}
      </div>
      <div className="name">{company.name}</div>
      <span className="chip" style={{ background: sector.color }}>
        {sector.name}
      </span>
      <div className="price">
        <strong>Rs {state.price.toFixed(2)}</strong>
        <span className={up ? 'up' : 'down'}>
          {up ? '▲' : '▼'} {Math.abs(state.dayChangePct).toFixed(2)}%
        </span>
        <em>simulated</em>
      </div>

      <div className="levels">
        {ROWS.map((row) => {
          const value = state[row.key];
          const idx = (row.levels as readonly string[]).indexOf(value);
          return (
            <div className="level" key={row.key}>
              <span className="label">{row.label}</span>
              <span className="dots">
                {row.levels.map((l, i) => (
                  <i key={l} className={i === idx ? 'on' : ''} />
                ))}
              </span>
              <span className="value">{nice(value)}</span>
            </div>
          );
        })}
      </div>

      <SiteRow ticker={ticker} tier={state.tier} built={state.slots.filter((s) => s.stage === 'COMPLETE').length} />

      {(state.events.length > 0 || state.halted) && (
        <div className="events">
          {state.events.map((e) => (
            <span key={e.id} className="event">
              {EVENT_LABEL[e.type]}
            </span>
          ))}
        </div>
      )}

      <div className="why">
        <div className="why-title">Why it looks like this</div>
        <ul>
          {explain(state, forced).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <ForceState ticker={ticker} override={override} />
    </aside>
  );
}

/** Site tier and how many of its pads are built so far. */
function SiteRow({ ticker, tier, built }: { ticker: string; tier: number; built: number }) {
  const tiers = SITE_TIERS[COMPANY_BY_TICKER[ticker].archetype];
  const pads = tiers.slice(0, tier).reduce((n, t) => n + t.slots, 0);
  return (
    <div className="level">
      <span className="label">Site</span>
      <span className="dots">
        {tiers.map((_, i) => (
          <i key={i} className={i < tier ? 'on' : ''} />
        ))}
      </span>
      <span className="value">
        Tier {tier}
        {pads > 0 ? ` · ${built}/${pads} pads` : ''}
      </span>
    </div>
  );
}

/** Demo-only: pin some of the company's levels to test how they look. */
function ForceState({ ticker, override }: { ticker: string; override?: Override }) {
  const [open, setOpen] = useState(!!override);
  const setOverride = useSimStore((s) => s.setOverride);
  const set = (key: keyof Override, value: string) => {
    const next: Override = { ...override };
    if (value === '') delete next[key];
    else if (key === 'halted') next.halted = value === 'yes';
    else (next as Record<string, string>)[key] = value;
    setOverride(ticker, next);
  };
  return (
    <div className="force">
      <button className="link" onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} Force state (demo)
      </button>
      {open && (
        <div className="force-grid">
          {ROWS.map((row) => (
            <label key={row.key}>
              {row.label}
              <select value={override?.[row.key] ?? ''} onChange={(e) => set(row.key, e.target.value)}>
                <option value="">Simulated</option>
                {row.levels.map((l) => (
                  <option key={l} value={l}>
                    {nice(l)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            Halted
            <select value={override?.halted === undefined ? '' : override.halted ? 'yes' : 'no'} onChange={(e) => set('halted', e.target.value)}>
              <option value="">Simulated</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          {override && (
            <button className="link" onClick={() => setOverride(ticker, null)}>
              Clear overrides
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Banner shown whenever any company is showing forced demo state instead of the simulation. */
export function OverrideBanner() {
  const overrides = useSimStore((s) => s.overrides);
  const setOverride = useSimStore((s) => s.setOverride);
  const tickers = Object.keys(overrides);
  if (!tickers.length) return null;
  return (
    <div className="override-banner">
      Override active: {tickers.join(', ')} showing forced state
      <button onClick={() => tickers.forEach((t) => setOverride(t, null))}>Clear</button>
    </div>
  );
}
