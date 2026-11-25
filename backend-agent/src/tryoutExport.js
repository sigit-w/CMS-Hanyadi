const PDF_FONT = 'F1';
const PDF_PAGE_WIDTH = 595;
const PDF_PAGE_HEIGHT = 842;
const PDF_MARGIN = 42;
const PDF_FONT_SIZE = 10;
const PDF_LEADING = 14;
const PDF_MAX_CHARS = 88;
const PDF_LINES_PER_PAGE = 50;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function latin1(text) {
  return String(text ?? '')
    .replace(/[^\x20-\x7e]/g, (character) => {
      const code = character.codePointAt(0);
      return code < 256 ? String.fromCharCode(code) : '?';
    });
}

function pdfEscape(text) {
  return latin1(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(text, maxChars = PDF_MAX_CHARS) {
  const source = latin1(text).replace(/\s+/g, ' ').trim();
  if (!source) return ['-'];
  const words = source.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if (word.length > maxChars) {
      if (line) lines.push(line);
      line = '';
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      continue;
    }
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['-'];
}

function pushLines(lines, text, options = {}) {
  const { bold = false, indent = 0 } = options;
  const prefix = bold ? '' : '';
  for (const line of wrapText(text)) lines.push(`${prefix}${' '.repeat(indent)}${line}`);
}

function buildPdf(linesInput) {
  const lines = linesInput.map((line) => latin1(line).slice(0, 120));
  const pageCount = Math.max(1, Math.ceil(lines.length / PDF_LINES_PER_PAGE));
  const objects = [];
  const pageIds = [];
  const contentIds = [];
  let nextId = 4;
  for (let index = 0; index < pageCount; index += 1) {
    pageIds.push(nextId);
    contentIds.push(nextId + 1);
    nextId += 2;
  }
  const objectsByNumber = new Map();
  objectsByNumber.set(1, `<< /Type /Catalog /Pages 2 0 R >>`);
  objectsByNumber.set(
    2,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`
  );
  objectsByNumber.set(
    3,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`
  );

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageLines = lines.slice(pageIndex * PDF_LINES_PER_PAGE, (pageIndex + 1) * PDF_LINES_PER_PAGE);
    const commands = [
      'BT',
      `/${PDF_FONT} ${PDF_FONT_SIZE} Tf`,
      `${PDF_LEADING} TL`,
      `${PDF_MARGIN} ${PDF_PAGE_HEIGHT - PDF_MARGIN} Td`
    ];
    for (const line of pageLines) {
      commands.push(`(${pdfEscape(line)}) Tj`, 'T*');
    }
    commands.push('ET');
    const stream = Buffer.from(commands.join('\n'), 'latin1');
    objectsByNumber.set(
      pageIds[pageIndex],
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] ` +
        `/Resources << /Font << /${PDF_FONT} 3 0 R >> >> /Contents ${contentIds[pageIndex]} 0 R >>`
    );
    objectsByNumber.set(
      contentIds[pageIndex],
      `<< /Length ${stream.length} >>\nstream\n${stream.toString('latin1')}\nendstream`
    );
  }

  let pdf = '%PDF-1.4\n';
  const offsets = new Map();
  for (let number = 1; number < nextId; number += 1) {
    offsets.set(number, Buffer.byteLength(pdf, 'latin1'));
    pdf += `${number} 0 obj\n${objectsByNumber.get(number)}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${nextId}\n0000000000 65535 f \n`;
  for (let number = 1; number < nextId; number += 1) {
    pdf += `${String(offsets.get(number)).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${nextId} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

function dosDateTime(date = new Date()) {
  const jakarta = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return {
    time: (jakarta.getUTCHours() << 11) | (jakarta.getUTCMinutes() << 5) | (jakarta.getUTCSeconds() >> 1),
    date: ((jakarta.getUTCFullYear() - 1980) << 9) | ((jakarta.getUTCMonth() + 1) << 5) | jakarta.getUTCDate()
  };
}

function safeZipName(value) {
  return latin1(String(value ?? 'soal'))
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'soal';
}

function buildZip(entries) {
  const { time, date } = dosDateTime();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'latin1');
    const data = entry.data;
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralSize = centrals.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, ...centrals, end]);
}

function sheetHeader(sheet, mapel) {
  return [
    `Nama lembar soal: ${sheet?.name || '-'}`,
    `Kode lembar soal: ${sheet?.code || '-'}`,
    `Mapel: ${mapel?.name || mapel?.code || '-'} (${mapel?.code || '-'})`,
    `Keterangan: ${sheet?.description || '-'}`
  ];
}

function questionLines(question, includeKeys, options, answerKey, statements, correctKeys) {
  const lines = [
    `Soal ${question.number}. [${question.question_type}] ${question.stem}`,
    ...(question.image_url ? [`Gambar: ${question.image_url}`] : [])
  ];
  if (question.question_type === 'true_false') {
    for (const statement of statements) {
      lines.push(`   ${statement.position}. ${statement.statement_text}`);
      if (includeKeys) lines.push(`      Kunci: ${statement.is_correct ? 'Benar' : 'Salah'}`);
    }
  } else {
    for (const option of options) {
      lines.push(`   ${option.option_key}. ${option.content}`);
    }
  }
  if (includeKeys) {
    const keys = correctKeys.length > 0
      ? correctKeys
      : [answerKey?.correct_option_key || answerKey?.answer_text || '-'];
    lines.push(`Kunci jawaban: ${keys.join(', ')}`);
    if (answerKey?.explanation) lines.push(`Pembahasan: ${answerKey.explanation}`);
    if (statements.some((statement) => statement.explanation)) {
      for (const statement of statements) {
        if (statement.explanation) lines.push(`Pembahasan pernyataan ${statement.position}: ${statement.explanation}`);
      }
    }
  }
  return lines;
}

export function buildQuestionsZip({ event, sessionData, includeKeys }) {
  const variant = includeKeys ? 'soal-dan-kunci' : 'soal';
  const entries = sessionData.map(({ session, sheets, questions, optionsByQuestion, answerKeysByQuestion, statementsByQuestion }) => {
    const correctKeysByQuestion = new Map(
      [...optionsByQuestion.entries()].map(([questionId, opts]) => [
        questionId,
        opts.filter((option) => Boolean(option.is_correct)).map((option) => option.option_key)
      ])
    );
    const lines = [
      `HASIL EKSPOR SOAL TRYOUT: ${event.name}`,
      `Jadwal: ${event.starts_at} s.d. ${event.ends_at}`,
      `Sesi: ${session.name || '-'} (${session.slug || '-'})`,
      `Varian: ${includeKeys ? 'Soal dan Kunci Jawaban' : 'Soal Tanpa Kunci'}`,
      ''
    ];
    if (sheets.length === 0) {
      pushLines(lines, 'Nama lembar soal: -');
      pushLines(lines, 'Kode lembar soal: -');
      pushLines(lines, `Mapel: ${session.mapel_name || session.mapel_code || '-'}`);
      pushLines(lines, 'Keterangan: -');
    } else {
      for (const sheet of sheets) {
        lines.push(...sheetHeader(sheet, session));
        lines.push('');
      }
    }
    lines.push(`Jumlah soal: ${questions.length}`, '');
    for (const question of questions) {
      const correctKeys = correctKeysByQuestion.get(question.id) ?? [];
      lines.push(...questionLines(
        question,
        includeKeys,
        optionsByQuestion.get(question.id) ?? [],
        answerKeysByQuestion.get(question.id),
        statementsByQuestion.get(question.id) ?? [],
        correctKeys
      ));
      lines.push('');
    }
    const name = safeZipName(`${event.slug || event.name}-${session.slug || session.name}-${variant}.pdf`);
    return { name, data: buildPdf(lines) };
  });
  return buildZip(entries);
}

export async function loadSessionExportData(query, sessionIds) {
  const [sessions, sheetRows, questionRows, optionRows, keyRows, statementRows] = await Promise.all([
    query(
      `SELECT s.id, s.name, s.slug, s.mapel_id,
              m.code AS mapel_code, m.name AS mapel_name
       FROM tryout_sessions s
       LEFT JOIN mapels m ON m.id = s.mapel_id
       WHERE s.id = ANY($1::bigint[]) ORDER BY s.id`,
      [sessionIds]
    ),
    query(
      `SELECT tss.session_id, sh.id, sh.name, sh.code, sh.description
       FROM tryout_session_sheets tss
       JOIN question_sheets sh ON sh.id = tss.sheet_id
       WHERE tss.session_id = ANY($1::bigint[])
       ORDER BY tss.session_id, sh.code`,
      [sessionIds]
    ),
    query(
      `SELECT tq.session_id, tq.position, q.id, q.stem, q.image_url, q.question_type
       FROM tryout_session_questions tq
       JOIN questions q ON q.id = tq.question_id
       WHERE tq.session_id = ANY($1::bigint[])
       ORDER BY tq.session_id, tq.position, q.id`,
      [sessionIds]
    ),
    query(
      `SELECT qo.question_id, qo.option_key, qo.content, qo.is_correct
       FROM question_options qo
       WHERE qo.question_id IN (
         SELECT tq.question_id FROM tryout_session_questions tq WHERE tq.session_id = ANY($1::bigint[])
       )
       ORDER BY qo.question_id, qo.position, qo.option_key`,
      [sessionIds]
    ),
    query(
      `SELECT ak.question_id, ak.answer_text, ak.explanation, qo.option_key AS correct_option_key
       FROM answer_keys ak
       LEFT JOIN question_options qo ON qo.id = ak.correct_option_id
       WHERE ak.question_id IN (
         SELECT tq.question_id FROM tryout_session_questions tq WHERE tq.session_id = ANY($1::bigint[])
       )`,
      [sessionIds]
    ),
    query(
      `SELECT question_id, position, statement_text, is_correct, explanation
       FROM question_statements
       WHERE question_id IN (
         SELECT tq.question_id FROM tryout_session_questions tq WHERE tq.session_id = ANY($1::bigint[])
       )
       ORDER BY question_id, position`,
      [sessionIds]
    )
  ]);

  const sheetsBySession = new Map();
  for (const row of sheetRows.rows) {
    const id = Number(row.session_id);
    if (!sheetsBySession.has(id)) sheetsBySession.set(id, []);
    sheetsBySession.get(id).push(row);
  }
  const optionsByQuestion = new Map();
  for (const row of optionRows.rows) {
    const id = Number(row.question_id);
    if (!optionsByQuestion.has(id)) optionsByQuestion.set(id, []);
    optionsByQuestion.get(id).push(row);
  }
  const answerKeysByQuestion = new Map(
    keyRows.rows.map((row) => [Number(row.question_id), row])
  );
  const statementsByQuestion = new Map();
  for (const row of statementRows.rows) {
    const id = Number(row.question_id);
    if (!statementsByQuestion.has(id)) statementsByQuestion.set(id, []);
    statementsByQuestion.get(id).push(row);
  }
  const questionsBySession = new Map();
  for (const row of questionRows.rows) {
    const id = Number(row.session_id);
    if (!questionsBySession.has(id)) questionsBySession.set(id, []);
    questionsBySession.get(id).push({
      ...row,
      id: Number(row.id),
      number: questionsBySession.get(id).length + 1
    });
  }
  return sessions.rows.map((session) => ({
    session: {
      ...session,
      id: Number(session.id),
      mapel_id: session.mapel_id === null ? null : Number(session.mapel_id)
    },
    sheets: sheetsBySession.get(Number(session.id)) ?? [],
    questions: questionsBySession.get(Number(session.id)) ?? [],
    optionsByQuestion,
    answerKeysByQuestion,
    statementsByQuestion
  }));
}

export function zipFilename(event, includeKeys) {
  return `${safeZipName(event.slug || event.name)}-${includeKeys ? 'soal-dan-kunci' : 'soal'}.zip`;
}

export function zipResponse(res, buffer, event, includeKeys) {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${zipFilename(event, includeKeys)}"`
  );
  res.setHeader('Content-Length', String(buffer.length));
  return res.send(buffer);
}

export const exportHelpers = { buildPdf, buildZip, crc32 };
