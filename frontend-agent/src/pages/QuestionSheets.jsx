import { useEffect, useState } from 'react';
import {
  createQuestionSheet,
  deleteQuestionSheet,
  getJenjangs,
  getMapels,
  getQuestion,
  getQuestionSheet,
  getQuestionSheetCode,
  getQuestionSheetPicker,
  getQuestionSheets,
  updateQuestionSheet
} from '../api.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { SelectNative } from '@/components/ui/select-native';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog } from '@/components/ui/dialog';

const EMPTY_FORM = { name: '', jenjang: '', mapel_code: '', code: '', description: '', duration_minutes: 60 };
const CODE_PATTERN = /^LS-[A-Z0-9]{4}-(SD|SMP|SMA)-[0-9]{4}$/;
const PAGE_SIZE = 20;
const DETAIL_BATCH_SIZE = 5;

async function loadQuestions(ids) {
  const result = [];
  for (let index = 0; index < ids.length; index += DETAIL_BATCH_SIZE) {
    const batch = ids.slice(index, index + DETAIL_BATCH_SIZE);
    const rows = await Promise.all(batch.map((id) => getQuestion(id)));
    result.push(...rows);
  }
  return result;
}

function jenjangLabel(item) {
  return [item?.jenjang_kode, item?.jenjang_nama].filter(Boolean).join(' — ') || '—';
}

const QUESTION_TYPE_LABELS = {
  multiple_choice: 'Pilihan ganda',
  true_false: 'Benar/Salah',
  multiple_answer: 'Pilihan ganda multi-jawaban',
  short_answer: 'Jawaban singkat',
  essay: 'Esai'
};

