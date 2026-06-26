/**
 * Capture an invoice DOM node as a PDF and return raw base64 (no data-URL prefix).
 */
export async function captureElementAsPdfBase64(
  element: HTMLElement,
  filename = 'invoice.pdf',
): Promise<{ base64: string; filename: string }> {
  const { default: html2canvas } = await import('html2canvas')
  const { jsPDF } = await import('jspdf')

  const A4_W_MM = 210
  const A4_H_MM = 297

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  })

  const imgData = canvas.toDataURL('image/jpeg', 0.92)
  const imgH_MM = (canvas.height / canvas.width) * A4_W_MM
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  if (imgH_MM <= A4_H_MM) {
    pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, imgH_MM)
  } else {
    const scale = canvas.width / A4_W_MM
    let yMM = 0
    while (yMM < imgH_MM) {
      const sliceHMM = Math.min(A4_H_MM, imgH_MM - yMM)
      const tmp = document.createElement('canvas')
      tmp.width = canvas.width
      tmp.height = Math.ceil(sliceHMM * scale)
      tmp.getContext('2d')!.drawImage(
        canvas,
        0,
        yMM * scale,
        canvas.width,
        sliceHMM * scale,
        0,
        0,
        canvas.width,
        sliceHMM * scale,
      )
      if (yMM > 0) pdf.addPage()
      pdf.addImage(tmp.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, A4_W_MM, sliceHMM)
      yMM += sliceHMM
    }
  }

  const dataUrl = pdf.output('datauristring')
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1]! : dataUrl
  return { base64, filename }
}
