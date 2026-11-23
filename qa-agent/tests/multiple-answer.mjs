import { adminHeaders, API_BASE } from './auth-helper.mjs';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { query, pool } from '../../backend-agent/src/db.js';
import { gradeAnswer } from '../../presentation-service/src/grading.js';

const BASE = API_BASE;
const suffix = crypto.randomBytes(4).toString('hex');
const questionIds = [];

async function request(pathname, options = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

after(async () => {
  if (questionIds.length) {
    await query('DELETE FROM questions WHERE id = ANY($1::bigint[])', [questionIds]);
  }
  await pool.end();
});

test('MA-01 soal multi-jawaban tersimpan dan langsung approved', async () => {
  const created = await request('/api/v1/questions', {
    method: 'POST',
    headers: await adminHeaders(),
    body: JSON.stringify({
      stem: `QA multi-jawaban ${suffix}`,
      mapel: 'MTKA',
      question_type: 'multiple_answer',
      difficulty: 'medium',
      options: [
        { key: 'A', content: 'Salah 1' },
        { key: 'B', content: 'Benar 1' },
        { key: 'C', content: 'Salah 2' },
        { key: 'D', content: 'Benar 2' }
      ],
      correct_keys: ['B'],
      explanation: 'Satu opsi benar'
    })
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.data.question.id;
  questionIds.push(id);

  const options = await query(
    `SELECT o.id, o.option_key, o.is_correct,
            (SELECT ak.correct_option_id FROM answer_keys ak WHERE ak.question_id = $1) AS correct_option_id
     FROM question_options o
     WHERE o.question_id = $1
     ORDER BY o.position`,
    [id]
  );
  assert.deepEqual(
    options.rows.filter((row) => row.is_correct).map((row) => row.option_key),
    ['B']
  );
  assert.equal(options.rows[0].correct_option_id, options.rows.find((row) => row.option_key === 'B').id);

  const keyUpdate = await request(`/api/v1/questions/${id}/answer-key`, {
    method: 'PUT',
    headers: await adminHeaders(),
    body: JSON.stringify({ correct_keys: ['D', 'B'] })
  });
  assert.equal(keyUpdate.status, 200, JSON.stringify(keyUpdate.body));
  assert.deepEqual(keyUpdate.body.data.answer_key.correct_keys, ['D', 'B']);

  const stored = await query('SELECT status FROM questions WHERE id = $1', [id]);
  assert.equal(stored.rows[0].status, 'approved');
  const keys = await query(
    `SELECT option_key FROM question_options
     WHERE question_id = $1 AND is_correct ORDER BY option_key`,
    [id]
  );
  assert.deepEqual(keys.rows.map((row) => row.option_key), ['B', 'D']);
});

test('MA-02 penilaian multi-jawaban memakai kesetepatan kunci', () => {
  const variant = { correct_keys: ['B', 'D'] };
  assert.equal(gradeAnswer(variant, { answer: ['D', 'B'] }), true);
  assert.equal(gradeAnswer(variant, { answer: 'B,D' }), true);
  assert.equal(gradeAnswer(variant, { answer: ['B'] }), false);
  assert.equal(gradeAnswer(variant, { answer: ['B', 'C'] }), false);
  assert.equal(gradeAnswer(variant, { answer: ['B', 'B', 'D'] }), false);
  assert.equal(gradeAnswer({ correct_keys: ['B'] }, { answer: ['B'] }), true);
  assert.equal(gradeAnswer({ correct_keys: ['B'] }, { answer: ['D'] }), false);
  assert.equal(gradeAnswer({ correct_key: 'B' }, { answer: 'b' }), true);
  assert.equal(gradeAnswer({ answer_text: 'Hijau' }, { answer_text: ' hijau ' }), true);
});
