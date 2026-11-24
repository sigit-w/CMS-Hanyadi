export function normalizeAnswer(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeKeys(value) {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
  return raw.map((key) => String(key).trim().toUpperCase()).filter(Boolean);
}

export function gradeStatements(statements, answers) {
  if (!Array.isArray(statements) || !Array.isArray(answers)) return null;
  const byId = new Map(statements.map((statement) => [String(statement.id), statement]));
  const seen = new Set();
  const details = [];
  for (const answer of answers) {
    const id = String(answer?.statement_id ?? answer?.id ?? '');
    const statement = byId.get(id);
    if (!statement || seen.has(id)) return null;
    seen.add(id);
    const raw = answer.value;
    let value;
    if (typeof raw === 'boolean') value = raw;
    else if (typeof raw === 'string' && ['true', 'false'].includes(raw.toLowerCase())) value = raw.toLowerCase() === 'true';
    else return null;
    details.push({
      statement_id: statement.id,
      value,
      is_correct: value === statement.is_correct
    });
  }
  if (details.length !== statements.length) return null;
  return {
    correct: details.every((detail) => detail.is_correct),
    details
  };
}

export function gradeAnswer(variant, payload) {
  const expectedKeys = normalizeKeys(variant?.correct_keys);
  const submittedKeys = normalizeKeys(payload?.answer);
  const answerText = String(payload?.answer_text ?? '').trim();

  if (expectedKeys.length) {
    if (submittedKeys.length !== expectedKeys.length) return false;
    const counts = submittedKeys.reduce((acc, key) => {
      acc.set(key, (acc.get(key) ?? 0) + 1);
      return acc;
    }, new Map());
    return expectedKeys.every((key) => counts.get(key) === 1);
  }
  if (variant?.correct_key) {
    return submittedKeys.length === 1
      && normalizeAnswer(submittedKeys[0]) === normalizeAnswer(variant.correct_key);
  }
  return Boolean(variant?.answer_text)
    && normalizeAnswer(answerText) === normalizeAnswer(variant.answer_text);
}
