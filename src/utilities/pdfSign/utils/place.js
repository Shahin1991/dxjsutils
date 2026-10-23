// Map a point on the page as displayed (points, origin top-left, after the page's /Rotate)
// to PDF user space (origin bottom-left, before rotation). box = { x0, y0, W, H } is the crop box.
export function displayToUser(dx, dy, { x0 = 0, y0 = 0, W, H, rotation = 0 }) {
  const r = ((rotation % 360) + 360) % 360;
  let ux;
  let uy;
  if (r === 90) [ux, uy] = [dy, dx];
  else if (r === 180) [ux, uy] = [W - dx, dy];
  else if (r === 270) [ux, uy] = [W - dy, H - dx];
  else [ux, uy] = [dx, H - dy];
  return { x: x0 + ux, y: y0 + uy };
}

// Size of the page as displayed, in points.
export function displaySize({ W, H, rotation = 0 }) {
  return rotation % 180 === 0 ? { width: W, height: H } : { width: H, height: W };
}
