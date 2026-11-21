/**
 * Where a component's source lives, found by reading the file in dev rather
 * than from a hand-kept table, so the line number follows your edits.
 */
const files = import.meta.glob('/src/world/**/*.tsx', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

export interface SourceRef {
  /** Repo-relative path, e.g. src/world/agents.tsx */
  path: string;
  /** 1-based line of the export, or null when it could not be found. */
  line: number | null;
}

export async function locate(file: string, symbol: string): Promise<SourceRef> {
  const path = file.replace(/^\//, '');
  const load = files[file];
  if (!load) return { path, line: null };
  const text = await load();
  const re = new RegExp(`^export (?:default )?(?:function|const) ${symbol}\\b`);
  const index = text.split('\n').findIndex((l) => re.test(l));
  return { path, line: index < 0 ? null : index + 1 };
}
