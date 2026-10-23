// pdf.js is loaded on demand: it is large, and import.meta is not supported by the Jest setup.
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export function openPdf(bytes) {
  // pdf.js takes ownership of the buffer, so give it a copy.
  return pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, enableXfa: false }).promise;
}
