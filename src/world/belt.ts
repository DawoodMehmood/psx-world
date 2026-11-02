import { Matrix4, Quaternion, Vector3 } from 'three';

const UP = new Vector3(0, 1, 0);

/**
 * Orientation of a belt running from `a` to `b`: local +x along the belt and
 * local +y kept pointing up. (A plain "rotate +x onto the direction" turns a
 * belt that runs backwards and uphill upside down: its rocks then ride underneath.)
 */
export function beltBasis(a: Vector3, b: Vector3): Quaternion {
  const x = b.clone().sub(a).normalize();
  const z = x.clone().cross(UP).normalize();
  const y = z.clone().cross(x);
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
}
