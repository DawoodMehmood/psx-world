import { useEffect, useState } from 'react';
import { useDraftStore } from '../../world/editDraft';
import { duplicate, FIELDS, select, readScalar, readVec, redo, remove, revert, save, setDraft, setDraftVec, setEnabled, undo, useEditor, type Field } from './store';

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

/** The editor's panel: switch editing on, then click a part in the view to change it. */
export function Inspector() {
  const { enabled, mode, selected, info, copies, parent, message, busy } = useEditor();
  const drafts = useDraftStore((s) => s.drafts);
  const draft = selected ? drafts[selected] : undefined;
  const dirty = Object.keys(drafts).length;

  return (
    <>
      <h3>Edit parts</h3>
      <label className="g-toggle">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Edit parts (click one in the view)
      </label>
      {enabled && (
        <div className="g-edit">
          {!selected && <p className="g-note">Click a box, cylinder, cone, dome, ball, roof, blob, tree, car or a wall of windows. A click picks the smallest part; use the up arrow to pick what it sits in. Parts are shown unmerged while editing, so counts above are higher than in the city.</p>}
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
