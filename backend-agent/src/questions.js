import { ApiError } from './errors.js';

export async function resolveJenjangId(client, code) {
  const { rows } = await client.query(
    'SELECT id FROM jenjang WHERE kode = $1 AND is_active = true', [code]
  );
  if (!rows[0]) {
    throw new ApiError('VALIDATION_ERROR', `Jenjang tidak ditemukan atau tidak aktif: ${code}`);
  }
  return rows[0].id;
}

export async function insertQuestion(client, data, sourceId = null, imageUrl = null) {
  const mapel = await client.query(
    'SELECT id FROM mapels WHERE code = $1 AND is_active = true', [data.mapel]
  );
  if (!mapel.rows[0]) {
    throw new ApiError('VALIDATION_ERROR', 'Mapel tidak ditemukan atau tidak aktif');
  }
  const jenjangId = await resolveJenjangId(client, data.jenjang);
  const { rows } = await client.query(
    `INSERT INTO questions (jenjang_id, mapel_id, source_id, stem, image_url, question_type, difficulty, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved')
     RETURNING id`,
    [jenjangId, mapel.rows[0].id, sourceId, data.stem, imageUrl, data.question_type, data.difficulty]
  );
  const questionId = rows[0].id;

  if (data.question_type === 'true_false') {
    await replaceStatements(client, questionId, data.statements);
    return loadQuestion(client, questionId);
  }

  for (const option of data.options) {
    await client.query(
      `INSERT INTO question_options (question_id, option_key, content, is_correct, position)
       VALUES ($1, $2, $3, $4, $5)`,
      [questionId, option.key, option.content, option.is_correct, option.position]
    );
  }

  let correctOptionId = null;
  if (data.correct_key) {
    const found = await client.query(
      'SELECT id FROM question_options WHERE question_id = $1 AND option_key = $2',
      [questionId, data.correct_key]
    );
    correctOptionId = found.rows[0]?.id ?? null;
  }

  if (correctOptionId || data.answer_text) {
    await client.query(
      `INSERT INTO answer_keys (question_id, correct_option_id, answer_text, explanation)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (question_id) DO UPDATE SET
         correct_option_id = EXCLUDED.correct_option_id,
         answer_text = EXCLUDED.answer_text,
         explanation = EXCLUDED.explanation,
         updated_at = now()`,
      [questionId, correctOptionId, data.answer_text ?? null, data.explanation ?? null]
    );
  }

  return loadQuestion(client, questionId);
}

export async function loadQuestion(client, questionId) {
  const { rows } = await client.query(`${QUESTION_SELECT} WHERE q.id = $1`, [questionId]);
  return rows[0];
}

export async function replaceStatements(client, questionId, statements) {
  await client.query('DELETE FROM question_statements WHERE question_id = $1', [questionId]);
  for (const statement of statements) {
    await client.query(
      `INSERT INTO question_statements (question_id, position, statement_text, is_correct, explanation)
       VALUES ($1, $2, $3, $4, $5)`,
      [questionId, statement.position, statement.text, statement.is_correct, statement.explanation ?? null]
    );
  }
}

export async function fetchStatements(client, questionId, includeCorrect = false) {
  const run = typeof client === 'function'
    ? client
    : (sql, params) => client.query(sql, params);
  const { rows } = await run(
    `SELECT id, position, statement_text, is_correct, explanation
     FROM question_statements WHERE question_id = $1 ORDER BY position`,
    [questionId]
  );
  return rows.map((row) => ({
    id: row.id,
    position: row.position,
    text: row.statement_text,
    ...(includeCorrect
      ? { is_correct: row.is_correct, explanation: row.explanation }
      : {})
  }));
}

export const QUESTION_SELECT = `
  SELECT q.id, q.stem, q.image_url, q.question_type, q.difficulty, q.status,
          m.code AS mapel_code, m.name AS mapel_name,
          j.kode AS jenjang_kode, j.nama AS jenjang_nama,
          st.code AS source_type, qs.label AS source_label,
         (ak.id IS NOT NULL) AS has_answer_key,
         (SELECT count(*) FROM question_options o WHERE o.question_id = q.id) AS option_count,
         (SELECT count(*) FROM question_statements s WHERE s.question_id = q.id) AS statement_count,
         (SELECT count(*) FROM question_statements s
           WHERE s.question_id = q.id AND s.is_correct) AS correct_statement_count,
         q.created_at, q.updated_at
  FROM questions q
  JOIN mapels m ON m.id = q.mapel_id
  JOIN jenjang j ON j.id = q.jenjang_id
  LEFT JOIN question_sources qs ON qs.id = q.source_id
  LEFT JOIN source_types st ON st.id = qs.type_id
  LEFT JOIN answer_keys ak ON ak.question_id = q.id
`;
