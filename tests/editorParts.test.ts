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
