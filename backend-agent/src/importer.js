import ExcelJS from 'exceljs';
import { ApiError } from './errors.js';
import { validateQuestionCreate } from './validate.js';

const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];
const TRUE_FALSE_VALUES = new Set(['1', 'true', 'ya', 'yes', 'benar', 'b', 'correct', '✓']);
const REQUIRED_HEADERS = [
  'stem', 'mapel', 'jenjang', 'type', 'difficulty', 'option_a', 'option_b',
  'option_c', 'option_d', 'correct_key', 'correct_keys', 'answer_text',
  'explanation', 'statement_1', 'statement_1_correct', 'statement_1_explanation',
  'statement_2', 'statement_2_correct', 'statement_2_explanation'
];

function stripBom(text) {
  return String(text ?? '').replace(/^\uFEFF/, '');
}

function normalizeHeader(value) {
  return stripBom(value).trim().toLowerCase().replace(/\s+/g, '_');
}

function cellText(value) {
  if (value === undefined || value === null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text ?? '').join('');
    if (value.text !== undefined) return String(value.text);
    if (value.result !== undefined) return String(value.result);
    if (value.hyperlink !== undefined) return String(value.text ?? value.hyperlink);
    return '';
  }
  return String(value).trim();
}

function isTrue(value) {
  return TRUE_FALSE_VALUES.has(cellText(value).toLowerCase());
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function requireHeaders(header, format) {
  const missing = REQUIRED_HEADERS.filter((name) => !header.includes(name));
  if (missing.length) {
    throw new ApiError('VALIDATION_ERROR', `Kolom ${format} wajib: ${missing.join(', ')}`);
  }
  if (header.indexOf('jenjang') !== header.indexOf('mapel') + 1) {
    throw new ApiError('VALIDATION_ERROR', `Kolom ${format} jenjang harus tepat setelah mapel`);
  }
}

function parseCsv(content) {
  const text = stripBom(Buffer.isBuffer(content) ? content.toString('utf8') : content);
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    throw new ApiError('INVALID_IMPORT', 'CSV minimal header dan satu baris data');
  }
  const header = parseCsvLine(lines[0]).map(normalizeHeader);
  requireHeaders(header, 'CSV');

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(header.map((name, index) => [name, cells[index] ?? '']));
  });
}

async function parseXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ApiError('INVALID_IMPORT', 'XLSX tidak memiliki lembar kerja');
  const header = (sheet.getRow(1).values ?? []).slice(1).map(cellText).map(normalizeHeader);
  requireHeaders(header, 'XLSX');
  if (sheet.rowCount < 2) {
    throw new ApiError('INVALID_IMPORT', 'XLSX minimal header dan satu baris data');
  }

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = (row.values ?? []).slice(1).map(cellText);
    if (!values.some((value) => value)) return;
    rows.push(Object.fromEntries(header.map((name, index) => [name, values[index] ?? ''])));
  });
  return rows;
}

function normalizeImportedRow(row) {
  const questionType = cellText(row.type ?? row.question_type) || 'multiple_choice';
  const result = {
    stem: cellText(row.stem),
    mapel: cellText(row.mapel),
    jenjang: cellText(row.jenjang),
    question_type: questionType,
    difficulty: cellText(row.difficulty) || 'medium',
    answer_text: cellText(row.answer_text) || null,
    explanation: cellText(row.explanation) || null
  };

  if (questionType === 'true_false') {
    const statements = [];
    for (let index = 1; index <= 5; index += 1) {
      const text = cellText(row[`statement_${index}`]);
      if (!text) continue;
      statements.push({
        text,
        is_correct: isTrue(row[`statement_${index}_correct`]),
        explanation: cellText(row[`statement_${index}_explanation`]) || null
      });
    }
    result.statements = statements;
    return result;
  }

  const options = [];
  for (const key of OPTION_KEYS) {
    const content = cellText(row[`option_${key}`]);
    if (content) options.push({ key: key.toUpperCase(), content });
  }
  result.options = options;
  const rawKeys = cellText(row.correct_keys) || cellText(row.correct_key);
  result.correct_keys = rawKeys.toUpperCase().split(/[^A-F]+/).filter((key) => /^[A-F]$/.test(key));
  return result;
}

export async function parseQuestions(content, filename = '') {
  const name = String(filename ?? '').toLowerCase();
  let rows;
  if (name.endsWith('.csv')) {
    rows = parseCsv(content);
  } else if (name.endsWith('.xlsx')) {
    rows = await parseXlsx(content);
  } else {
    throw new ApiError('VALIDATION_ERROR', 'Impor soal hanya menerima file CSV atau XLSX');
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new ApiError('EMPTY_IMPORT', 'Tidak ada soal yang dapat diimpor');
  }

  return rows.map((row, index) => {
    try {
      return validateQuestionCreate(normalizeImportedRow(row));
    } catch (error) {
      throw new ApiError('VALIDATION_ERROR', `Soal ke-${index + 1}: ${error.message}`);
    }
  });
}
