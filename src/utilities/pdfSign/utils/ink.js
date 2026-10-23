// Crop a canvas to the bounding box of its non-transparent pixels (plus a small margin) and return a PNG data URL.
export function trimmedPng(canvas, margin = 4) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  let [minX, minY, maxX, maxY] = [width, height, -1, -1];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  minX = Math.max(0, minX - margin);
  minY = Math.max(0, minY - margin);
  const w = Math.min(width, maxX + margin + 1) - minX;
  const h = Math.min(height, maxY + margin + 1) - minY;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d').drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
  return { src: out.toDataURL('image/png'), aspect: w / h };
}

// Render text (any script) to a trimmed PNG.
export function textPng(text, font, color = '#000') {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = font;
  const m = ctx.measureText(text);
  c.width = Math.ceil(m.width) + 40;
  c.height = Math.ceil(parseInt(font.match(/(\d+)px/)[1], 10) * 1.6) + 20;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 20, c.height / 2);
  return trimmedPng(c, 2);
}

// Read an uploaded image as a PNG data URL (PNG is what the PDF writer embeds).
export async function imageFileToPng(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('This image could not be opened'));
      i.src = url;
    });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return { src: c.toDataURL('image/png'), aspect: c.width / c.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
