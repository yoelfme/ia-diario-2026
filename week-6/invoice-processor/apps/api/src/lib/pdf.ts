import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function renderPdfFirstPageToPng(buffer: Buffer) {
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;

  const page = await document.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');

  await page.render({
    canvas: canvas as never,
    canvasContext: context as never,
    viewport,
  }).promise;

  await document.destroy();

  return Buffer.from(await canvas.encode('png'));
}
