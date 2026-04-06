/**
 * Extract text from PDF, XLSX, DOCX, PPTX files in the browser.
 * PDF uses CDN-loaded pdf.js (no npm package — avoids Vite dep optimization issues).
 * XLSX/DOCX use npm dynamic imports.
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

/**
 * PDF extraction via CDN-loaded pdf.js.
 * Loads the library from cdnjs on first use, caches on window.
 */
async function loadPdfJs(): Promise<unknown> {
  const w = window as unknown as Record<string, unknown>
  if (w._pdfjsLib) return w._pdfjsLib

  // Load pdf.js v4.4.168 (stable, verified on CDN)
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs'
    script.type = 'module'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load pdf.js from CDN'))
    document.head.appendChild(script)
  })

  // pdf.js loaded as ES module doesn't expose to window automatically
  // Use the global import approach instead
  // @ts-ignore CDN dynamic import has no type declarations
  const mod = await import(/* @vite-ignore */ 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs')
  w._pdfjsLib = mod
  // Set worker
  mod.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs'
  return mod
}

async function extractPdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const pdfjsLib = await loadPdfJs() as {
    getDocument: (opts: { data: Uint8Array }) => { promise: Promise<{
      numPages: number
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{ items: Array<{ str?: string }> }>
      }>
    }> }
  }

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map((item) => item.str || '').join(' ')
    if (text.trim()) pages.push(`--- Page ${i}/${pdf.numPages} ---\n${text}`)
  }
  if (pages.length === 0) return `[PDF: ${pdf.numPages}ページ、テキスト抽出不可（スキャンPDFの可能性）]`
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
