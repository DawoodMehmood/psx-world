import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { beltBasis } from '../src/world/belt';

const local = (q: Quaternion, v: Vector3) => v.clone().applyQuaternion(q);

describe('conveyor belt orientation', () => {
  // the quarry belt runs backwards and uphill: the case that used to come out upside down
  const cases: [string, Vector3, Vector3][] = [
    ['quarry to preheater (backwards and uphill)', new Vector3(3.6, 0.3, 5.2), new Vector3(1.9, 2.6, 4.0)],
    ['feeder belt (level, backwards)', new Vector3(5.4, 0.3, 5.5), new Vector3(3.7, 0.3, 5.2)],
    ['forwards and uphill', new Vector3(0, 0, 0), new Vector3(2, 1, 1)],
    ['forwards and downhill', new Vector3(0, 2, 0), new Vector3(2, 0, 2)],
  ];

  it.each(cases)('%s: the belt runs from a to b and its top faces up', (_, a, b) => {
    const q = beltBasis(a, b);
    const along = local(q, new Vector3(1, 0, 0));
    const top = local(q, new Vector3(0, 1, 0));
    const dir = b.clone().sub(a).normalize();
    expect(along.distanceTo(dir)).toBeLessThan(1e-9);
    expect(top.y).toBeGreaterThan(0.5);
  });

  it('a rock on the belt sits above the belt, never beneath it', () => {
    const [, a, b] = cases[0];
    const q = beltBasis(a, b);
    const rock = local(q, new Vector3(0, 0.2, 0));
    expect(rock.y).toBeGreaterThan(0);
  });
});
