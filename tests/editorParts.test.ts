import { describe, expect, it } from 'vitest';
import { applyChanges, deletePart, describePart, duplicatePart, evalConst, listParts, tagParts } from '../tools/editorParts';

const SRC = `import { Box, Cyl } from './kit';
export function Thing({ w, accent }: { w: number; accent: string }) {
  return (
    <group>
      <Box size={[2, 3, w]} at={[1, 0, 0]} color="#ff0000" />
      <Cyl r={0.5} h={2} rot={[Math.PI / 2, 0, 0]} color={accent} center />
      {[1, 2].map((i) => (
        <Box key={i} size={[1, 1, 1]} color="#00ff00" shadow={false} />
      ))}
    </group>
  );
}
`;

const info = (code: string, i: number) => describePart(code, listParts(code)[i]);

describe('finding parts', () => {
  it('lists the shapes in source order and ignores everything else', () => {
    expect(listParts(SRC).map((p) => p.name)).toEqual(['Box', 'Cyl', 'Box']);
  });

  it('separates plain values from computed ones', () => {
    const box = info(SRC, 0);
    expect(box.attrs.size).toEqual({ kind: 'array', items: [{ kind: 'const', value: 2 }, { kind: 'const', value: 3 }, { kind: 'expr', text: 'w' }] });
    expect(box.attrs.color).toEqual({ kind: 'string', value: '#ff0000' });
    const cyl = info(SRC, 1);
    expect(cyl.attrs.color).toEqual({ kind: 'expr', text: 'accent' });
    expect(cyl.attrs.center).toEqual({ kind: 'bool', value: true });
    const rot = cyl.attrs.rot;
    expect(rot.kind === 'array' && rot.items[0]).toEqual({ kind: 'const', value: Math.PI / 2 });
  });

  it('knows which parts can be duplicated or deleted', () => {
    expect(info(SRC, 0).canStructure).toBe(true);
    expect(info(SRC, 2).canStructure).toBe(false); // inside .map()
  });

  it('evaluates constant expressions only', () => {
    const e = (s: string) => evalConst(listParts(`const x = <Box size={[${s}]} />;`)[0].el.openingElement.attributes[0].value.expression.elements[0]);
    expect(e('-0.5')).toBe(-0.5);
    expect(e('Math.PI / 2')).toBeCloseTo(Math.PI / 2);
    expect(e('2 * 3 + 1')).toBe(7);
    expect(e('w')).toBeNull();
  });
});

describe('tagging', () => {
  it('adds a source id to every shape without moving any line', () => {
    const out = tagParts(SRC, 'src/world/x.tsx');
    expect(out).toContain('<Box __src="src/world/x.tsx#0" size');
    expect(out).toContain('<Box __src="src/world/x.tsx#2" key');
    expect(out.split('\n').length).toBe(SRC.split('\n').length);
  });
});

describe('editing in place', () => {
  it('changes one value of an array and leaves the rest alone', () => {
    const out = applyChanges(SRC, 0, { size: [2.5, null, null] });
    expect(out).toContain('size={[2.5, 3, w]}');
    expect(out.replace('2.5', '2')).toBe(SRC);
  });

  it('refuses to overwrite a computed value', () => {
    expect(() => applyChanges(SRC, 0, { size: [null, null, 4] })).toThrow(/computed/);
    expect(() => applyChanges(SRC, 1, { color: '#fff' })).toThrow(/computed/);
  });

  it('recolors a string literal', () => {
    expect(applyChanges(SRC, 0, { color: '#00ffaa' })).toContain('color="#00ffaa"');
  });

  it('writes angles as fractions of pi where it can', () => {
    expect(applyChanges(SRC, 1, { rot: [Math.PI, null, -Math.PI / 4] })).toContain('rot={[Math.PI, 0, -Math.PI / 4]}');
    expect(applyChanges(SRC, 1, { rot: [0.3, null, null] })).toContain('rot={[0.3, 0, 0]}');
  });

  it('adds an attribute that was not there, and flips booleans both ways', () => {
    expect(applyChanges(SRC, 0, { glow: 0.5 })).toMatch(/<Box size=\{\[2, 3, w\]\} at=\{\[1, 0, 0\]\} color="#ff0000" glow=\{0.5\} \/>/);
    expect(applyChanges(SRC, 0, { rot: [0, 0.5, 0] })).toContain('rot={[0, 0.5, 0]}');
    expect(applyChanges(SRC, 1, { center: false })).toContain('center={false}');
    expect(applyChanges(SRC, 2, { shadow: true })).toContain('shadow={true}');
  });

  it('writes nothing for a value the source already has', () => {
    expect(applyChanges(SRC, 0, { size: [2, 3, null], color: '#ff0000' })).toBe(SRC);
    expect(applyChanges(SRC, 1, { center: true, r: 0.5 })).toBe(SRC);
    expect(applyChanges(SRC, 2, { shadow: false })).toBe(SRC);
  });

  it('writes nothing for a default on an attribute that is not there', () => {
    expect(applyChanges(SRC, 1, { at: [0, 0, 0], glow: 0, shadow: true, low: false })).toBe(SRC);
    expect(applyChanges(SRC, 1, { at: [null, 0, null] })).toBe(SRC);
    expect(applyChanges(SRC, 1, { center: false, low: false })).toContain('center={false}');
    expect(applyChanges(SRC, 1, { center: false, low: false })).not.toContain('low');
  });

  it('still writes a whole vector when only one axis leaves the default', () => {
    expect(applyChanges(SRC, 1, { at: [null, 0.5, null] })).toContain('at={[0, 0.5, 0]}');
  });

  it('edits every copy of a part in a loop by editing the one element', () => {
    expect(applyChanges(SRC, 2, { color: '#123456' })).toContain('<Box key={i} size={[1, 1, 1]} color="#123456"');
  });
});

