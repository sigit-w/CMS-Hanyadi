import { ApiError } from './errors.js';
import { validateQuestionCreate } from './validate.js';

function stripBom(text) {
  return String(text).replace(/^\uFEFF/, '');
}

function parseCsv(content) {
  const lines = stripBom(content).split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    throw new ApiError('INVALID_IMPORT', 'CSV minimal header dan satu baris data');
  }
  const header = lines[0].split(',').map((cell) => cell.trim().toLowerCase());
  if (!header.includes('stem') || !header.includes('mapel')) {
    throw new ApiError('INVALID_IMPORT', 'Kolom CSV wajib: stem, mapel');
  }

  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = Object.fromEntries(header.map((name, index) => [name, (cells[index] ?? '').trim()]));
    const rawKeys = row.correct_keys ?? row.correct_key ?? '';
    const correctKeys = String(rawKeys).toUpperCase().split(/[^A-F]+/).filter((key) => /^[A-F]$/.test(key));
    const options = [];
    for (const key of ['a', 'b', 'c', 'd']) {
      const content = row[`option_${key}`];
      if (content) {
        options.push({
          key: key.toUpperCase(),
          content,
          is_correct: correctKeys.includes(key.toUpperCase())
        });
      }
    }
    return {
      stem: row.stem,
      mapel: row.mapel,
      question_type: row.type || 'multiple_choice',
      difficulty: row.difficulty || 'medium',
      options,
      answer_text: row.answer_text || null,
      explanation: row.explanation || null
    };
  });
}

function parseTxt(content) {
  const blocks = stripBom(content).split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const get = (prefix) => {
      const line = lines.find((item) => item.toLowerCase().startsWith(prefix));
      return line ? line.slice(prefix.length).trim() : null;
    };
    const options = [];
    for (const line of lines) {
      const match = line.match(/^([A-F])[.)]\s+(.+)$/i);
      if (match) {
        options.push({ key: match[1].toUpperCase(), content: match[2], is_correct: false });
      }
    }
    const correct = get('jawaban:') || get('answer:');
    if (correct) {
      const correctKeys = String(correct).toUpperCase().split(/[^A-F]+/).filter((key) => /^[A-F]$/.test(key));
      for (const key of correctKeys) {
        const option = options.find((item) => item.key === key);
        if (option) option.is_correct = true;
      }
    }
    return {
      stem: get('soal:') || get('stem:'),
      mapel: get('mapel:'),
      question_type: get('tipe:') || 'multiple_choice',
      difficulty: get('kesulitan:') || 'medium',
      options,
      answer_text: get('jawaban_teks:') || null,
      explanation: get('pembahasan:') || null
    };
  });
}

export function parseQuestions(format, content, filename = '') {
  const name = filename.toLowerCase();
  const kind = format || (name.endsWith('.json') ? 'json' : name.endsWith('.csv') ? 'csv' : 'txt');

  let raw;
  if (kind === 'json') {
    try {
      raw = JSON.parse(stripBom(content));
    } catch {
      throw new ApiError('INVALID_IMPORT', 'JSON tidak valid');
    }
    if (!Array.isArray(raw)) {
      raw = raw?.questions ?? (raw?.stem ? [raw] : []);
    }
  } else if (kind === 'csv') {
    raw = parseCsv(content);
  } else if (kind === 'txt') {
    raw = parseTxt(content);
  } else {
    throw new ApiError('UNSUPPORTED_FORMAT', `Format ${kind} tidak didukung`);
  }

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ApiError('EMPTY_IMPORT', 'Tidak ada soal yang dapat diimpor');
  }

  return raw.map((item, index) => {
    try {
      return validateQuestionCreate(item);
    } catch (error) {
      throw new ApiError('INVALID_IMPORT', `Soal ke-${index + 1}: ${error.message}`);
    }
  });
}
