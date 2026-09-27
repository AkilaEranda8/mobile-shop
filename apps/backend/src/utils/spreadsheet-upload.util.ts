/**
 * Spreadsheet upload mitigations for untrusted .xlsx/.xls/.csv buffers.
 * xlsx (SheetJS community) has known High advisories with no upstream fix —
 * keep parsing tightly constrained and never log file contents.
 */
import { AppError } from '../middleware/error.middleware'

const ALLOWED_EXT = new Set(['.xlsx', '.xls', '.csv'])
const ALLOWED_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream', // browsers often send this for xlsx
  'text/csv',
  'application/csv',
  'text/plain',
])

const MAX_SHEETS = 5
const MAX_ROWS = 20_000
const MAX_COLS = 64
const MAX_CELL_CHARS = 2_000

export function assertSafeSpreadsheetMeta(originalname: string, mimetype?: string): void {
  const original = String(originalname || 'upload')
  const lower = original.toLowerCase()
  const dot = lower.lastIndexOf('.')
  const ext = dot >= 0 ? lower.slice(dot) : ''
  if (!ALLOWED_EXT.has(ext)) {
    throw new AppError('Unsupported file type. Upload .xlsx, .xls, or .csv only.', 400)
  }

  const mime = String(mimetype || '').toLowerCase().trim()
  if (mime && !ALLOWED_MIME.has(mime)) {
    throw new AppError('Unsupported file content type.', 400)
  }

  // Reject OLE/macro-ish filenames and double extensions
  if (/\.(xlsm|xlsb|xltm|xlam)(\.|$)/i.test(lower) || /\.(exe|js|vbs|bat|cmd|ps1)(\.|$)/i.test(lower)) {
    throw new AppError('Macro-enabled or executable spreadsheets are not allowed.', 400)
  }
}

export function assertSafeSpreadsheetUpload(file: Express.Multer.File): void {
  if (!file?.buffer?.length) throw new AppError('No file uploaded', 400)
  assertSafeSpreadsheetMeta(file.originalname, file.mimetype)
}

/** Parse first sheet to a bounded matrix. Does not execute macros. */
export function parseSpreadsheetMatrix(buffer: Buffer): any[][] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as typeof import('xlsx')

  let wb: import('xlsx').WorkBook
  try {
    wb = XLSX.read(buffer, {
      type: 'buffer',
      raw: false,
      cellDates: false,
      cellNF: false,
      cellStyles: false,
      cellHTML: false,
      sheetRows: MAX_ROWS + 1,
      bookVBA: false,
      bookFiles: false,
      bookDeps: false,
    })
  } catch {
    throw new AppError('Unable to parse spreadsheet. File may be corrupt or unsupported.', 400)
  }

  if (!wb.SheetNames?.length) throw new AppError('Spreadsheet has no sheets', 400)
  if (wb.SheetNames.length > MAX_SHEETS) {
    throw new AppError(`Too many sheets (max ${MAX_SHEETS})`, 400)
  }

  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new AppError('First sheet is empty', 400)

  const matrix: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  })

  if (!matrix.length) throw new AppError('File is empty or has no data rows', 400)
  if (matrix.length > MAX_ROWS + 1) {
    throw new AppError(`Too many rows (max ${MAX_ROWS})`, 400)
  }

  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r]
    if (!Array.isArray(row)) continue
    if (row.length > MAX_COLS) {
      throw new AppError(`Too many columns (max ${MAX_COLS})`, 400)
    }
    for (let c = 0; c < row.length; c++) {
      const cell = row[c]
      if (cell == null) continue
      const s = String(cell)
      if (s.length > MAX_CELL_CHARS) {
        throw new AppError('Cell value too long', 400)
      }
      // Soft-sanitize formula-like cells (SheetJS may still surface formula text)
      if (/^[=+\-@]/.test(s.trim())) {
        row[c] = `'${s}`
      }
    }
  }

  return matrix
}
