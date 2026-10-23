// Minimal EXIF / PNG metadata reader and lossless metadata stripper (no image re-encoding).

const TAGS = {
  0x010e: 'Description', 0x010f: 'Camera make', 0x0110: 'Camera model', 0x0112: 'Orientation', 0x011a: 'X resolution', 0x011b: 'Y resolution',
  0x0131: 'Software', 0x0132: 'Modified', 0x013b: 'Artist', 0x8298: 'Copyright', 0x9003: 'Taken', 0x9004: 'Digitised',
  0x829a: 'Exposure time', 0x829d: 'F-number', 0x8827: 'ISO', 0x920a: 'Focal length', 0xa405: 'Focal length (35 mm)', 0x9209: 'Flash',
  0xa002: 'Width', 0xa003: 'Height', 0xa434: 'Lens', 0xa433: 'Lens make', 0xa430: 'Camera owner', 0xa431: 'Body serial number',
  0xa435: 'Lens serial number', 0x9010: 'Time zone', 0x9011: 'Time zone (taken)', 0xa420: 'Unique image ID',
};
const GPS_TAGS = { 1: 'LatRef', 2: 'Lat', 3: 'LonRef', 4: 'Lon', 5: 'AltRef', 6: 'Alt', 7: 'Time', 29: 'Date', 17: 'Direction' };
const ORIENT = { 1: 'Normal', 2: 'Mirrored', 3: 'Rotated 180°', 4: 'Mirrored vertically', 5: 'Mirrored, rotated 90°', 6: 'Rotated 90° clockwise', 7: 'Mirrored, rotated 270°', 8: 'Rotated 90° anticlockwise' };
const SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function readTiff(view, start) {
  const little = view.getUint16(start) === 0x4949;
  const u16 = (o) => view.getUint16(start + o, little);
  const u32 = (o) => view.getUint32(start + o, little);
  const values = (type, count, off) => {
    const size = SIZES[type] || 1;
    const at = size * count > 4 ? u32(off) : off;
    const out = [];
    for (let i = 0; i < Math.min(count, 256); i += 1) {
      const o = at + i * size;
      if (type === 3) out.push(u16(o));
      else if (type === 4) out.push(u32(o));
      else if (type === 9) out.push(view.getInt32(start + o, little));
      else if (type === 5 || type === 10) {
        const n = type === 5 ? u32(o) : view.getInt32(start + o, little);
        const d = type === 5 ? u32(o + 4) : view.getInt32(start + o + 4, little);
        out.push(d ? n / d : 0);
      } else out.push(view.getUint8(start + o));
    }
    if (type === 2) return String.fromCharCode(...out).replace(/\0+$/, '').trim();
    if (type === 7 && count > 4) return `${count} bytes`;
    return count === 1 ? out[0] : out;
  };
  const ifd = (off) => {
    const entries = {};
    const n = u16(off);
    for (let i = 0; i < n; i += 1) {
      const e = off + 2 + i * 12;
      try {
        entries[u16(e)] = values(u16(e + 2), u32(e + 4), e + 8);
      } catch (err) {
        // skip tags that point outside the data
      }
    }
    return entries;
  };
  const ifd0 = ifd(u32(4));
  const exif = ifd0[0x8769] ? ifd(ifd0[0x8769]) : {};
  const gps = ifd0[0x8825] ? ifd(ifd0[0x8825]) : {};
  return { ...ifd0, ...exif, gps };
}

const dms = (v) => (Array.isArray(v) ? v[0] + v[1] / 60 + v[2] / 3600 : v);

function describe(tags) {
  const rows = [];
  Object.entries(tags).forEach(([k, v]) => {
    const name = TAGS[k];
    if (!name || v === '' || v === undefined) return;
    let text = Array.isArray(v) ? v.join(', ') : String(v);
    if (Number(k) === 0x0112) text = ORIENT[v] || text;
    if (Number(k) === 0x829a && v > 0 && v < 1) text = `1/${Math.round(1 / v)} s`;
    if (Number(k) === 0x829d) text = `f/${Number(v).toFixed(1)}`;
    if (Number(k) === 0x920a) text = `${Number(v).toFixed(1)} mm`;
    rows.push({ label: name, value: text, sensitive: [0xa430, 0xa431, 0xa435, 0x013b, 0xa420].includes(Number(k)) });
  });
  const g = tags.gps || {};
  const named = Object.fromEntries(Object.entries(g).map(([k, v]) => [GPS_TAGS[k] || k, v]));
  let location = null;
  if (named.Lat !== undefined && named.Lon !== undefined) {
    const lat = dms(named.Lat) * (named.LatRef === 'S' ? -1 : 1);
    const lon = dms(named.Lon) * (named.LonRef === 'W' ? -1 : 1);
    if (Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon)) {
      location = { lat, lon };
      rows.unshift({ label: 'GPS location', value: `${lat.toFixed(6)}, ${lon.toFixed(6)}`, sensitive: true });
      if (named.Alt !== undefined) rows.splice(1, 0, { label: 'GPS altitude', value: `${Math.round(named.Alt)} m`, sensitive: true });
    }
  }
  return { rows, location, orientation: tags[0x0112] };
}

const JPEG_STRIP = (m) => (m >= 0xe1 && m <= 0xef && m !== 0xe2 && m !== 0xee) || m === 0xfe;

