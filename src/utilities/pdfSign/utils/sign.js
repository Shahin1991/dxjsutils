import { PDFCheckBox, PDFDocument, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField, StandardFonts, degrees, rgb } from 'pdf-lib';
import { displaySize, displayToUser } from './place';

// Fraction of the font size from the top of a line box to the baseline (close for Helvetica/Arial).
export const BASELINE = 0.8;

async function load(bytes) {
  try {
    return await PDFDocument.load(bytes);
  } catch (e) {
    if (/encrypt/i.test(e.message)) throw new Error('This PDF is password-protected. Remove the password first.');
    throw new Error('This file could not be read as a PDF');
  }
}

export async function readForm(bytes) {
  const doc = await load(bytes);
  const fields = [];
  doc.getForm().getFields().forEach((f) => {
    const name = f.getName();
    if (f instanceof PDFTextField) fields.push({ name, type: 'text', value: f.getText() || '' });
    else if (f instanceof PDFCheckBox) fields.push({ name, type: 'checkbox', value: f.isChecked() });
    else if (f instanceof PDFDropdown || f instanceof PDFOptionList) fields.push({ name, type: 'select', value: f.getSelected()[0] || '', options: f.getOptions() });
    else if (f instanceof PDFRadioGroup) fields.push({ name, type: 'select', value: f.getSelected() || '', options: f.getOptions() });
  });
  return { pages: doc.getPageCount(), fields };
}

function pageBox(page) {
  const { x, y, width, height } = page.getCropBox();
  return { x0: x, y0: y, W: width, H: height, rotation: page.getRotation().angle };
}

const dataUrlBytes = (url) => Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0));

// items: { page, kind: 'image'|'text', x, y, w, h (fractions of the displayed page), src (PNG data URL),
//          text, size (font size as a fraction of page height), fallbackSrc (PNG of the text) }
export async function applyToPdf(bytes, { items = [], fields = [], flatten = false } = {}) {
  const doc = await load(bytes);
  if (fields.length) {
    const form = doc.getForm();
    fields.forEach(({ name, type, value }) => {
      const f = form.getField(name);
      if (type === 'text') f.setText(value);
      else if (type === 'checkbox') (value ? f.check() : f.uncheck());
      else if (type === 'select' && value) f.select(value);
    });
    if (flatten) form.flatten();
  }
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const images = new Map();
  const embed = async (src) => {
    if (!images.has(src)) images.set(src, await doc.embedPng(dataUrlBytes(src)));
    return images.get(src);
  };

  for (const it of items) {
    const page = doc.getPage(it.page);
    const box = pageBox(page);
    const { width: DW, height: DH } = displaySize(box);
    const rotate = degrees(box.rotation);
    if (it.kind === 'text') {
      const size = it.size * DH;
      const at = displayToUser(it.x * DW, it.y * DH + size * BASELINE, box);
      try {
        page.drawText(it.text, { x: at.x, y: at.y, size, font, color: rgb(0, 0, 0), rotate });
        continue; // eslint-disable-line no-continue
      } catch (e) {
        // Characters Helvetica cannot encode (e.g. Arabic): fall back to an image of the text.
        if (!it.fallbackSrc) throw new Error(`Cannot write "${it.text}" with the built-in PDF font`);
      }
    }
    // eslint-disable-next-line no-await-in-loop
    const img = await embed(it.kind === 'text' ? it.fallbackSrc : it.src);
    const at = displayToUser(it.x * DW, (it.y + it.h) * DH, box);
    page.drawImage(img, { x: at.x, y: at.y, width: it.w * DW, height: it.h * DH, rotate });
  }
  return doc.save();
}