export default function QuestionSheets() {
  const [sheets, setSheets] = useState([]);
  const [sheetPage, setSheetPage] = useState(1);
  const [sheetPagination, setSheetPagination] = useState({ total: 0 });
  const [mapels, setMapels] = useState([]);
  const [jenjangs, setJenjangs] = useState([]);
  const [status, setStatus] = useState('active');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [picker, setPicker] = useState([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerQuestionType, setPickerQuestionType] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [sheetDetail, setSheetDetail] = useState(null);
  const [sheetDetailLoading, setSheetDetailLoading] = useState(false);
  const [sheetDetailError, setSheetDetailError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadSheets(nextPage = sheetPage, allowBacktrack = false) {
    let page = nextPage;
    let data = await getQuestionSheets({ status, page, limit: PAGE_SIZE });
    if (allowBacktrack && (data.sheets ?? []).length === 0 && page > 1) {
      page -= 1;
      data = await getQuestionSheets({ status, page, limit: PAGE_SIZE });
    }
    setSheets(data.sheets ?? []);
    setSheetPagination(data.pagination ?? { total: 0 });
    setSheetPage(page);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [mapelData, jenjangData] = await Promise.all([getMapels(), getJenjangs()]);
        if (!active) return;
        setMapels(mapelData.mapels ?? []);
        setJenjangs(jenjangData.jenjangs ?? []);
      } catch (err) {
        if (active) setError(err.message);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setError('');
    setNotice('');
    setSheetPage(1);
    loadSheets(1).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [status]);

  useEffect(() => {
    let active = true;
    if (!form.jenjang || !form.mapel_code) {
      setPicker([]);
      setPickerLoading(false);
      return () => { active = false; };
    }
    setPickerLoading(true);
    getQuestionSheetPicker({
      jenjang: form.jenjang,
      mapel: form.mapel_code,
      search: pickerSearch,
      question_type: pickerQuestionType,
      limit: 50
    })
      .then((data) => { if (active) setPicker(data.questions ?? []); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setPickerLoading(false); });
    return () => { active = false; };
  }, [form.jenjang, form.mapel_code, pickerSearch, pickerQuestionType]);

  async function run(action, message) {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await action();
      await loadSheets(sheetPage, true);
      setNotice(message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setSelectedQuestions([]);
    setPickerSearch('');
    setPickerQuestionType('');
    setEditingId(null);
    setPicker([]);
  }

  function startCreate() {
    resetForm();
    setError('');
    setNotice('');
  }

  async function refreshCode(jenjang, mapelCode) {
    if (!jenjang || !mapelCode) return;
    try {
      const data = await getQuestionSheetCode(mapelCode, jenjang);
      setForm((current) => (
        current.jenjang === jenjang && current.mapel_code === mapelCode
          ? { ...current, code: data.code }
          : current
      ));
    } catch (err) {
      setError(err.message);
    }
  }

  function handleJenjangChange(event) {
    const jenjang = event.target.value;
    setForm((current) => ({ ...current, jenjang, code: '' }));
    setSelectedQuestions([]);
    setPickerSearch('');
    setPickerQuestionType('');
    setError('');
    refreshCode(jenjang, form.mapel_code);
  }

  function handleMapelChange(event) {
    const mapelCode = event.target.value;
    setForm((current) => ({ ...current, mapel_code: mapelCode, code: '' }));
    setSelectedQuestions([]);
    setPickerSearch('');
    setPickerQuestionType('');
    setError('');
    refreshCode(form.jenjang, mapelCode);
  }

  async function startEdit(sheet) {
    try {
      const detailSheet = await getQuestionSheet(sheet.id);
      const questions = await loadQuestions(detailSheet.sheet.question_ids ?? []);
      setForm({
        name: detailSheet.sheet.name,
        jenjang: detailSheet.sheet.jenjang_kode ?? '',
        mapel_code: detailSheet.sheet.mapel_code,
        code: detailSheet.sheet.code,
        description: detailSheet.sheet.description ?? '',
        duration_minutes: detailSheet.sheet.duration_minutes
      });
      setSelectedQuestions(questions);
      setPickerSearch('');
      setPickerQuestionType('');
      setEditingId(sheet.id);
      setError('');
      setNotice('');
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleQuestion(question) {
    setError('');
    const exists = selectedQuestions.some((item) => item.id === question.id);
    if (exists) {
      setSelectedQuestions(selectedQuestions.filter((item) => item.id !== question.id));
      return;
    }
    if ((question.jenjang_kode ?? question.jenjang) !== form.jenjang) {
      setError('Soal yang dipilih harus berjenjang sama dengan lembar soal.');
      return;
    }
    if (question.mapel_code !== form.mapel_code) {
      setError('Semua soal dalam satu lembar harus dari mapel yang dipilih.');
      return;
    }
    setSelectedQuestions([...selectedQuestions, question]);
  }

  async function openDetail(question) {
    setDetail({ ...question, options: [], answer_key: null });
    setDetailError('');
    setDetailLoading(true);
    try {
      setDetail(await getQuestion(question.id));
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function openSheetDetail(sheet) {
    setSheetDetail({ ...sheet, questions: [] });
    setSheetDetailError('');
    setSheetDetailLoading(true);
    try {
      const detailSheet = await getQuestionSheet(sheet.id);
      const questions = await loadQuestions(detailSheet.sheet.question_ids ?? []);
      setSheetDetail({ ...sheet, questions });
    } catch (err) {
      setSheetDetailError(err.message);
    } finally {
      setSheetDetailLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.jenjang) {
      setError('Pilih jenjang terlebih dahulu.');
      return;
    }
    if (!form.mapel_code) {
      setError('Pilih mapel terlebih dahulu.');
      return;
    }
    if (!CODE_PATTERN.test(form.code)) {
      setError('Kode lembar soal harus berformat LS-<mapel 4 karakter>-<SD|SMP|SMA>-<mmyy>, contoh LS-MTKA-SD-1126.');
      return;
    }
    const minutes = Number(form.duration_minutes);
    if (!Number.isSafeInteger(minutes) || minutes < 1) {
      setError('Waktu pengerjaan harus bilangan bulat positif.');
      return;
    }
    if (selectedQuestions.length === 0) {
      setError('Pilih minimal satu soal.');
      return;
    }
    const payload = {
      name: form.name,
      jenjang: form.jenjang,
      jenjang_code: form.jenjang,
      mapel_code: form.mapel_code,
      code: form.code,
      description: form.description,
      duration_minutes: minutes,
      question_ids: selectedQuestions.map((question) => question.id)
    };
    const wasEditing = Boolean(editingId);
    const message = wasEditing ? 'Lembar soal diperbarui' : 'Lembar soal dibuat';
    await run(async () => {
      if (wasEditing) await updateQuestionSheet(editingId, payload);
      else await createQuestionSheet(payload);
      resetForm();
    }, message);
  }

  async function handleArchive(sheet) {
    if (!window.confirm(`Arsipkan lembar soal "${sheet.name}"? Relasi soal tetap tersimpan.`)) return;
    await run(() => deleteQuestionSheet(sheet.id), `Lembar soal ${sheet.name} diarsipkan`);
  }

  const sheetTotal = sheetPagination.total ?? 0;
  const totalSheetPages = Math.max(1, Math.ceil(sheetTotal / PAGE_SIZE));
  const currentSheetPage = Math.min(Math.max(sheetPage, 1), totalSheetPages);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lembar Soal</h1>
        <p className="text-sm text-muted-foreground">
          Isi nama, pilih jenjang, pilih mapel, gunakan kode otomatis yang bisa diubah, lalu pilih soal sesuai jenjang dan mapel. Klik baris soal untuk melihat detail.
        </p>
      </div>
      {error && <Alert variant="destructive">Error: {error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>{editingId ? 'Ubah Lembar Soal' : 'Lembar Soal Baru'}</CardTitle>
            <CardDescription>Kode otomatis berformat LS-[mapel]-[jenjang]-[mmyy], contoh LS-MTKA-SD-1126.</CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={startCreate}>Kosongkan Form</Button>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sheet-name">Nama Lembar Soal</Label>
                <Input id="sheet-name" required maxLength={128} placeholder="Contoh: Tryout Matematika Genap"
                  value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sheet-jenjang">Jenjang</Label>
                <SelectNative id="sheet-jenjang" required value={form.jenjang} onChange={handleJenjangChange}>
                  <option value="">Pilih jenjang terlebih dahulu</option>
                  {jenjangs.map((jenjang) => <option key={jenjang.id} value={jenjang.kode}>{jenjang.kode}</option>)}
                </SelectNative>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sheet-mapel">Mapel</Label>
                <SelectNative id="sheet-mapel" required value={form.mapel_code} onChange={handleMapelChange}>
                  <option value="">Pilih mapel terlebih dahulu</option>
                  {mapels.map((mapel) => <option key={mapel.id} value={mapel.code}>{mapel.name}</option>)}
                </SelectNative>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sheet-code">Kode Lembar Soal</Label>
                <Input id="sheet-code" required maxLength={16} pattern="LS-[A-Z0-9]{4}-(SD|SMP|SMA)-[0-9]{4}" className="font-mono"
                  placeholder="Otomatis setelah jenjang dan mapel dipilih"
                  disabled={!form.jenjang || !form.mapel_code}
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} />
                <p className="text-xs text-muted-foreground">Kode generation mengikuti jenjang dan mapel; contoh LS-MTKA-SD-1126.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sheet-duration">Waktu Pengerjaan (menit)</Label>
                <Input id="sheet-duration" required type="number" min="1" step="1"
                  value={form.duration_minutes}
                  onChange={(event) => setForm({ ...form, duration_minutes: event.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="sheet-description">Keterangan</Label>
                <Textarea id="sheet-description" maxLength={1000} rows={2} placeholder="Opsional"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </div>
            </div>

            <div className="space-y-3 rounded-md border p-4">
              {!form.jenjang || !form.mapel_code ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Pilih jenjang dan mapel terlebih dahulu untuk menampilkan soal.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[220px] flex-1 space-y-2">
                      <Label htmlFor="picker-search">Cari Soal pada Jenjang dan Mapel Ini</Label>
                      <Input id="picker-search" placeholder="Kata kunci pada teks soal"
                        value={pickerSearch} onChange={(event) => setPickerSearch(event.target.value)} />
                    </div>
                    <div className="min-w-[220px] space-y-2">
                      <Label htmlFor="picker-question-type">Tipe soal</Label>
                      <SelectNative id="picker-question-type" value={pickerQuestionType}
                        onChange={(event) => setPickerQuestionType(event.target.value)}>
                        <option value="">Semua tipe</option>
                        {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </SelectNative>
                    </div>
                    <Badge variant="secondary">{selectedQuestions.length} soal dipilih</Badge>
                  </div>

                  {selectedQuestions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedQuestions.map((question) => (
                        <Button key={question.id} type="button" size="sm" variant="outline"
                          onClick={() => toggleQuestion(question)}>
                          #{question.id} · {jenjangLabel(question)} · {question.mapel_code} · hapus
                        </Button>
                      ))}
                    </div>
                  )}

                  {pickerLoading ? (
                    <p className="text-sm text-muted-foreground">Memuat soal...</p>
                  ) : picker.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Tidak ada soal approved yang cocok pada jenjang dan mapel ini.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Soal</TableHead>
                          <TableHead>Tipe</TableHead>
                          <TableHead>Jenjang</TableHead>
                          <TableHead>Mapel</TableHead>
                          <TableHead>Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {picker.map((question) => (
                          <TableRow key={question.id} className="cursor-pointer" onClick={() => openDetail(question)}>
                            <TableCell className="max-w-[420px] truncate text-sm">{question.stem}</TableCell>
                            <TableCell className="text-xs">{QUESTION_TYPE_LABELS[question.question_type] ?? question.question_type}</TableCell>
                            <TableCell className="text-xs">{jenjangLabel(question)}</TableCell>
                            <TableCell className="text-xs">{question.mapel_code}</TableCell>
                            <TableCell>
                              <Button type="button" size="sm" variant="outline"
                                onClick={(event) => { event.stopPropagation(); toggleQuestion(question); }}>
                                {selectedQuestions.some((item) => item.id === question.id) ? 'Hapus' : 'Pilih'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{editingId ? 'Simpan Perubahan' : 'Buat Lembar Soal'}</Button>
              {editingId && <Button type="button" variant="outline" onClick={startCreate}>Batal Edit</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Daftar Lembar Soal</CardTitle>
            <CardDescription>{sheetTotal} lembar ditemukan · {PAGE_SIZE} per halaman. Klik baris untuk melihat soal yang dipilih.</CardDescription>
          </div>
          <SelectNative value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="active">Aktif</option>
            <option value="archived">Arsip</option>
          </SelectNative>
        </CardHeader>
        <CardContent>
          {sheets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada lembar soal pada filter ini.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Jenjang</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Mapel</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Soal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheets.map((sheet) => (
                  <TableRow key={sheet.id} className="cursor-pointer" onClick={() => openSheetDetail(sheet)}>
                    <TableCell>{sheet.name}</TableCell>
                    <TableCell>{jenjangLabel(sheet)}</TableCell>
                    <TableCell className="font-mono text-xs">{sheet.code}</TableCell>
                    <TableCell>{sheet.mapel_name}</TableCell>
                    <TableCell>{sheet.duration_minutes} menit</TableCell>
                    <TableCell>{sheet.question_count}</TableCell>
                    <TableCell>
                      <Badge variant={sheet.archived ? 'secondary' : 'default'}>
                        {sheet.archived ? 'Arsip' : 'Aktif'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline"
                          onClick={(event) => { event.stopPropagation(); startEdit(sheet); }}>Ubah</Button>
                        <Button type="button" size="sm" variant="destructive" disabled={sheet.archived || saving}
                          onClick={(event) => { event.stopPropagation(); handleArchive(sheet); }}>Arsipkan</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
            <span className="text-xs text-muted-foreground">Halaman {currentSheetPage} dari {totalSheetPages}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={currentSheetPage <= 1}
                onClick={() => loadSheets(currentSheetPage - 1).catch((err) => setError(err.message))}>Prev</Button>
              <Button type="button" variant="outline" size="sm" disabled={currentSheetPage >= totalSheetPages}
                onClick={() => loadSheets(currentSheetPage + 1).catch((err) => setError(err.message))}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} title={`Detail Soal #${detail?.id ?? ''}`}>
        {detailLoading && <p className="text-sm text-muted-foreground">Memuat detail soal...</p>}
        {detailError && <Alert variant="destructive">{detailError}</Alert>}
        {detail && !detailLoading && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{jenjangLabel(detail)}</Badge>
              <Badge variant="outline">{detail.mapel_name ?? detail.mapel_code}</Badge>
              <Badge variant="secondary">{QUESTION_TYPE_LABELS[detail.question_type] ?? detail.question_type}</Badge>
              <span className="text-xs text-muted-foreground">{detail.difficulty}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm font-normal leading-relaxed">{detail.stem}</p>
            {detail.image_url && (
              <img src={detail.image_url} alt="Gambar soal" className="max-h-72 rounded-md border object-contain" />
            )}
            {detail.options?.length > 0 && (
              <div className="space-y-2">
                {detail.options.map((option) => (
                  <div key={option.key ?? option.id} className="rounded-md border px-3 py-2 text-sm">
                    <span className="font-semibold">{option.key}. </span>{option.content}
                  </div>
                ))}
              </div>
            )}
            {detail.answer_key?.answer_text && (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Kunci jawaban</p>
                <p className="whitespace-pre-wrap text-sm font-normal">{detail.answer_key.answer_text}</p>
              </div>
            )}
            {detail.answer_key?.explanation && (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Pembahasan</p>
                <p className="whitespace-pre-wrap text-sm font-normal text-muted-foreground">{detail.answer_key.explanation}</p>
              </div>
            )}
          </div>
        )}
      </Dialog>

      <Dialog open={Boolean(sheetDetail)} onClose={() => setSheetDetail(null)} title={`Soal pada Lembar ${sheetDetail?.code ?? ''}`}>
        {sheetDetailLoading && <p className="text-sm text-muted-foreground">Memuat soal lembar...</p>}
        {sheetDetailError && <Alert variant="destructive">{sheetDetailError}</Alert>}
        {sheetDetail && !sheetDetailLoading && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{sheetDetail.name}</Badge>
              <Badge variant="outline">{jenjangLabel(sheetDetail)}</Badge>
              <Badge variant="secondary">{sheetDetail.mapel_name}</Badge>
              <span className="text-xs text-muted-foreground">{sheetDetail.questions.length} soal dipilih · {sheetDetail.duration_minutes} menit</span>
            </div>
            {sheetDetail.questions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada soal pada lembar ini.</p>
            ) : (
              <ol className="space-y-3">
                {sheetDetail.questions.map((question, index) => (
                  <li key={question.id} className="space-y-2 rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">#{index + 1} · {question.id}</span>
                      <Badge variant="outline">{QUESTION_TYPE_LABELS[question.question_type] ?? question.question_type}</Badge>
                      <span className="text-xs text-muted-foreground">{question.mapel_name ?? question.mapel_code}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm font-normal leading-relaxed">{question.stem}</p>
                    {question.image_url && (
                      <img src={question.image_url} alt="Gambar soal" loading="lazy" className="max-h-56 rounded-md border object-contain" />
                    )}
                    {question.options?.length > 0 && (
                      <div className="space-y-1">
                        {question.options.map((option) => (
                          <div key={option.id ?? option.option_key} className="text-sm">
                            <span className="font-semibold">{option.option_key ?? option.key}. </span>{option.content}
                          </div>
                        ))}
                      </div>
                    )}
                    {question.answer_key?.answer_text && (
                      <p className="text-xs text-muted-foreground">Kunci: {question.answer_key.answer_text}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