// Walk JPEG segments up to the image data.
function jpegSegments(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Not a JPEG file');
  const segs = [];
  let i = 2;
  while (i < bytes.length - 4) {
    if (bytes[i] !== 0xff) throw new Error('Corrupt JPEG structure');
    const marker = bytes[i + 1];
    if (marker === 0xff) { i += 1; continue; } // eslint-disable-line no-continue
    if (marker === 0xda || marker === 0xd9) {
      segs.push({ marker, start: i, end: bytes.length, tail: true });
      break;
    }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    segs.push({ marker, start: i, end: i + 2 + len, data: bytes.subarray(i + 4, i + 2 + len) });
    i += 2 + len;
  }
  return segs;
}

const ascii = (b, n) => String.fromCharCode(...b.subarray(0, n));

export function readJpeg(bytes) {
  const info = { format: 'JPEG', rows: [], blocks: [] };
  jpegSegments(bytes).forEach((s) => {
    if (s.marker === 0xe1 && ascii(s.data, 6) === 'Exif\0\0') {
      const d = describe(readTiff(new DataView(s.data.buffer, s.data.byteOffset + 6, s.data.length - 6), 0));
      Object.assign(info, { rows: d.rows, location: d.location, orientation: d.orientation });
      info.blocks.push('EXIF');
    } else if (s.marker === 0xe1 && ascii(s.data, 28).startsWith('http://ns.adobe.com/xap/1.0/')) info.blocks.push('XMP');
    else if (s.marker === 0xed) info.blocks.push('IPTC / Photoshop');
    else if (s.marker === 0xfe) info.blocks.push('Comment');
    else if (s.marker === 0xe2 && ascii(s.data, 11) === 'ICC_PROFILE') info.blocks.push('ICC colour profile (kept)');
  });
  return info;
}

// Minimal EXIF segment holding only the orientation, so stripped photos still display upright.
function orientationSegment(value) {
  const b = new Uint8Array(2 + 2 + 6 + 8 + 2 + 12 + 4);
  const v = new DataView(b.buffer);
  v.setUint16(0, 0xffe1);
  v.setUint16(2, b.length - 2);
  b.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4); // "Exif\0\0"
  b.set([0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8], 10); // big-endian TIFF, IFD at 8
  v.setUint16(18, 1); // one entry
  v.setUint16(20, 0x0112);
  v.setUint16(22, 3);
  v.setUint32(24, 1);
  v.setUint16(28, value);
  v.setUint32(32, 0); // no next IFD
  return b;
}

export function stripJpeg(bytes, { keepOrientation = true } = {}) {
  const segs = jpegSegments(bytes);
  const { orientation } = readJpeg(bytes);
  const parts = [bytes.subarray(0, 2)];
  if (keepOrientation && orientation && orientation !== 1) parts.push(orientationSegment(orientation));
  segs.forEach((s) => {
    if (!JPEG_STRIP(s.marker)) parts.push(bytes.subarray(s.start, s.end));
  });
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  parts.forEach((p) => {
    out.set(p, o);
    o += p.length;
  });
  return out;
}

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
const PNG_STRIP = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']);

function pngChunks(bytes) {
  if (!PNG_SIG.every((b, i) => bytes[i] === b)) throw new Error('Not a PNG file');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  const chunks = [];
  for (let i = 8; i + 12 <= bytes.length;) {
    const len = v.getUint32(i);
    const type = ascii(bytes.subarray(i + 4), 4);
    chunks.push({ type, start: i, end: i + 12 + len, data: bytes.subarray(i + 8, i + 8 + len) });
    i += 12 + len;
    if (type === 'IEND') break;
  }
  return chunks;
}

export function readPng(bytes) {
  const info = { format: 'PNG', rows: [], blocks: [] };
  pngChunks(bytes).forEach((c) => {
    if (c.type === 'tEXt' || c.type === 'iTXt' || c.type === 'zTXt') {
      const nul = c.data.indexOf(0);
      const key = ascii(c.data, nul);
      let value;
      if (c.type === 'zTXt') value = '(compressed text)';
      else if (c.type === 'tEXt') value = new TextDecoder('latin1').decode(c.data.subarray(nul + 1));
      else {
        // iTXt: keyword\0 flag method language\0 translated-keyword\0 text
        const lang = c.data.indexOf(0, nul + 3);
        const trans = c.data.indexOf(0, lang + 1);
        value = c.data[nul + 1] ? '(compressed text)' : new TextDecoder().decode(c.data.subarray(trans + 1));
      }
      info.rows.push({ label: key, value: value.length > 300 ? `${value.slice(0, 300)}…` : value });
      info.blocks.push(`Text (${key})`);
    } else if (c.type === 'eXIf') {
      const d = describe(readTiff(new DataView(c.data.buffer, c.data.byteOffset, c.data.length), 0));
      info.rows.push(...d.rows);
      info.location = d.location;
      info.blocks.push('EXIF');
    } else if (c.type === 'tIME') info.blocks.push('Last-modified time');
  });
  return info;
}

export function stripPng(bytes) {
  const keep = pngChunks(bytes).filter((c) => !PNG_STRIP.has(c.type));
  const out = new Uint8Array(8 + keep.reduce((n, c) => n + (c.end - c.start), 0));
  out.set(PNG_SIG);
  let o = 8;
  keep.forEach((c) => {
    out.set(bytes.subarray(c.start, c.end), o);
    o += c.end - c.start;
  });
  return out;
}

export function readMetadata(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return readJpeg(bytes);
  if (bytes[0] === 137 && bytes[1] === 80) return readPng(bytes);
  return null;
}

export function stripMetadata(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return stripJpeg(bytes);
  if (bytes[0] === 137 && bytes[1] === 80) return stripPng(bytes);
  return null;
}
