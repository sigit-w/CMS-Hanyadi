import { useCallback, useEffect, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { deleteQuestion, getMapels, getQuestion, getQuestions, updateQuestion } from '../api.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { SelectNative } from '@/components/ui/select-native';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog } from '@/components/ui/dialog';

const STATUS_LABELS = { approved: 'Disetujui', archived: 'Diarsipkan' };
const QUESTION_TYPE_LABELS = {
  multiple_choice: 'Pilihan ganda',
  true_false: 'Benar/Salah',
  multiple_answer: 'Pilihan ganda multi-jawaban',
  short_answer: 'Jawaban singkat',
  essay: 'Esai'
};
const INITIAL_FILTERS = { mapel: '', status: 'approved', search: '', question_type: '' };
const PAGE_SIZE = 20;
const CHOICE_TYPES = ['multiple_choice', 'multiple_answer'];
const DEFAULT_STATEMENTS = [
  { text: '', is_correct: true },
  { text: '', is_correct: false }
];

function defaultOptions() {
  return ['A', 'B', 'C', 'D'].map((key) => ({ key, content: '', is_correct: key === 'A' }));
}

function toEditForm(question) {
  const options = (question.options ?? []).map((option) => ({
    key: option.option_key,
    content: option.content,
    is_correct: Boolean(option.is_correct)
  }));
  const correctKeys = options.filter((option) => option.is_correct).map((option) => option.key);
  return {
    stem: question.stem ?? '',
    mapel: question.mapel_code ?? '',
    question_type: question.question_type ?? 'multiple_choice',
    difficulty: question.difficulty ?? 'medium',
    options: options.length ? options : defaultOptions(),
    statements: (question.statements ?? []).map((statement) => ({
      text: statement.text ?? statement.statement_text ?? '',
      is_correct: Boolean(statement.is_correct)
    })),
    correct_keys: correctKeys,
    correct_key: correctKeys[0] ?? 'A',
    answer_text: question.answer_key?.answer_text ?? '',
    explanation: question.answer_key?.explanation ?? ''
  };
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('id-ID');
}

export default function Dashboard({ can, refreshKey = 0 }) {
  const [mapels, setMapels] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [pagination, setPagination] = useState({ total: 0 });
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailNotice, setDetailNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editImage, setEditImage] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const refreshQuestions = useCallback(async (nextFilters, nextPage) => {
    const data = await getQuestions({ ...nextFilters, page: nextPage, limit: PAGE_SIZE });
    setQuestions(data.questions ?? []);
    setPagination(data.pagination ?? { total: 0 });
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const mapelData = await getMapels();
        if (!active) return;
        setMapels(mapelData.mapels ?? []);
        await refreshQuestions(INITIAL_FILTERS, 1);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [refreshQuestions]);

  useEffect(() => {
    if (refreshKey === 0) return;
    setPage(1);
    setError('');
    setLoading(true);
    refreshQuestions(filters, 1)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  function applyFilter(patch) {
    const next = { ...filters, ...patch };
    setFilters(next);
    setPage(1);
    setError('');
    setLoading(true);
    refreshQuestions(next, 1)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function goToPage(nextPage) {
    setPage(nextPage);
    setError('');
    setLoading(true);
    refreshQuestions(filters, nextPage)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function handleDelete(question) {
    if (!window.confirm(`Hapus soal #${question.id}? Soal akan diarsipkan dan tidak tampil di daftar aktif.`)) return;
    setError(''); setNotice(''); setDeletingId(question.id);
    try {
      await deleteQuestion(question.id);
      setNotice(`Soal #${question.id} berhasil dihapus dari daftar aktif.`);
      const targetPage = questions.length === 1 && page > 1 ? page - 1 : page;
      setPage(targetPage);
      await refreshQuestions(filters, targetPage);
    } catch (err) { setError(err.message); }
    finally { setDeletingId(null); }
  }

  async function openDetail(question) {
    setDetail({ ...question, options: [], answer_key: null });
    setDetailError('');
    setDetailNotice('');
    setEditing(false);
    setEditForm(null);
    setEditImage(null);
    setEditError('');
    setDetailLoading(true);
    try {
      const data = await getQuestion(question.id);
      setDetail(data);
      setEditForm(toEditForm(data));
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetail(null);
    setDetailError('');
    setDetailNotice('');
    setEditing(false);
    setEditForm(null);
    setEditImage(null);
    setEditError('');
  }

  function updateEditForm(patch) {
    setEditForm((current) => ({ ...current, ...patch }));
  }

  function handleEditTypeChange(questionType) {
    setEditForm((current) => {
      const isChoice = CHOICE_TYPES.includes(questionType);
      const keys = isChoice ? (current.correct_keys.length ? current.correct_keys : ['A']) : [];
      const statements = questionType === 'true_false' && current.statements.length === 0
        ? DEFAULT_STATEMENTS.map((statement) => ({ ...statement }))
        : current.statements;
      return {
        ...current,
        question_type: questionType,
        options: isChoice ? (current.options.length ? current.options : defaultOptions()) : [],
        statements,
        correct_keys: keys,
        correct_key: keys[0] ?? null
      };
    });
  }

  function toggleCorrectKey(key) {
    setEditForm((current) => {
      if (current.question_type !== 'multiple_answer') {
        return { ...current, correct_keys: [key], correct_key: key };
      }
      const next = current.correct_keys.includes(key)
        ? current.correct_keys.filter((item) => item !== key)
        : [...current.correct_keys, key];
      return { ...current, correct_keys: next, correct_key: next[0] ?? null };
    });
  }

  async function handleSaveEdit(event) {
    event.preventDefault();
    if (!detail || !editForm) return;
    setEditError(''); setDetailNotice(''); setEditSaving(true);
    try {
      if (!editForm.mapel) { setEditError('Pilih mapel terlebih dahulu'); return; }
      const isChoice = CHOICE_TYPES.includes(editForm.question_type);
      const isTrueFalse = editForm.question_type === 'true_false';
      let options = [];
      let correctKeys = [];
      let statements = [];
      if (isTrueFalse) {
        statements = editForm.statements.map((statement) => ({ text: statement.text.trim(), is_correct: Boolean(statement.is_correct) }));
        if (statements.length < 1 || statements.length > 5) { setEditError('Jumlah pernyataan harus 1–5'); return; }
        if (statements.some((statement) => !statement.text)) { setEditError('Isi seluruh teks pernyataan'); return; }
        if (!statements.some((statement) => statement.is_correct)) { setEditError('Pilih minimal satu pernyataan yang benar'); return; }
      }
      if (isChoice) {
        options = editForm.options.filter((option) => option.content.trim());
        if (options.length < 2) { setEditError('Isi minimal dua opsi jawaban'); return; }
        const availableKeys = options.map((option) => option.key);
        correctKeys = editForm.correct_keys.filter((key) => availableKeys.includes(key));
        if (editForm.question_type === 'multiple_answer') {
          if (correctKeys.length < 1) { setEditError('Pilih minimal satu kunci jawaban benar'); return; }
        } else {
          correctKeys = correctKeys.length ? correctKeys.slice(0, 1) : [availableKeys[0]];
        }
      }
      await updateQuestion(detail.id, {
        stem: editForm.stem,
        mapel: editForm.mapel,
        question_type: editForm.question_type,
        difficulty: editForm.difficulty,
        options: isChoice
          ? options.map((option) => ({ key: option.key, content: option.content, is_correct: correctKeys.includes(option.key) }))
          : [],
        statements,
        correct_keys: correctKeys,
        answer_text: isChoice || isTrueFalse ? null : editForm.answer_text || null,
        explanation: editForm.explanation || null
      }, editImage);
      const data = await getQuestion(detail.id);
      setDetail(data);
      setEditForm(toEditForm(data));
      setEditImage(null);
      setEditing(false);
      const mapelChanged = Boolean(filters.mapel) && filters.mapel !== editForm.mapel;
      const nextFilters = mapelChanged ? { ...filters, mapel: editForm.mapel } : filters;
      const nextPage = mapelChanged ? 1 : page;
      if (mapelChanged) {
        setFilters(nextFilters);
        setPage(nextPage);
      }
      setDetailNotice(mapelChanged
        ? `Perubahan soal berhasil disimpan. Filter mapel disesuaikan ke ${mapels.find((item) => item.code === editForm.mapel)?.name ?? editForm.mapel}.`
        : 'Perubahan soal berhasil disimpan.');
      await refreshQuestions(nextFilters, nextPage);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  const total = pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const editIsChoice = editForm ? CHOICE_TYPES.includes(editForm.question_type) : false;
  const editIsTrueFalse = editForm?.question_type === 'true_false';
  const editIsMultiple = editForm?.question_type === 'multiple_answer';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Daftar Soal</h1>
        <p className="text-sm text-muted-foreground">Kelola bank soal; soal baru langsung disetujui dan tampil di tryout.</p>
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {can('questions.read') && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Filter</CardTitle>
            <CardDescription>Persempit daftar soal berdasarkan mapel, tipe soal, status, dan kata kunci.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2"><Label>Mapel</Label>
                <SelectNative value={filters.mapel} onChange={(e) => applyFilter({ mapel: e.target.value })}>
                  <option value="">Semua mapel</option>
                  {mapels.map((m) => <option key={m.id} value={m.code}>{m.name}</option>)}
                </SelectNative>
              </div>
              <div className="space-y-2"><Label>Tipe soal</Label>
                <SelectNative value={filters.question_type} onChange={(e) => applyFilter({ question_type: e.target.value })}>
                  <option value="">Semua tipe</option>
                  {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </SelectNative>
              </div>
              <div className="space-y-2"><Label>Status</Label>
                <SelectNative value={filters.status} onChange={(e) => applyFilter({ status: e.target.value })}>
                  <option value="approved">Disetujui (aktif)</option>
                  <option value="archived">Diarsipkan</option>
                </SelectNative>
              </div>
              <div className="space-y-2"><Label>Cari</Label>
                <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8" value={filters.search} placeholder="Kata kunci soal" onChange={(e) => applyFilter({ search: e.target.value })} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {can('questions.read') && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <div><CardTitle className="text-base">Bank Soal</CardTitle><CardDescription>{total} soal ditemukan</CardDescription></div>
            <Badge variant="secondary">{total}</Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : questions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                <p className="text-sm font-medium">Belum ada soal</p>
                <p className="text-sm text-muted-foreground">Ubah filter atau tambahkan lewat form Buat Soal di atas ini.</p>
              </div>
            ) : (
              <ul className="m-0 list-none divide-y rounded-md border p-0">
                {questions.map((question) => (
                  <li key={question.id} className="cursor-pointer p-4 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    tabIndex={0} onClick={() => openDetail(question)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openDetail(question);
                      }
                    }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-muted-foreground">#{question.id}</span>
                          <Badge variant="outline">{question.mapel_name ?? question.mapel_code ?? '—'}</Badge>
                          <Badge variant="secondary" className="capitalize">{STATUS_LABELS[question.status] ?? question.status}</Badge>
                        </div>
                        <p className="text-sm leading-snug line-clamp-2">{question.stem}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {QUESTION_TYPE_LABELS[question.question_type] ?? question.question_type} · {question.difficulty} · kunci: {question.has_answer_key ? 'ada' : 'belum'} · sumber: {question.source_type ?? 'manual'} · pemakaian: {question.usage_count ?? 0} lembar aktif
                        </p>
                        {(question.sheets ?? []).length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Lembar: {question.sheets.map((sheet) => sheet.code).join(', ')}
                          </p>
                        )}
                      </div>
                      {can('questions.write') && (
                        <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive"
                          disabled={deletingId === question.id}
                          onClick={(event) => { event.stopPropagation(); handleDelete(question); }}
                          onKeyDown={(event) => event.stopPropagation()}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
              <span className="text-xs text-muted-foreground">Halaman {currentPage} dari {totalPages}</span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={loading || currentPage <= 1}
                  onClick={() => goToPage(currentPage - 1)}>Prev</Button>
                <Button type="button" variant="outline" size="sm" disabled={loading || currentPage >= totalPages}
                  onClick={() => goToPage(currentPage + 1)}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(detail)} onClose={closeDetail} title={`${editing ? 'Edit' : 'Detail'} Soal #${detail?.id ?? ''}`}>
        {detailLoading && (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        )}
        {detailError && <Alert variant="destructive">{detailError}</Alert>}
        {detailNotice && <Alert variant="success">{detailNotice}</Alert>}

        {detail && !detailLoading && !editing && (
          <div className="space-y-5">
            {can('questions.write') && (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => {
                  setEditForm(toEditForm(detail));
                  setEditImage(null);
                  setEditError('');
                  setEditing(true);
                }}>Edit soal</Button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{detail.mapel_name ?? detail.mapel_code ?? '—'}</Badge>
              <Badge variant="secondary">{STATUS_LABELS[detail.status] ?? detail.status}</Badge>
              <span className="text-xs text-muted-foreground">{QUESTION_TYPE_LABELS[detail.question_type] ?? detail.question_type} · {detail.difficulty}</span>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Pertanyaan</div>
              <p className="whitespace-pre-wrap text-sm font-normal leading-relaxed">{detail.stem}</p>
            </div>
            {detail.image_url && (
              <img src={detail.image_url} alt="Gambar soal" className="max-h-72 rounded-md border object-contain" />
            )}
            {detail.options?.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">Pilihan jawaban</div>
                <ul className="space-y-2">
                  {detail.options.map((option) => (
                    <li key={option.id} className={`flex gap-3 rounded-md border p-3 text-sm ${option.is_correct ? 'border-primary bg-primary/5' : ''}`}>
                      <span className="font-mono text-xs text-muted-foreground">{option.option_key}</span>
                      <span className="whitespace-pre-wrap font-normal">{option.content}</span>
                      {option.is_correct && <Badge variant="secondary" className="ml-auto">Kunci</Badge>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(detail.answer_key?.answer_text || detail.answer_key?.explanation) && (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <div className="text-xs font-medium text-muted-foreground">Kunci &amp; pembahasan</div>
                {detail.answer_key.answer_text && (
                  <p className="whitespace-pre-wrap text-sm font-normal">{detail.answer_key.answer_text}</p>
                )}
                {detail.answer_key.explanation && (
                  <p className="whitespace-pre-wrap text-sm font-normal text-muted-foreground">{detail.answer_key.explanation}</p>
                )}
              </div>
            )}
            <div className="border-t pt-3 text-xs text-muted-foreground">
              Sumber: {detail.source_label ?? detail.source_type ?? 'manual'} · Dibuat {formatDate(detail.created_at)} · Diperbarui {formatDate(detail.updated_at)}
            </div>
          </div>
        )}

        {detail && editForm && !detailLoading && editing && (
          <form className="space-y-5" onSubmit={handleSaveEdit}>
            {editError && <Alert variant="destructive">{editError}</Alert>}
            <div className="space-y-2">
              <Label>Pertanyaan</Label>
              <Textarea rows="4" value={editForm.stem}
                onChange={(event) => updateEditForm({ stem: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Gambar soal</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Label className="inline-flex cursor-pointer items-center rounded-md border bg-background px-3 py-2 text-xs font-medium shadow-sm hover:bg-accent"
                  htmlFor="edit-question-image">Ganti gambar</Label>
                <input id="edit-question-image" className="sr-only" type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => setEditImage(event.target.files?.[0] ?? null)} />
                <span className="text-xs text-muted-foreground">{editImage ? editImage.name : 'Biarkan kosong untuk mempertahankan gambar lama'}</span>
              </div>
              {detail.image_url && !editImage && (
                <img src={detail.image_url} alt="Gambar soal saat ini" className="max-h-48 rounded-md border object-contain" />
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2"><Label>Mapel</Label>
                <SelectNative value={editForm.mapel} onChange={(event) => updateEditForm({ mapel: event.target.value })}>
                  <option value="">Pilih mapel</option>
                  {mapels.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                </SelectNative>
                {mapels.length === 0 && <p className="text-xs text-muted-foreground">Belum ada mapel tersedia di tabel mapel.</p>}
              </div>
              <div className="space-y-2"><Label>Tipe</Label>
                <SelectNative value={editForm.question_type} onChange={(event) => handleEditTypeChange(event.target.value)}>
                  <option value="multiple_choice">Pilihan ganda</option>
                  <option value="true_false">Benar/Salah</option>
                  <option value="multiple_answer">Pilihan ganda multi-jawaban</option>
                  <option value="short_answer">Jawaban singkat</option>
                  <option value="essay">Esai</option>
                </SelectNative>
              </div>
              <div className="space-y-2"><Label>Kesulitan</Label>
                <SelectNative value={editForm.difficulty} onChange={(event) => updateEditForm({ difficulty: event.target.value })}>
                  <option value="easy">Mudah</option>
                  <option value="medium">Sedang</option>
                  <option value="hard">Sulit</option>
                </SelectNative>
              </div>
            </div>
            {editIsChoice && (
              <div className="space-y-3 rounded-lg border p-4">
                <Label className="text-sm font-semibold">Opsi Jawaban</Label>
                {editForm.options.map((option, index) => (
                  <div className="flex items-center gap-3" key={option.key}>
                    <label className="flex w-14 items-center gap-2 text-sm font-medium">
                      <input type={editIsMultiple ? 'checkbox' : 'radio'}
                        checked={editIsMultiple ? editForm.correct_keys.includes(option.key) : editForm.correct_key === option.key}
                        onChange={() => toggleCorrectKey(option.key)} className="accent-primary" />{option.key}
                    </label>
                    <Input value={option.content} placeholder={`Isi opsi ${option.key}`}
                      onChange={(event) => setEditForm((current) => ({
                        ...current,
                        options: current.options.map((item, i) => i === index ? { ...item, content: event.target.value } : item)
                      }))} />
                  </div>
                ))}
              </div>
            )}
            {editIsTrueFalse && (
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Pernyataan Benar/Salah</Label>
                  <span className="text-xs text-muted-foreground">{editForm.statements.length}/5 pernyataan</span>
                </div>
                {editForm.statements.map((statement, index) => (
                  <div className="space-y-2 rounded-md border p-3" key={index}>
                    <div className="flex items-center justify-between gap-3">
                      <Label>Pernyataan {index + 1}</Label>
                      <Button type="button" variant="ghost" size="sm"
                        disabled={editForm.statements.length <= 1}
                        onClick={() => updateEditForm({
                          statements: editForm.statements.filter((_, i) => i !== index)
                        })}>Hapus</Button>
                    </div>
                    <Textarea rows="2" value={statement.text}
                      onChange={(event) => updateEditForm({
                        statements: editForm.statements.map((item, i) => i === index ? { ...item, text: event.target.value } : item)
                      })} />
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name={`edit-statement-${index}`} className="accent-primary"
                          checked={statement.is_correct}
                          onChange={() => updateEditForm({
                            statements: editForm.statements.map((item, i) => i === index ? { ...item, is_correct: true } : item)
                          })} />Benar
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name={`edit-statement-${index}`} className="accent-primary"
                          checked={!statement.is_correct}
                          onChange={() => updateEditForm({
                            statements: editForm.statements.map((item, i) => i === index ? { ...item, is_correct: false } : item)
                          })} />Salah
                      </label>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm"
                  disabled={editForm.statements.length >= 5}
                  onClick={() => updateEditForm({
                    statements: editForm.statements.length >= 5
                      ? editForm.statements
                      : [...editForm.statements, { text: '', is_correct: true }]
                  })}>Tambah Pernyataan</Button>
              </div>
            )}
            {!editIsChoice && !editIsTrueFalse && (
              <div className="space-y-2"><Label>Kunci / Jawaban Teks</Label>
                <Textarea rows="2" value={editForm.answer_text}
                  onChange={(event) => updateEditForm({ answer_text: event.target.value })} />
              </div>
            )}
            <div className="space-y-2"><Label>Pembahasan (opsional)</Label>
              <Textarea rows="2" value={editForm.explanation}
                onChange={(event) => updateEditForm({ explanation: event.target.value })} />
            </div>
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" disabled={editSaving}
                onClick={() => { setEditing(false); setEditError(''); }}>Batal</Button>
              <Button type="submit" disabled={editSaving}>{editSaving ? 'Menyimpan…' : 'Simpan Perubahan'}</Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
