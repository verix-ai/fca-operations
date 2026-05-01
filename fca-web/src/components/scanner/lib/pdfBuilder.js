import { PDFDocument } from 'pdf-lib'

export async function buildPdf(pages, { filename }) {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error('buildPdf requires at least one page')
  }

  const pdf = await PDFDocument.create()

  for (const blob of pages) {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const image = await pdf.embedJpg(bytes)
    const page = pdf.addPage([image.width, image.height])
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  }

  const pdfBytes = await pdf.save()
  return new File([pdfBytes], filename, { type: 'application/pdf' })
}
