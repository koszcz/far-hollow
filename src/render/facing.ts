/** How far round something facing `turns` quarter turns is drawn, in radians. Quarter turns go clockwise seen from above. */
export function facingRadians(turns: number): number {
  return -turns * (Math.PI / 2);
}
