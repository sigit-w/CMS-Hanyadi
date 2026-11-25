import { ApiError } from './errors.js';

export const MAPELS = ['MTKA', 'BIND', 'IPAS', 'BING'];
export const MAPEL_CODE_PATTERN = /^[A-Z0-9]{4}$/;
export const CHOICE_TYPES = ['multiple_choice', 'multiple_answer'];
export const QUESTION_TYPES = ['multiple_choice', 'true_false', 'multiple_answer', 'short_answer', 'essay'];
export const TRUE_FALSE_MAX_STATEMENTS = 5;
export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export const STATUSES = ['approved', 'rejected', 'archived'];
export const JENJANG_KODES = ['SD', 'SMP', 'SMA'];
export const IMAGE_ONLY_STEM = '[Gambar soal]';

export function requireText(value, field, max = 10000) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApiError('VALIDATION_ERROR', `${field} wajib diisi`);
  }
  if (value.length > max) {
    throw new ApiError('VALIDATION_ERROR', `${field} terlalu panjang`);
  }
  return value.trim();
}

export function requireEnum(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw new ApiError('VALIDATION_ERROR', `${field} tidak valid: ${value}`);
  }
  return value;
}

export function requireMapelCode(value) {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!MAPEL_CODE_PATTERN.test(code)) {
    throw new ApiError('VALIDATION_ERROR', 'Kode mapel harus tepat 4 karakter A-Z atau 0-9');
  }
  return code;
}

export function requireJenjangCode(value) {
  const raw = value === undefined || value === null ? '' : String(value).trim().toUpperCase();
  if (!raw) {
    throw new ApiError('VALIDATION_ERROR', 'Jenjang wajib diisi');
  }
  if (!JENJANG_KODES.includes(raw)) {
    throw new ApiError('VALIDATION_ERROR', `Jenjang tidak dikenal: ${raw}; gunakan SD, SMP, atau SMA`);
  }
  return raw;
}

export function requireMapelCodes(value) {
  if (!Array.isArray(value)) {
    throw new ApiError('VALIDATION_ERROR', 'mapel_codes harus berupa array kode mapel');
  }
  if (value.length < 1 || value.length > 10) {
    throw new ApiError('VALIDATION_ERROR', 'mapel_codes wajib berisi 1 sampai 10 kode mapel');
  }
  const codes = value.map((item) => requireMapelCode(item));
  if (new Set(codes).size !== codes.length) {
    throw new ApiError('VALIDATION_ERROR', 'mapel_codes tidak boleh mengandung mapel ganda');
  }
  return codes;
}

export function parseId(value, field = 'id') {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ApiError('VALIDATION_ERROR', `${field} harus bilangan bulat positif`);
  }
  return id;
}

function hasContent(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== '';
}

export function normalizeCorrectKeys(value, field) {
  if (value === undefined || value === null) return [];
  const raw = Array.isArray(value) ? value : [value];
  const keys = raw
    .map((item) => requireText(String(item), field, 4).toUpperCase())
    .filter(Boolean);
  return [...new Set(keys)];
}

export function normalizeOptions(options, questionType) {
  if (options === undefined || options === null) return [];
  if (!Array.isArray(options)) {
    throw new ApiError('VALIDATION_ERROR', 'options harus berupa array');
  }
  if (options.length > 6) {
    throw new ApiError('VALIDATION_ERROR', 'Jumlah opsi maksimal 6');
  }

  const needsOptions = CHOICE_TYPES.includes(questionType);
  if (needsOptions && options.length < 2) {
    throw new ApiError('VALIDATION_ERROR', 'Soal pilihan harus memiliki minimal 2 opsi');
  }

  const seen = new Set();
  const result = options.map((option, index) => {
    const rawKey = option?.key ?? String.fromCharCode(65 + index);
    const key = requireText(String(rawKey), 'option key', 4).toUpperCase();
    if (seen.has(key)) {
      throw new ApiError('VALIDATION_ERROR', `Kunci opsi ganda: ${key}`);
    }
    seen.add(key);
    const content = requireText(option?.content ?? option?.text, `opsi ${key}`);
    const is_correct = Boolean(option?.is_correct ?? option?.correct ?? false);
    return { key, content, is_correct, position: index };
  });

  if (!needsOptions && result.filter((option) => option.is_correct).length > 1) {
    throw new ApiError('VALIDATION_ERROR', 'Maksimal satu opsi yang benar');
  }

  return result;
}

