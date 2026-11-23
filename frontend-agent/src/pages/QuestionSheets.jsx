import { useEffect, useState } from 'react';
import {
  createQuestionSheet,
  deleteQuestionSheet,
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

const EMPTY_FORM = { name: '', mapel_code: '', code: '', description: '', duration_minutes: 60 };
const CODE_PATTERN = /^[A-Z0-9-]{12}$/;
const QUESTION_TYPE_LABELS = {
  multiple_choice: 'Pilihan ganda',
  true_false: 'Benar/Salah',
  multiple_answer: 'Pilihan ganda multi-jawaban',
  short_answer: 'Jawaban singkat',
  essay: 'Esai'
};

export default function QuestionSheets() {
  const [sheets, setSheets] = useState([]);
  const [mapels, setMapels] = useState([]);
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
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadSheets() {
    const data = await getQuestionSheets({ status, limit: 100 });
    setSheets(data.sheets ?? []);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const mapelData = await getMapels();
        if (active) setMapels(mapelData.mapels ?? []);
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
    loadSheets().catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [status]);

  useEffect(() => {
    let active = true;
    if (!form.mapel_code) {
      setPicker([]);
      setPickerLoading(false);
      return () => { active = false; };
    }
    setPickerLoading(true);
    getQuestionSheetPicker({ mapel: form.mapel_code, search: pickerSearch, question_type: pickerQuestionType, limit: 50 })
      .then((data) => { if (active) setPicker(data.questions ?? []); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setPickerLoading(false); });
    return () => { active = false; };
  }, [form.mapel_code, pickerSearch, pickerQuestionType]);

  async function run(action, message) {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await action();
      await loadSheets();
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

  async function handleMapelChange(event) {
    const mapelCode = event.target.value;
    setForm((current) => ({ ...current, mapel_code: mapelCode, code: '' }));
    setSelectedQuestions([]);
    setPickerSearch('');
    setPickerQuestionType('');
    setError('');
    if (!mapelCode) return;
    try {
      const data = await getQuestionSheetCode(mapelCode);
      setForm((current) => current.mapel_code === mapelCode ? { ...current, code: data.code } : current);
    } catch (err) {
      setError(err.message);
    }
  }

  async function startEdit(sheet) {
    try {
      const detailSheet = await getQuestionSheet(sheet.id);
      const questions = await Promise.all(detailSheet.sheet.question_ids.map((id) => getQuestion(id)));
      setForm({
        name: detailSheet.sheet.name,
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

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.mapel_code) {
      setError('Pilih mapel terlebih dahulu.');
      return;
    }
    if (!CODE_PATTERN.test(form.code)) {
      setError('Kode lembar soal harus tepat 12 karakter A-Z, 0-9, atau tanda hubung.');
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lembar Soal</h1>
        <p className="text-sm text-muted-foreground">
          Isi nama, pilih mapel, gunakan kode otomatis yang bisa diubah, lalu pilih soal dari mapel tersebut. Klik baris soal untuk melihat detail.
        </p>
      </div>
      {error && <Alert variant="destructive">Error: {error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>{editingId ? 'Ubah Lembar Soal' : 'Lembar Soal Baru'}</CardTitle>
            <CardDescription>Kode 12 karakter termasuk tanda hubung; contoh LS-MTKA-1126.</CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={startCreate}>Kosongkan Form</Button>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sheet-name">1. Nama Lembar Soal</Label>
                <Input id="sheet-name" required maxLength={128} placeholder="Contoh: Tryout Matematika Genap"
                  value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sheet-mapel">2. Mapel</Label>
                <SelectNative id="sheet-mapel" required value={form.mapel_code} onChange={handleMapelChange}>
                  <option value="">Pilih mapel terlebih dahulu</option>
                  {mapels.map((mapel) => <option key={mapel.id} value={mapel.code}>{mapel.name}</option>)}
                </SelectNative>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sheet-code">3. Kode Lembar Soal</Label>
                <Input id="sheet-code" required maxLength={12} pattern="[A-Z0-9-]{12}" className="font-mono"
                  placeholder="Otomatis setelah mapel dipilih" disabled={!form.mapel_code}
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} />
                <p className="text-xs text-muted-foreground">Kode generation mengikuti mapel; tetap bisa diubah manual.</p>
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
              {!form.mapel_code ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Pilih mapel terlebih dahulu untuk menampilkan soal.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[220px] flex-1 space-y-2">
                      <Label htmlFor="picker-search">6. Cari Soal pada Mapel Ini</Label>
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
                          #{question.id} · {question.mapel_code} · hapus
                        </Button>
                      ))}
                    </div>
                  )}

                  {pickerLoading ? (
                    <p className="text-sm text-muted-foreground">Memuat soal...</p>
                  ) : picker.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Tidak ada soal approved yang cocok pada mapel ini.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Soal</TableHead>
                          <TableHead>Tipe</TableHead>
                          <TableHead>Mapel</TableHead>
                          <TableHead>Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {picker.map((question) => (
                          <TableRow key={question.id} className="cursor-pointer" onClick={() => openDetail(question)}>
                            <TableCell className="max-w-[420px] truncate text-sm">{question.stem}</TableCell>
                            <TableCell className="text-xs">{QUESTION_TYPE_LABELS[question.question_type] ?? question.question_type}</TableCell>
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
            <CardDescription>{sheets.length} lembar ditampilkan.</CardDescription>
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
                  <TableRow key={sheet.id}>
                    <TableCell>{sheet.name}</TableCell>
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
                        <Button type="button" size="sm" variant="outline" onClick={() => startEdit(sheet)}>Ubah</Button>
                        <Button type="button" size="sm" variant="destructive" disabled={sheet.archived || saving}
                          onClick={() => handleArchive(sheet)}>Arsipkan</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} title={`Detail Soal #${detail?.id ?? ''}`}>
        {detailLoading && <p className="text-sm text-muted-foreground">Memuat detail soal...</p>}
        {detailError && <Alert variant="destructive">{detailError}</Alert>}
        {detail && !detailLoading && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
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
    </div>
  );
}
