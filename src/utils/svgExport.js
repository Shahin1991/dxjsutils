// Rasterise an SVG string to a PNG Blob (used by Diagram Editor and Mind Map).
export function svgToPng(svg, { scale = 2, background = '#ffffff' } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const el = doc.documentElement;
    const vb = (el.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    const w = vb.length === 4 ? vb[2] : parseFloat(el.getAttribute('width')) || 800;
    const h = vb.length === 4 ? vb[3] : parseFloat(el.getAttribute('height')) || 600;
    el.setAttribute('width', w);
    el.setAttribute('height', h);
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(el)], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(w * scale);
      c.height = Math.round(h * scale);
      const ctx = c.getContext('2d');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('PNG export failed'));
    };
    img.src = url;
  });
}