export function normalizeStatements(statements, questionType) {
  if (questionType !== 'true_false') return [];
  if (!Array.isArray(statements)) {
    throw new ApiError('VALIDATION_ERROR', 'statements harus berupa array');
  }
  if (statements.length < 1) {
    throw new ApiError('VALIDATION_ERROR', 'Soal Benar/Salah wajib memiliki minimal 1 pernyataan');
  }
  if (statements.length > TRUE_FALSE_MAX_STATEMENTS) {
    throw new ApiError('VALIDATION_ERROR', `Jumlah pernyataan maksimal ${TRUE_FALSE_MAX_STATEMENTS}`);
  }
  const result = statements.map((statement, index) => ({
    position: index + 1,
    text: requireText(statement?.text ?? statement?.statement_text, `pernyataan ${index + 1}`, 1000),
    is_correct: Boolean(statement?.is_correct ?? statement?.correct ?? false),
    explanation: statement?.explanation ?? null
  }));
  if (!result.some((statement) => statement.is_correct)) {
    throw new ApiError('VALIDATION_ERROR', 'Harus ada minimal satu pernyataan yang benar');
  }
  return result;
}

export function validateQuestionCreate(body, hasImage = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError('VALIDATION_ERROR', 'Body harus berupa objek');
  }

  const rawStem = body.stem ?? body.question;
  const stem = hasImage && (rawStem === undefined || rawStem === null || (typeof rawStem === 'string' && !rawStem.trim()))
    ? IMAGE_ONLY_STEM
    : requireText(rawStem, 'stem');
  const jenjang = requireJenjangCode(body.jenjang ?? body.jenjang_kode);
  const mapel = requireMapelCode(body.mapel ?? body.mapel_code);
  const questionType = requireEnum(body.question_type ?? 'multiple_choice', QUESTION_TYPES, 'question_type');
  const difficulty = requireEnum(body.difficulty ?? 'medium', DIFFICULTIES, 'difficulty');
  const isTrueFalse = questionType === 'true_false';
  if (isTrueFalse && (hasContent(body.options) || hasContent(body.correct_keys) || hasContent(body.correct_key))) {
    throw new ApiError('VALIDATION_ERROR', 'Soal Benar/Salah memakai field statements, bukan options/correct_key');
  }
  const statements = normalizeStatements(body.statements, questionType);
  const options = isTrueFalse ? [] : normalizeOptions(body.options, questionType);
  const declaredKeys = isTrueFalse ? [] : body.correct_keys !== undefined
    ? normalizeCorrectKeys(body.correct_keys, 'correct_keys')
    : body.correct_key !== undefined
      ? normalizeCorrectKeys(body.correct_key, 'correct_key')
      : [];
  const correctKeys = declaredKeys.length
    ? declaredKeys
    : options.filter((option) => option.is_correct).map((option) => option.key);
  const answerText = body.answer_text ?? null;
  const explanation = body.explanation ?? null;

  for (const key of correctKeys) {
    if (!options.some((option) => option.key === key)) {
      throw new ApiError('VALIDATION_ERROR', `Kunci jawaban ${key} tidak sesuai opsi mana pun`);
    }
  }
  if (questionType === 'multiple_choice' && correctKeys.length !== 1) {
    throw new ApiError('VALIDATION_ERROR', 'Harus tepat satu opsi yang benar');
  }
  if (CHOICE_TYPES.includes(questionType) && correctKeys.length === 0) {
    throw new ApiError('VALIDATION_ERROR', 'Harus ada kunci jawaban benar');
  }
  if ((questionType === 'essay' || questionType === 'short_answer') && !answerText) {
    throw new ApiError('VALIDATION_ERROR', 'answer_text wajib untuk soal esai/short answer');
  }

  const normalizedOptions = options.map((option) => ({
    ...option,
    is_correct: correctKeys.includes(option.key)
  }));

  return {
    stem,
    jenjang,
    mapel,
    question_type: questionType,
    difficulty,
    options: normalizedOptions,
    statements,
    correct_keys: correctKeys,
    correct_key: correctKeys[0] ?? null,
    answer_text: answerText,
    explanation
  };
}

