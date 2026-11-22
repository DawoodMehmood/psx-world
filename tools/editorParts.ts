import { parseAst } from 'vite';

/*
 * The source side of the visual asset editor (dev only). It finds the kit
 * shapes in a .tsx file, tags them so the browser can tell which JSX element a
 * mesh came from, and rewrites single attributes in place, leaving every other
 * byte of the file alone. Pure text in, text out, so it is easy to test.
 *
 * A part is identified by `path#n`, where n counts the shape elements in the
 * file in source order. That stays put when you change a value, and only
 * shifts when a part is added or removed.
 */

/** The kit pieces the editor can pick, move and recolor: the six shapes, the Blob crown shape, and the placed Tree and Car. */
export const SHAPES = new Set(['Box', 'Cyl', 'Cone', 'Dome', 'Ball', 'Roof', 'Blob', 'Tree', 'Car']);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = Record<string, any>;

export type Item = { kind: 'const'; value: number } | { kind: 'expr'; text: string };
export type AttrInfo =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'bool'; value: boolean }
  | { kind: 'array'; items: Item[] }
  | { kind: 'expr'; text: string };

/** What the browser is told about a part: its attributes, as far as they are plain values. */
export interface PartInfo {
  name: string;
  line: number;
  /** It sits directly among other JSX children, so it can be duplicated or deleted without breaking the syntax. */
  canStructure: boolean;
  attrs: Record<string, AttrInfo>;
}

/** What to change: a number, string or boolean, or for a vector one entry per axis (null leaves that axis alone). */
export type Change = number | string | boolean | (number | null)[];
export type Changes = Record<string, Change>;

export interface Part {
  index: number;
  name: string;
  start: number;
  end: number;
  nameEnd: number;
  canStructure: boolean;
  el: Node;
}

function parse(code: string, filename: string): Node {
  try {
    return parseAst(code, { lang: 'tsx' }) as unknown as Node;
  } catch (e) {
    throw new Error(`cannot parse ${filename}: ${(e as Error).message.split('\n')[0]}`);
  }
}

/** A number written as an expression of literals: 2, -0.5, Math.PI / 2. Anything with a name in it is computed. */
export function evalConst(n: Node): number | null {
  switch (n.type) {
    case 'Literal':
      return typeof n.value === 'number' ? n.value : null;
    case 'ParenthesizedExpression':
      return evalConst(n.expression);
    case 'UnaryExpression': {
      const v = evalConst(n.argument);
      if (v === null) return null;
      return n.operator === '-' ? -v : n.operator === '+' ? v : null;
    }
    case 'MemberExpression':
      return !n.computed && n.object.type === 'Identifier' && n.object.name === 'Math' && n.property.name === 'PI' ? Math.PI : null;
    case 'BinaryExpression': {
      const a = evalConst(n.left);
      const b = evalConst(n.right);
      if (a === null || b === null) return null;
      if (n.operator === '+') return a + b;
      if (n.operator === '-') return a - b;
      if (n.operator === '*') return a * b;
      if (n.operator === '/') return a / b;
      return null;
    }
    default:
      return null;
  }
}

/** Every shape element in the file, in source order. */
export function listParts(code: string, filename = 'file.tsx'): Part[] {
  const parts: Part[] = [];
  const walk = (node: Node, parent: Node | null) => {
    if (node.type === 'JSXElement') {
      const name = node.openingElement.name;
      if (name.type === 'JSXIdentifier' && SHAPES.has(name.name)) {
        parts.push({
          index: parts.length,
          name: name.name,
          start: node.start,
          end: node.end,
          nameEnd: name.end,
          canStructure: !!parent && (parent.type === 'JSXElement' || parent.type === 'JSXFragment'),
          el: node,
        });
      }
    }
    for (const key of Object.keys(node)) {
      const v = node[key];
      if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && walk(c, node));
      else if (v && typeof v === 'object' && typeof v.type === 'string') walk(v, node);
    }
  };
  walk(parse(code, filename), null);
  return parts;
}

const attrsOf = (part: Part): Node[] => part.el.openingElement.attributes;
const findAttr = (part: Part, key: string): Node | undefined => attrsOf(part).find((a) => a.type === 'JSXAttribute' && a.name.name === key);
const textOf = (code: string, n: Node) => code.slice(n.start, n.end);

