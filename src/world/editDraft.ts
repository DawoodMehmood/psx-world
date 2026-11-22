import { create } from 'zustand';

/*
 * Support for the dev-only visual asset editor (see tools/assetEditor.ts).
 *
 * In dev, every kit shape carries `__src`, the id of the JSX element it was
 * written in. The editor keeps unsaved changes as "drafts" keyed by that id; a
 * shape reads its draft and draws with the changed values, so a preview is the
 * real component, and every copy of a part made in a loop follows along.
 */

type Draft = Record<string, unknown>;

export const useDraftStore = create<{ drafts: Record<string, Draft> }>(() => ({ drafts: {} }));

/** Draft values laid over a shape's props. An array draft changes only the entries it has (null leaves one alone). */
export function mergeDraft<T extends object>(props: T, draft: Draft | undefined): T {
  if (!draft) return props;
  const out = { ...props } as Record<string, unknown>;
  for (const [key, value] of Object.entries(draft)) {
    const base = out[key];
    if (Array.isArray(value)) {
      const old = Array.isArray(base) ? base : [];
      out[key] = value.map((v, i) => v ?? old[i] ?? 0);
    } else out[key] = value;
  }
  return out as T;
}

const useDraftDev = <T extends { __src?: string }>(props: T): T => {
  const src = props.__src;
  const draft = useDraftStore((s) => (src ? s.drafts[src] : undefined));
  return mergeDraft(props, draft);
};

/** A shape calls this with its props. Outside dev it is a plain pass-through that costs nothing. */
export const useDraft: <T extends { __src?: string }>(props: T) => T = import.meta.env.DEV ? useDraftDev : (p) => p;

/** Changes whenever any unsaved edit does, so something built from shapes (the instanced forest) can read them again. Constant outside dev. */
export const useDraftsVersion: () => unknown = import.meta.env.DEV ? () => useDraftStore((s) => s.drafts) : () => null;