export function validateQuestionUpdate(body, currentQuestionType = 'multiple_choice') {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError('VALIDATION_ERROR', 'Body harus berupa objek');
  }
  const result = { jenjang: requireJenjangCode(body.jenjang ?? body.jenjang_kode) };
  if (body.stem !== undefined) result.stem = requireText(body.stem, 'stem');
  if (body.mapel !== undefined || body.mapel_code !== undefined) {
    result.mapel = requireMapelCode(body.mapel ?? body.mapel_code);
  }
  if (body.question_type !== undefined) {
    result.question_type = requireEnum(body.question_type, QUESTION_TYPES, 'question_type');
  }
  if (body.difficulty !== undefined) {
    result.difficulty = requireEnum(body.difficulty, DIFFICULTIES, 'difficulty');
  }
  if (body.status !== undefined) {
    result.status = requireEnum(body.status, STATUSES, 'status');
  }

  const questionType = result.question_type ?? currentQuestionType;
  const isTrueFalse = questionType === 'true_false';
  if (isTrueFalse && (hasContent(body.options) || hasContent(body.correct_keys) || hasContent(body.correct_key))) {
    throw new ApiError('VALIDATION_ERROR', 'Soal Benar/Salah memakai field statements, bukan options/correct_key');
  }
  if (!isTrueFalse && hasContent(body.statements)) {
    throw new ApiError('VALIDATION_ERROR', 'Field statements hanya untuk soal Benar/Salah');
  }
  if (result.question_type === 'true_false' && currentQuestionType !== 'true_false' && body.statements === undefined) {
    throw new ApiError('VALIDATION_ERROR', 'Perubahan ke Benar/Salah wajib menyertakan statements');
  }

  const wantsContent = body.statements !== undefined
    || body.options !== undefined
    || body.correct_keys !== undefined
    || body.correct_key !== undefined
    || body.answer_text !== undefined
    || body.explanation !== undefined;

  if (body.statements !== undefined) {
    result.statements = normalizeStatements(body.statements, questionType);
  }
  if (body.options !== undefined) {
    result.options = normalizeOptions(body.options, questionType);
  }

  if (wantsContent) {
    const hasKeysPayload = !isTrueFalse && (body.options !== undefined
      || body.correct_keys !== undefined
      || body.correct_key !== undefined);

    if (hasKeysPayload) {
      const declaredKeys = body.correct_keys !== undefined
        ? normalizeCorrectKeys(body.correct_keys, 'correct_keys')
        : body.correct_key !== undefined
          ? normalizeCorrectKeys(body.correct_key, 'correct_key')
          : [];
      const correctKeys = declaredKeys.length
        ? declaredKeys
        : (result.options ?? []).filter((option) => option.is_correct).map((option) => option.key);

      if (result.options !== undefined) {
        for (const key of correctKeys) {
          if (!result.options.some((option) => option.key === key)) {
            throw new ApiError('VALIDATION_ERROR', `Kunci jawaban ${key} tidak sesuai opsi mana pun`);
          }
        }
      }
      if (questionType === 'multiple_choice' && correctKeys.length !== 1) {
        throw new ApiError('VALIDATION_ERROR', 'Harus tepat satu opsi yang benar');
      }
      if (CHOICE_TYPES.includes(questionType) && correctKeys.length === 0) {
        throw new ApiError('VALIDATION_ERROR', 'Harus ada kunci jawaban benar');
      }
      result.options = (result.options ?? []).map((option) => ({
        ...option,
        is_correct: correctKeys.includes(option.key)
      }));
      result.correct_keys = correctKeys;
    }

    if (body.answer_text !== undefined) {
      const answerText = body.answer_text ? requireText(body.answer_text, 'answer_text') : null;
      if ((questionType === 'essay' || questionType === 'short_answer') && !answerText) {
        throw new ApiError('VALIDATION_ERROR', 'answer_text wajib untuk soal esai/short answer');
      }
      result.answer_text = answerText;
    }
    if (body.explanation !== undefined) {
      result.explanation = body.explanation ?? null;
    }
  }

  if (Object.keys(result).length === 0) {
    throw new ApiError('VALIDATION_ERROR', 'Tidak ada field yang diubah');
  }
  return result;
}

export function validateAnswerKey(body) {
  if (!body || typeof body !== 'object') {
    throw new ApiError('VALIDATION_ERROR', 'Body harus berupa objek');
  }
  const correctKeys = body.correct_keys !== undefined
    ? normalizeCorrectKeys(body.correct_keys, 'correct_keys')
    : body.correct_key
      ? normalizeCorrectKeys(body.correct_key, 'correct_key')
      : [];
  const answerText = body.answer_text ? requireText(body.answer_text, 'answer_text') : null;
  if (correctKeys.length === 0 && !answerText) {
    throw new ApiError('VALIDATION_ERROR', 'correct_key/correct_keys atau answer_text wajib diisi');
  }
  return {
    correct_keys: correctKeys,
    correct_key: correctKeys[0] ?? null,
    answer_text: answerText,
    explanation: body.explanation ?? null
  };
}
