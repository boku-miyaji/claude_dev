/**
 * Extract text from PDF, XLSX, DOCX, PPTX files in the browser.
 * Libraries are dynamically imported to avoid bloating the initial bundle.
 */

const MAX_TEXT_LENGTH = 80000

export async function extractTextFromFile(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  const buffer = await file.arrayBuffer()

  try {
    switch (ext) {
      case 'pdf': return await extractPdf(buffer)
      case 'xlsx': case 'xls': return await extractExcel(buffer)
      case 'docx': return await extractDocx(buffer)
      case 'pptx': return await extractPptx(buffer)
      default: return null
    }
  } catch (e) {
    console.error('[fileExtract] Failed:', file.name, e)
    return '[Error: ' + file.name + ' の抽出失敗: ' + (e as Error).message + ']'
  }
}

async function extractPdf(buffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = ''
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  } as Parameters<typeof pdfjsLib.getDocument>[0]).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push('--- Page ' + i + ' ---\n' + text)
  }
  return truncate(pages.join('\n\n'))
}

async function extractExcel(buffer: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheets: string[] = []
  for (const name of wb.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name])
    sheets.push('--- Sheet: ' + name + ' ---\n' + csv)
  }
  return truncate(sheets.join('\n\n'))
}

async function extractDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return truncate(result.value)
}

async function extractPptx(buffer: ArrayBuffer): Promise<string> {
  // PPTX is a ZIP containing XML. Scan raw bytes for <a:t> tags.
  const decoder = new TextDecoder('utf-8', { fatal: false })
  const fullText = decoder.decode(new Uint8Array(buffer))
  const texts: string[] = []
  const regex = /<a:t[^>]*>([^<]+)<\/a:t>/g
  let match
  while ((match = regex.exec(fullText)) !== null) {
    if (match[1].trim()) texts.push(match[1])
  }
  return truncate(texts.join('\n') || '[PPTX: テキストを抽出できませんでした]')
}

function truncate(text: string): string {
  return text.length > MAX_TEXT_LENGTH
    ? text.substring(0, MAX_TEXT_LENGTH) + '\n...(truncated)'
    : text
}
