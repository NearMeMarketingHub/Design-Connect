import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { SigningField, SigningParticipant } from '@shared/schema';

interface StampFieldData {
  field: SigningField;
  value: string;
  signatureData?: string;
  signatureType?: string;
}

export async function stampPdfWithSignatures(
  pdfBytes: ArrayBuffer,
  fields: SigningField[],
  participants: SigningParticipant[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const field of fields) {
    const participant = participants.find(p => p.id === field.participantId);
    if (!participant) continue;

    const pageIndex = field.pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    const x = (field.xPosition / 100) * pageWidth;
    const y = pageHeight - ((field.yPosition / 100) * pageHeight) - ((field.height / 100) * pageHeight);
    const fieldWidth = (field.width / 100) * pageWidth;
    const fieldHeight = (field.height / 100) * pageHeight;

    if (field.fieldType === 'signature' && participant.signatureData) {
      try {
        // Check if signatureData is a base64 image (drawn signature)
        if (participant.signatureData.startsWith('data:image')) {
          const base64Data = participant.signatureData.split(',')[1];
          const imageBytes = Buffer.from(base64Data, 'base64');
          
          let image;
          if (participant.signatureData.includes('image/png')) {
            image = await pdfDoc.embedPng(imageBytes);
          } else if (participant.signatureData.includes('image/jpeg') || participant.signatureData.includes('image/jpg')) {
            image = await pdfDoc.embedJpg(imageBytes);
          }
          
          if (image) {
            const imgDims = image.scale(1);
            const scale = Math.min(fieldWidth / imgDims.width, fieldHeight / imgDims.height) * 0.9;
            
            page.drawImage(image, {
              x: x + (fieldWidth - imgDims.width * scale) / 2,
              y: y + (fieldHeight - imgDims.height * scale) / 2,
              width: imgDims.width * scale,
              height: imgDims.height * scale,
            });
          }
        } else {
          // Typed signature - render as styled text
          const fontSize = Math.min(fieldHeight * 0.6, 24);
          const signatureText = participant.signatureData;
          
          page.drawText(signatureText, {
            x: x + 5,
            y: y + fieldHeight / 2 - fontSize / 2,
            size: fontSize,
            font: helveticaBold,
            color: rgb(0, 0, 0.5),
          });
        }
      } catch (err) {
        console.error('Error embedding signature:', err);
      }
    } else if (field.fieldType === 'initials' && field.value) {
      const fontSize = Math.min(fieldHeight * 0.6, 18);
      page.drawText(field.value, {
        x: x + 5,
        y: y + fieldHeight / 2 - fontSize / 2,
        size: fontSize,
        font: helveticaBold,
        color: rgb(0, 0, 0.5),
      });
    } else if (field.fieldType === 'date' && field.value) {
      const fontSize = Math.min(fieldHeight * 0.5, 12);
      page.drawText(field.value, {
        x: x + 5,
        y: y + fieldHeight / 2 - fontSize / 2,
        size: fontSize,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
    } else if (field.fieldType === 'text' && field.value) {
      const fontSize = Math.min(fieldHeight * 0.4, 10);
      const maxCharsPerLine = Math.floor(fieldWidth / (fontSize * 0.5));
      const lines = wrapText(field.value, maxCharsPerLine);
      
      lines.forEach((line, index) => {
        const lineY = y + fieldHeight - fontSize * (index + 1.5);
        if (lineY > y) {
          page.drawText(line, {
            x: x + 3,
            y: lineY,
            size: fontSize,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
        }
      });
    }
  }

  return await pdfDoc.save();
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

export async function fetchPdfFromUrl(url: string): Promise<ArrayBuffer> {
  const fs = await import('fs');
  const path = await import('path');
  
  if (url.startsWith('/uploads/')) {
    const localPath = path.join(process.cwd(), url.slice(1));
    const buffer = fs.readFileSync(localPath);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }
  
  if (url.startsWith('/objects/')) {
    const { ObjectStorageService } = await import("./replit_integrations/object_storage");
    const objectStorage = new ObjectStorageService();
    const file = await objectStorage.getObjectEntityFile(url);
    const [buffer] = await file.download();
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }
  
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }
    return await response.arrayBuffer();
  }
  
  throw new Error(`Unsupported URL format: ${url}`);
}
