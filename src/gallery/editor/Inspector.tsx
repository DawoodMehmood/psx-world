import { useEffect, useState } from 'react';
import { useDraftStore } from '../../world/editDraft';
import { duplicate, FIELDS, loadConsts, select, setConst, readScalar, readVec, redo, remove, revert, save, setDraft, setDraftVec, setEnabled, undo, useEditor, type Field } from './store';

const DEG = 180 / Math.PI;
const clean = (n: number) => +n.toFixed(4);

/** A number box that lets you type freely (a half-typed "0." stays) and commits whole numbers as you go. */
function NumInput({ value, onChange, step, min, disabled, title }: { value: number; onChange: (v: number) => void; step?: number; min?: number; disabled?: boolean; title?: string }) {
  const [text, setText] = useState(String(clean(value)));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setText(String(clean(value)));
  }, [value, focus]);
  return (
    <input
      type="number"
      className="g-num"
      value={text}
      step={step}
      min={min}
      disabled={disabled}
      title={title}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseFloat(e.target.value);
        if (Number.isFinite(v)) onChange(v);
      }}
    />
  );
}

function VecField({ f, draft, info }: { f: Field; draft?: Record<string, unknown>; info: NonNullable<ReturnType<typeof useEditor.getState>['info']> }) {
  const { slots, whole } = readVec(f, info, draft);
  if (whole !== undefined)
    return (
      <div className="g-field">
        <span>{f.label}</span>
        <code className="g-computed" title="Computed in the source: edit it there">
          {whole}
        </code>
      </div>
    );
  return (
    <div className="g-field">
      <span>{f.label}</span>
      <div className="g-vec">
        {slots.map((s, i) => (
          <NumInput
            key={i}
            value={f.angle ? s.value * DEG : s.value}
            step={f.step}
            min={f.min}
            disabled={!s.editable}
            title={s.editable ? undefined : `Computed in the source: ${s.text}`}
            onChange={(v) => setDraftVec(f.key, slots.map((_, j) => (j === i ? (f.angle ? v / DEG : v) : null)))}
          />
        ))}
      </div>
    </div>
  );
}

function ScalarField({ f, draft, info }: { f: Field; draft?: Record<string, unknown>; info: NonNullable<ReturnType<typeof useEditor.getState>['info']> }) {
  const r = readScalar<number | string | boolean>(f, info, draft);
  const set = (v: unknown) => setDraft(f.key, v);
  if (!r.editable)
    return (
      <div className="g-field">
        <span>{f.label}</span>
        <code className="g-computed" title="Computed in the source: edit it there">
          {r.text}
        </code>
      </div>
    );
  return (
    <label className="g-field">
      <span>{f.label}</span>
      {f.kind === 'num' && <NumInput value={f.angle ? (r.value as number) * DEG : (r.value as number)} step={f.step} min={f.min} onChange={(v) => set(f.angle ? v / DEG : f.int ? Math.round(v) : v)} />}
      {f.kind === 'color' && <input type="color" value={r.value as string} onChange={(e) => set(e.target.value)} />}
      {f.kind === 'bool' && <input type="checkbox" checked={r.value as boolean} onChange={(e) => set(e.target.checked)} />}
    </label>
  );
}


/**
 * Where the vehicle bays are: top-level numbers in sitePlan.ts shared by every district. They are baked into the code,
 * so they apply when you Save (the page then reloads) rather than previewing as you type.
 */
function BayLayout() {
  const consts = useEditor((s) => s.consts);
  const drafts = useEditor((s) => s.constDrafts);
  useEffect(() => {
    void loadConsts();
  }, []);
  const bayZ = consts?.BAY_Z;
  if (!consts || bayZ?.kind !== 'array') return null;
  const zs = bayZ.items.map((it, i) => {
    const d = drafts.BAY_Z;
    const v = Array.isArray(d) ? d[i] : undefined;
    return { value: v ?? (it.kind === 'const' ? it.value : 0), editable: it.kind === 'const' };
  });
  const problems: string[] = [];
  zs.forEach((z, i) => {
    if (z.value < 0.55 || z.value > 13.45) problems.push(`bay ${i + 1} is outside the lot`);
    if (i > 0 && z.value - zs[i - 1].value < 1.1) problems.push(`bays ${i} and ${i + 1} overlap`);
  });
  const scalar = (name: 'DOCK_X' | 'STREET_X', label: string) => {
    const c = consts[name];
    if (c?.kind !== 'number') return null;
    const d = drafts[name];
    return (
      <div className="g-field">
        <span>{label}</span>
        <NumInput value={typeof d === 'number' ? d : c.value} step={0.05} onChange={(v) => setConst(name, null, v)} />
      </div>
    );
  };
  return (
    <>
      <h3>Bay layout (all districts)</h3>
      <p className="g-note">Bay rows along the street (z). Applies when you Save, then the page reloads.</p>
      <div className="g-bays">
        {zs.map((z, i) => (
          <NumInput key={i} value={z.value} step={0.1} disabled={!z.editable} title={`Bay ${i + 1}`} onChange={(v) => setConst('BAY_Z', i, v)} />
        ))}
      </div>
      {scalar('DOCK_X', 'Where a vehicle stops (x)')}
      {scalar('STREET_X', 'Where it leaves the lot (x)')}
      {problems.length > 0 && <p className="g-note g-warn">⚠ {problems.join('; ')}. The site-plan tests will fail.</p>}
    </>
  );
}

