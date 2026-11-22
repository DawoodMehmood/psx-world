import { readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { applyChanges, deletePart, describePart, duplicatePart, listParts, tagParts, type Changes } from './editorParts.ts';

/**
 * Dev-only support for the visual asset editor (`?assets`, SPEC backlog).
 *
 * 1. Tags every kit shape in src/world with where it comes from (`__src`), so
 *    clicking a mesh finds its JSX element.
 * 2. Serves a few endpoints that read and rewrite those elements in the
 *    source files. Vite's file watcher then hot-reloads the change, so what
 *    you save is real code you can commit.
 *
 * It only exists under `vite` (serve), never in a build. Writes are limited to
 * src/world/*.tsx, and only JSON posts are accepted, which a web page on another
 * origin cannot send to localhost without a CORS preflight this server never answers.
 */
export function assetEditor(): Plugin {
  let root = '';
  const history: { file: string; before: string; after: string; label: string }[] = [];
  const redo: typeof history = [];

  const worldDir = () => resolve(root, 'src/world') + sep;
  const isWorldFile = (abs: string) => abs.startsWith(worldDir()) && abs.endsWith('.tsx');
  const rel = (abs: string) => relative(root, abs).split(sep).join('/');

  /** `src/world/x.tsx#3` → the file and the part index. */
  function resolveId(id: string): { abs: string; path: string; index: number } {
    const m = /^(src\/world\/[\w./-]+\.tsx)#(\d+)$/.exec(id);
    if (!m) throw new Error(`bad part id ${id}`);
    const abs = resolve(root, m[1]);
    if (!isWorldFile(abs)) throw new Error(`not an editable file: ${m[1]}`);
    return { abs, path: m[1], index: +m[2] };
  }

  function write(abs: string, before: string, after: string, label: string) {
    // never write source that no longer parses
    listParts(after, abs);
    writeFileSync(abs, after);
    history.push({ file: abs, before, after, label });
    redo.length = 0;
  }

  async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
    if (!/^application\/json/.test(req.headers['content-type'] ?? '')) throw new Error('JSON only');
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of req) {
      size += (c as Buffer).length;
      if (size > 1e6) throw new Error('body too large');
      chunks.push(c as Buffer);
    }
    return JSON.parse(Buffer.concat(chunks).toString() || '{}');
  }

  async function handle(req: IncomingMessage, res: ServerResponse, route: string, query: URLSearchParams) {
    const send = (status: number, data: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };
    try {
      if (req.method === 'GET' && route === 'part') {
        const { abs, index } = resolveId(query.get('id') ?? '');
        const code = readFileSync(abs, 'utf8');
        const part = listParts(code, abs)[index];
        if (!part) return send(404, { error: 'no such part' });
        return send(200, describePart(code, part));
      }
      if (req.method !== 'POST') return send(405, { error: 'POST only' });
      const b = await body(req);

      if (route === 'save') {
        const edits = b.edits as { id: string; changes: Changes }[];
        const byFile = new Map<string, { path: string; list: { index: number; changes: Changes }[] }>();
        for (const e of edits) {
          const { abs, path, index } = resolveId(e.id);
          if (!byFile.has(abs)) byFile.set(abs, { path, list: [] });
          byFile.get(abs)!.list.push({ index, changes: e.changes });
        }
        for (const [abs, { path, list }] of byFile) {
          const before = readFileSync(abs, 'utf8');
          let code = before;
          // each edit is checked against the file as it stands, so a refusal leaves everything untouched
          for (const e of list) code = applyChanges(code, e.index, e.changes, abs);
          if (code !== before) write(abs, before, code, `${list.length} edit${list.length === 1 ? '' : 's'} in ${path}`);
        }
        return send(200, { ok: true });
      }
      if (route === 'duplicate') {
        const { abs, index, path } = resolveId(b.id as string);
        const before = readFileSync(abs, 'utf8');
        write(abs, before, duplicatePart(before, index, b.offset as [number, number, number], abs), `duplicate in ${path}`);
        return send(200, { ok: true, id: `${path}#${index + 1}` });
      }
      if (route === 'delete') {
        const { abs, index, path } = resolveId(b.id as string);
        const before = readFileSync(abs, 'utf8');
        write(abs, before, deletePart(before, index, abs), `delete in ${path}`);
        return send(200, { ok: true });
      }
      if (route === 'undo' || route === 'redo') {
        const from = route === 'undo' ? history : redo;
        const to = route === 'undo' ? redo : history;
        const step = from.pop();
        if (!step) return send(200, { ok: false, label: `nothing to ${route}` });
        writeFileSync(step.file, route === 'undo' ? step.before : step.after);
        to.push(step);
        return send(200, { ok: true, label: `${route === 'undo' ? 'undid' : 'redid'} ${step.label}` });
      }
      return send(404, { error: 'unknown route' });
    } catch (e) {
      return send(400, { error: (e as Error).message });
    }
  }

  return {
    name: 'psx-asset-editor',
    apply: 'serve',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
    },
    transform(code, id) {
      const file = id.split('?')[0];
      if (!isWorldFile(file)) return null;
      try {
        return { code: tagParts(code, rel(file)), map: null };
      } catch {
        return null; // a file that does not parse is left for the compiler to report
      }
    },
    configureServer(server) {
      const mount = `${server.config.base}__editor/`;
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        const at = url.indexOf(mount);
        if (at < 0 || at > 0) return next();
        const [route, search] = url.slice(mount.length).split('?');
        void handle(req, res, route, new URLSearchParams(search ?? ''));
      });
    },
  };
}
