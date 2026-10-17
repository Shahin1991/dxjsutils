import { PDFDocument, degrees } from 'pdf-lib';

async function load(bytes) {
  try {
    return await PDFDocument.load(bytes);
  } catch (e) {
    if (/encrypt/i.test(e.message)) throw new Error('This PDF is password-protected. Remove the password first.');
    throw new Error('This file could not be read as a PDF');
  }
}

export async function pdfInfo(bytes) {
  const doc = await load(bytes);
  return { pages: doc.getPageCount(), title: doc.getTitle() || '', author: doc.getAuthor() || '' };
}

export async function mergePdfs(list) {
  const out = await PDFDocument.create();
  for (const bytes of list) {
    // eslint-disable-next-line no-await-in-loop
    const src = await load(bytes);
    // eslint-disable-next-line no-await-in-loop
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save();
}

// New PDF with the given 0-based pages, in that order (so it can also reorder).
export async function extractPages(bytes, indexes) {
  const src = await load(bytes);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indexes);
  pages.forEach((p) => out.addPage(p));
  return out.save();
}

export async function removePages(bytes, indexes) {
  const src = await load(bytes);
  const drop = new Set(indexes);
  const keep = src.getPageIndices().filter((i) => !drop.has(i));
  if (keep.length === 0) throw new Error('You cannot remove every page');
  return extractPages(bytes, keep);
}

export async function rotatePages(bytes, indexes, angle) {
  const doc = await load(bytes);
  new Set(indexes).forEach((i) => {
    const page = doc.getPage(i);
    page.setRotation(degrees((page.getRotation().angle + angle + 360) % 360));
  });
  return doc.save();
}