function describeValue(code: string, attr: Node): AttrInfo {
  const v = attr.value;
  if (v === null) return { kind: 'bool', value: true };
  if (v.type === 'Literal') return typeof v.value === 'string' ? { kind: 'string', value: v.value } : { kind: 'expr', text: textOf(code, v) };
  if (v.type !== 'JSXExpressionContainer') return { kind: 'expr', text: textOf(code, v) };
  const e = v.expression;
  if (e.type === 'ArrayExpression') {
    return {
      kind: 'array',
      items: e.elements.map((el: Node | null): Item => {
        const value = el ? evalConst(el) : null;
        return value === null ? { kind: 'expr', text: el ? textOf(code, el) : '' } : { kind: 'const', value };
      }),
    };
  }
  if (e.type === 'Literal' && typeof e.value === 'boolean') return { kind: 'bool', value: e.value };
  if (e.type === 'Literal' && typeof e.value === 'string') return { kind: 'string', value: e.value };
  const value = evalConst(e);
  return value === null ? { kind: 'expr', text: textOf(code, e) } : { kind: 'number', value };
}

export function describePart(code: string, part: Part): PartInfo {
  const attrs: Record<string, AttrInfo> = {};
  for (const a of attrsOf(part)) if (a.type === 'JSXAttribute') attrs[a.name.name] = describeValue(code, a);
  return { name: part.name, line: code.slice(0, part.start).split('\n').length, canStructure: part.canStructure, attrs };
}

/** Marks every shape with where it came from, for the browser to read off the mesh. Adds no newlines, so line numbers hold. */
export function tagParts(code: string, rel: string): string {
  const parts = listParts(code, rel);
  let out = code;
  for (const p of [...parts].reverse()) out = out.slice(0, p.nameEnd) + ` __src="${rel}#${p.index}"` + out.slice(p.nameEnd);
  return out;
}

/** What a shape draws when an attribute is left out. Writing one of these into the source would only add clutter. */
const DEFAULTS: Record<string, number | boolean | string | number[]> = {
  at: [0, 0, 0],
  rot: [0, 0, 0],
  glow: 0,
  shadow: true,
  rounded: 0,
  low: false,
  center: false,
};

/** Defaults that belong to one piece (a Tree is 1 big and leaf green unless told otherwise), checked before the shared ones. */
const OWN_DEFAULTS: Record<string, Record<string, number | string>> = {
  Tree: { size: 1, color: '#4fa83d' },
  Car: { rotY: 0 },
};
const defaultOf = (name: string, key: string) => OWN_DEFAULTS[name]?.[key] ?? DEFAULTS[key];

const same = (a: number, b: number) => Math.abs(a - b) < 1e-6;

const trim = (n: number) => String(+n.toFixed(4));

/** An angle in radians, written as a fraction of pi when it is a plain one (Math.PI / 2), else as a number. */
function fmtAngle(n: number): string {
  if (Math.abs(n) < 1e-9) return '0';
  for (const d of [1, 2, 3, 4, 6]) {
    if (Math.abs(Math.abs(n) - Math.PI / d) < 1e-6) return `${n < 0 ? '-' : ''}Math.PI${d === 1 ? '' : ` / ${d}`}`;
  }
  return trim(n);
}

const fmtNum = (key: string, n: number) => (key === 'rot' || key === 'rotY' ? fmtAngle(n) : trim(n));

interface Edit {
  start: number;
  end: number;
  text: string;
}