describe('duplicating and deleting', () => {
  it('copies a part on its own line, shifted along x', () => {
    const out = duplicatePart(SRC, 0, [1, 0, 0]);
    expect(listParts(out).map((p) => p.name)).toEqual(['Box', 'Box', 'Cyl', 'Box']);
    expect(out).toContain('      <Box size={[2, 3, w]} at={[1, 0, 0]} color="#ff0000" />\n      <Box size={[2, 3, w]} at={[2, 0, 0]} color="#ff0000" />');
  });

  it('gives a copy of a part with no position one', () => {
    expect(duplicatePart(SRC, 1, [0, 1, 0])).toContain('rot={[Math.PI / 2, 0, 0]} color={accent} center at={[0, 1, 0]} />');
  });

  it('refuses to copy or delete a part inside a loop', () => {
    expect(() => duplicatePart(SRC, 2, [1, 0, 0])).toThrow(/cannot be duplicated/);
    expect(() => deletePart(SRC, 2)).toThrow(/cannot be deleted/);
  });

  it('deletes a part and its line', () => {
    const out = deletePart(SRC, 0);
    expect(listParts(out).map((p) => p.name)).toEqual(['Cyl', 'Box']);
    expect(out).not.toContain('#ff0000');
    expect(out).toContain('<group>\n      <Cyl');
  });
});

describe('placed trees and cars', () => {
  const PLACED = `export function Yard() {
  return (
    <group>
      <Tree at={[3.4, 0, 9.4]} size={0.8} />
      <Tree at={[9.9, 0, 9.5]} />
      <Car color="#d94b3d" at={[1, 0, 1]} rotY={Math.PI / 2} />
      <Blob size={[0.6, 0.65, 0.6]} at={[0, 1.05, 0]} color={color} />
    </group>
  );
}
`;
  it('finds them as parts', () => {
    expect(listParts(PLACED).map((p) => p.name)).toEqual(['Tree', 'Tree', 'Car', 'Blob']);
  });

  it('edits a tree\'s size and leaves out a size of 1', () => {
    expect(applyChanges(PLACED, 0, { size: 1.2 })).toContain('<Tree at={[3.4, 0, 9.4]} size={1.2} />');
    expect(applyChanges(PLACED, 1, { size: 1, color: '#4fa83d' })).toBe(PLACED);
    expect(applyChanges(PLACED, 1, { size: 0.7, color: '#3fa66b' })).toContain('<Tree at={[9.9, 0, 9.5]} size={0.7} color="#3fa66b" />');
  });

  it('writes a car heading as a fraction of pi', () => {
    expect(applyChanges(PLACED, 2, { rotY: Math.PI })).toContain('rotY={Math.PI}');
    expect(applyChanges(PLACED, 2, { rotY: -Math.PI / 4 })).toContain('rotY={-Math.PI / 4}');
    expect(applyChanges(PLACED, 2, { rotY: 0 })).toContain('rotY={0}');
  });

  it('moves a tree by editing the plain axes of its position', () => {
    expect(applyChanges(PLACED, 0, { at: [4, null, null] })).toContain('at={[4, 0, 9.4]}');
  });

  it('shows a computed color as read-only', () => {
    expect(describePart(PLACED, listParts(PLACED)[3]).attrs.color).toEqual({ kind: 'expr', text: 'color' });
    expect(() => applyChanges(PLACED, 3, { color: '#fff' })).toThrow(/computed/);
  });
});

describe('walls of windows', () => {
  const WALLS = `export function Tower({ w, d, floors, seed, closed }: P) {
  return (
    <group>
      <ActivityWindows at={[1, 0, 2]} w={w} d={3.4} floors={floors - 1} cols={4} seed={seed} closed={closed} darkColor="#7b93ad" />
    </group>
  );
}
`;
  it('lists the wall and tells plain values from computed ones', () => {
    const wall = describePart(WALLS, listParts(WALLS)[0]);
    expect(wall.name).toBe('ActivityWindows');
    expect(wall.attrs.d).toEqual({ kind: 'number', value: 3.4 });
    expect(wall.attrs.w).toEqual({ kind: 'expr', text: 'w' });
    expect(wall.attrs.cols).toEqual({ kind: 'number', value: 4 });
    expect(wall.canStructure).toBe(true);
  });

  it('edits columns and colors, adds an attribute, skips defaults, refuses computed', () => {
    expect(applyChanges(WALLS, 0, { cols: 5, darkColor: '#112233' })).toMatch(/cols=\{5\}.*darkColor="#112233"/);
    expect(applyChanges(WALLS, 0, { floorHeight: 0.9 })).toContain('darkColor="#7b93ad" floorHeight={0.9} />');
    expect(applyChanges(WALLS, 0, { floorHeight: 1, litColor: '#ffe27a', baseHeight: 0.6 })).toBe(WALLS);
    expect(() => applyChanges(WALLS, 0, { w: 4 })).toThrow(/computed/);
  });
});