/** The editor's panel: switch editing on, then click a part in the view to change it. */
export function Inspector() {
  const { enabled, mode, selected, info, copies, parent, instancedOnly, message, busy } = useEditor();
  const drafts = useDraftStore((s) => s.drafts);
  const draft = selected ? drafts[selected] : undefined;
  const constDrafts = useEditor((s) => s.constDrafts);
  const dirty = Object.keys(drafts).length + Object.keys(constDrafts).length;

  return (
    <>
      <h3>Edit parts</h3>
      <label className="g-toggle">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Edit parts (click one in the view)
      </label>
      {enabled && (
        <div className="g-edit">
          {!selected && <p className="g-note">Click a box, cylinder, cone, dome, ball, roof, blob, tree, car, a wall of windows, a bay's lines or cones, or a vehicle (and the fleet that drives them). A click picks the smallest part; use the up arrow to pick what it sits in. Parts are shown unmerged while editing, so counts above are higher than in the city.</p>}
          {selected && !info && <p className="g-note">Loading…</p>}
          {selected && info && (
            <>
              <div className="g-source">
                <code>
                  {info.name} · {selected.split('#')[0]}:{info.line}
                </code>
              </div>
              {parent && (
                <button className="g-btn" onClick={() => void select(parent)} title={`Select the part this one sits in (${parent})`}>
                  ↑ Select the enclosing part
                </button>
              )}
              {copies > 1 && <p className="g-note">Used {copies} times here: an edit applies to every copy.</p>}
              {!instancedOnly && (FIELDS[info.name] ?? []).some((f) => f.key === 'at' || f.key === 'rot' || f.key === 'rotY') && (
              <div className="g-seg">
                <span>Gizmo</span>
                <div>
                  {(['translate', 'rotate'] as const).map((m) => (
                    <button key={m} className={m === mode ? 'on' : ''} onClick={() => useEditor.setState({ mode: m })}>
                      {m === 'translate' ? 'Move' : 'Rotate'}
                    </button>
                  ))}
                </div>
              </div>
              )}
              {instancedOnly && <p className="g-note">Part of the instanced forest: change it with the fields; every tree follows.</p>}
              {(FIELDS[info.name] ?? []).map((f) => (f.kind === 'vec' ? <VecField key={f.key} f={f} draft={draft} info={info} /> : <ScalarField key={f.key} f={f} draft={draft} info={info} />))}
              <div className="g-row g-actions">
                <button className="g-btn" disabled={!info.canStructure || busy} onClick={() => void duplicate()} title={info.canStructure ? 'Copy this part one unit along x' : 'This part is inside a loop or a condition'}>
                  Duplicate
                </button>
                <button className="g-btn danger" disabled={!info.canStructure || busy} onClick={() => void remove()} title={info.canStructure ? 'Remove this part from the source' : 'This part is inside a loop or a condition'}>
                  Delete
                </button>
              </div>
            </>
          )}
          <BayLayout />
          <div className="g-row g-actions">
            <button className="g-btn primary" disabled={!dirty || busy} onClick={() => void save()}>
              Save{dirty ? ` (${dirty})` : ''}
            </button>
            <button className="g-btn" disabled={!dirty} onClick={revert}>
              Revert
            </button>
            <button className="g-btn" disabled={busy} onClick={() => void undo()}>
              Undo
            </button>
            <button className="g-btn" disabled={busy} onClick={() => void redo()}>
              Redo
            </button>
          </div>
          {message && <p className="g-note">{message}</p>}
        </div>
      )}
    </>
  );
}