function splice(code: string, edits: Edit[]): string {
  let out = code;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

/** Writes the given values into one part's attributes, touching nothing else. Throws if a value cannot be written in place (it is computed). */
export function applyChanges(code: string, index: number, changes: Changes, filename = 'file.tsx'): string {
  const part = listParts(code, filename)[index];
  if (!part) throw new Error(`no part ${index} in ${filename}`);
  const edits: Edit[] = [];
  let added = '';
  for (const [key, change] of Object.entries(changes)) {
    const attr = findAttr(part, key);
    if (!attr) {
      // leaving an attribute at its default is what leaving it out means
      const def = defaultOf(part.name, key);
      const isDefault = Array.isArray(change)
        ? Array.isArray(def) && change.every((v, i) => v === null || same(v, def[i] ?? 0))
        : typeof change === 'number' && typeof def === 'number'
          ? same(change, def)
          : change === def;
      if (isDefault) continue;
      if (Array.isArray(change)) added += ` ${key}={[${change.map((v) => fmtNum(key, v ?? 0)).join(', ')}]}`;
      else if (typeof change === 'string') added += ` ${key}="${change}"`;
      else if (typeof change === 'boolean') added += change ? ` ${key}` : ` ${key}={false}`;
      else added += ` ${key}={${fmtNum(key, change)}}`;
      continue;
    }
    const v = attr.value;
    const expr: Node | null = v && v.type === 'JSXExpressionContainer' ? v.expression : null;
    const fail = (why: string): never => {
      throw new Error(`${part.name}.${key}: ${why}`);
    };
    if (Array.isArray(change)) {
      if (!expr || expr.type !== 'ArrayExpression') fail('is not an array literal');
      change.forEach((val, i) => {
        if (val === null) return;
        const el = expr!.elements[i];
        if (!el) fail(`has no entry ${i}`);
        const now = evalConst(el);
        if (now === null) fail(`entry ${i} is computed (${textOf(code, el)})`);
        if (same(now!, val)) return;
        edits.push({ start: el.start, end: el.end, text: fmtNum(key, val) });
      });
    } else if (typeof change === 'string') {
      if (v && v.type === 'Literal' && typeof v.value === 'string') {
        if (v.value !== change) edits.push({ start: v.start, end: v.end, text: `"${change}"` });
      } else if (expr && expr.type === 'Literal' && typeof expr.value === 'string') {
        if (expr.value !== change) edits.push({ start: expr.start, end: expr.end, text: `"${change}"` });
      } else fail(`is computed (${v ? textOf(code, v) : 'true'})`);
    } else if (typeof change === 'boolean') {
      if (v === null) {
        if (!change) edits.push({ start: attr.start, end: attr.end, text: `${key}={false}` });
      } else if (expr && expr.type === 'Literal' && typeof expr.value === 'boolean') {
        if (expr.value !== change) edits.push({ start: expr.start, end: expr.end, text: String(change) });
      } else fail(`is computed (${textOf(code, v)})`);
    } else {
      const now = expr ? evalConst(expr) : null;
      if (now === null) fail(`is computed (${v ? textOf(code, v) : 'true'})`);
      if (!same(now!, change)) edits.push({ start: expr!.start, end: expr!.end, text: fmtNum(key, change) });
    }
  }
  if (added) {
    const last = attrsOf(part).at(-1);
    const at = last ? last.end : part.nameEnd;
    edits.push({ start: at, end: at, text: added });
  }
  return splice(code, edits);
}

/** The whitespace before a part on its own line, or null when something else shares the line. */
function indentOf(code: string, part: Part): string | null {
  const lineStart = code.lastIndexOf('\n', part.start - 1) + 1;
  const before = code.slice(lineStart, part.start);
  return /^\s*$/.test(before) ? before : null;
}

/** Copies a part right after itself, shifted by `offset` where its position is a plain value. The copy is part index + 1. */
export function duplicatePart(code: string, index: number, offset: [number, number, number], filename = 'file.tsx'): string {
  const part = listParts(code, filename)[index];
  if (!part) throw new Error(`no part ${index} in ${filename}`);
  if (!part.canStructure) throw new Error(`${part.name} sits inside an expression (a loop or a condition) and cannot be duplicated`);
  const indent = indentOf(code, part);
  const text = code.slice(part.start, part.end);
  const next = code.slice(0, part.end) + (indent === null ? ' ' : `\n${indent}`) + text + code.slice(part.end);
  const at = findAttr(part, 'at');
  const info = at ? describeValue(code, at) : null;
  if (info && info.kind !== 'array') return next;
  const shifted = offset.map((o, i) => {
    const item = info?.kind === 'array' ? info.items[i] : { kind: 'const' as const, value: 0 };
    return item.kind === 'const' ? item.value + o : null;
  });
  return applyChanges(next, index + 1, { at: shifted }, filename);
}

export function deletePart(code: string, index: number, filename = 'file.tsx'): string {
  const part = listParts(code, filename)[index];
  if (!part) throw new Error(`no part ${index} in ${filename}`);
  if (!part.canStructure) throw new Error(`${part.name} sits inside an expression (a loop or a condition) and cannot be deleted`);
  const indent = indentOf(code, part);
  const rest = code.slice(part.end);
  const lineEnd = rest.indexOf('\n');
  if (indent !== null && lineEnd >= 0 && /^\s*$/.test(rest.slice(0, lineEnd))) {
    return code.slice(0, part.start - indent.length) + rest.slice(lineEnd + 1);
  }
  return code.slice(0, part.start) + rest;
}
