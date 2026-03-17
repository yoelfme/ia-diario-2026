import { readStoredUpload } from './file-storage.js';
import { renderPdfFirstPageToPng } from './pdf.js';

export type PreparedDocument = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
};

export type DocumentPreparer = (input: {
  absolutePath: string;
  mimeType: string;
  filename: string;
}) => Promise<PreparedDocument>;

export const prepareDocumentForExtraction: DocumentPreparer = async ({
  absolutePath,
  mimeType,
  filename,
}) => {
  const buffer = await readStoredUpload(absolutePath);

  if (mimeType === 'application/pdf') {
    return {
      buffer: await renderPdfFirstPageToPng(buffer),
      mimeType: 'image/png',
      filename: filename.replace(/\.pdf$/i, '.png'),
    };
  }

  return {
    buffer,
    mimeType,
    filename,
  };
};

