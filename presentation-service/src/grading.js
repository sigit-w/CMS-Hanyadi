export function normalizeAnswer(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeKeys(value) {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
  return raw.map((key) => String(key).trim().toUpperCase()).filter(Boolean);
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
