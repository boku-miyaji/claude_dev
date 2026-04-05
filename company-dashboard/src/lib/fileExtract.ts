/**
 * Extract text from PDF, XLSX, DOCX, PPTX files in the browser.
 * Libraries are dynamically imported to avoid bloating the initial bundle.
 */

const MAX_TEXT_LENGTH = 80000

export async function extractTextFromFile(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''

  try {
    switch (ext) {
      case 'pdf': return await extractPdf(file)
      case 'xlsx': case 'xls': return await extractExcel(file)
      case 'docx': return await extractDocx(file)
      case 'pptx': return await extractPptx(file)
      default: return null
    }
  } catch (e) {
    console.error('[fileExtract] Failed:', file.name, e)
    return `[Error: ${file.name} の抽出失敗: ${(e as Error).message}]`
  }
}

async function extractPdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const pdfjsLib = await import('pdfjs-dist')

  // Disable worker entirely for Vite compatibility
  pdfjsLib.GlobalWorkerOptions.workerSrc = ''
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    disableAutoFetch: true,
    disableStream: true,
  })
  const pdf = await loadingTask.promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    if (text.trim()) pages.push(`--- Page ${i}/${pdf.numPages} ---\n${text}`)
  }
  if (pages.length === 0) return `[PDF: ${pdf.numPages}ページ、テキストを抽出できませんでした（スキャンPDFの可能性）]`
  return truncate(pages.join('\n\n'))
}

async function extractExcel(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheets: string[] = []
  for (const name of wb.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name])
    if (csv.trim()) sheets.push(`--- Sheet: ${name} ---\n${csv}`)
  }
  if (sheets.length === 0) return '[Excel: 空のワークブック]'
  return truncate(sheets.join('\n\n'))
}

async function extractDocx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  if (!result.value.trim()) return '[Word: テキストが空です]'
  return truncate(result.value)
}

async function extractPptx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const decoder = new TextDecoder('utf-8', { fatal: false })
  const raw = decoder.decode(new Uint8Array(buffer))
  const texts: string[] = []
  const regex = /<a:t[^>]*>([^<]+)<\/a:t>/g
  let match
  while ((match = regex.exec(raw)) !== null) {
    if (match[1].trim()) texts.push(match[1])
  }
  if (texts.length === 0) return '[PPTX: テキストを抽出できませんでした]'
  return truncate(texts.join('\n'))
}

function truncate(text: string): string {
  return text.length > MAX_TEXT_LENGTH
    ? text.substring(0, MAX_TEXT_LENGTH) + '\n...(truncated)'
    : text
}
