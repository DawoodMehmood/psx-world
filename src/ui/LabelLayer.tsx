import { COMPANY_BY_TICKER, siteTier } from '../config/companies';
import { LOT_SIZE, lotBackCorner } from '../config/layout';
import { useCompanyVisual } from '../store/useSimStore';
import { useWorldStore } from '../store/useWorldStore';
import { archetypeHeight } from '../world/buildings';
import { anchorRef } from '../world/labels';

/** Ticker tag over the hovered or selected company. District names are signs in the world. */
export function LabelLayer() {
  const hovered = useWorldStore((s) => s.hoveredTicker);
  const selected = useWorldStore((s) => s.selectedTicker);
  const tagged = [...new Set([selected, hovered].filter((t): t is string => !!t))];
  return (
    <div className="labels">
      {tagged.map((ticker) => (
        <Tag key={ticker} ticker={ticker} />
      ))}
    </div>
  );
}

/** Sits over the middle of the company's current site, so it follows the site as it grows. */
function Tag({ ticker }: { ticker: string }) {
  const c = COMPANY_BY_TICKER[ticker];
  const { tier } = useCompanyVisual(ticker);
  const depth = siteTier(c, tier).depth;
  const [bx, bz] = lotBackCorner(c.sectorId, c.plot);
  return (
    <div key={tier} ref={anchorRef(`tag-${ticker}`, [bx + LOT_SIZE / 2, archetypeHeight(c.archetype, c.scale) + 0.8, bz + depth / 2])} className="tag" style={{ borderColor: c.accent }}>
      {ticker}
    </div>
  );
}
