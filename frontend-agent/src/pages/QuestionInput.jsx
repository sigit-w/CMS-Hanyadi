import { useEffect, useState } from 'react';
import { createQuestion, getJenjangs, getMapels, importFile } from '../api.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { SelectNative } from '@/components/ui/select-native';
import { Separator } from '@/components/ui/separator';

const CHOICE_TYPES = ['multiple_choice', 'multiple_answer'];
const DEFAULT_STATEMENTS = [
  { text: '', is_correct: true },
  { text: '', is_correct: false }
];
const EMPTY_FORM = {
  stem: '', jenjang: '', mapel: '', question_type: 'multiple_choice', difficulty: 'medium',
  options: [{ key: 'A', content: '' }, { key: 'B', content: '' }, { key: 'C', content: '' }, { key: 'D', content: '' }],
  statements: DEFAULT_STATEMENTS.map((statement) => ({ ...statement })),
  correct_keys: ['A'], correct_key: 'A', answer_text: '', explanation: ''
};

export default function QuestionInput({ onCreated }) {
  const [mapels, setMapels] = useState([]);
  const [jenjangs, setJenjangs] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [sourceType, setSourceType] = useState('file_upload');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    Promise.all([getMapels(), getJenjangs()])
      .then(([mapelData, jenjangData]) => {
        setMapels(mapelData.mapels ?? []);
        setJenjangs(jenjangData.jenjangs ?? []);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!imageFile) { setImagePreview(''); return undefined; }
    const preview = URL.createObjectURL(imageFile);
    setImagePreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [imageFile]);

  const updateForm = (patch) => setForm((p) => ({ ...p, ...patch }));
  const updateOption = (index, content) => setForm((p) => ({ ...p, options: p.options.map((o, i) => i === index ? { ...o, content } : o) }));
  const updateStatement = (index, patch) => setForm((p) => ({
    ...p, statements: p.statements.map((s, i) => i === index ? { ...s, ...patch } : s)
  }));
  const addStatement = () => setForm((p) => p.statements.length >= 5
    ? p
    : { ...p, statements: [...p.statements, { text: '', is_correct: true }] });
  const removeStatement = (index) => setForm((p) => p.statements.length <= 1
    ? p
    : { ...p, statements: p.statements.filter((_, i) => i !== index) });
  const isMultipleAnswer = form.question_type === 'multiple_answer';
  const isTrueFalse = form.question_type === 'true_false';
  const withOptions = CHOICE_TYPES.includes(form.question_type);

  function handleTypeChange(questionType) {
    setForm((p) => {
      const current = p.correct_keys.length ? p.correct_keys : [p.correct_key].filter(Boolean);
      const nextKeys = questionType === 'multiple_answer'
        ? [...new Set([...current, ...p.options.map((option) => option.key)])].slice(0, 1)
        : current.slice(0, 1);
      const statements = questionType === 'true_false' && p.statements.length === 0
        ? DEFAULT_STATEMENTS.map((statement) => ({ ...statement }))
        : p.statements;
      return { ...p, question_type: questionType, statements, correct_keys: nextKeys, correct_key: nextKeys[0] ?? null };
    });
  }

  function toggleCorrectKey(key) {
    setForm((p) => {
      if (p.question_type !== 'multiple_answer') {
        return { ...p, correct_keys: [key], correct_key: key };
      }
      const next = p.correct_keys.includes(key)
        ? p.correct_keys.filter((item) => item !== key)
        : [...p.correct_keys, key];
      return { ...p, correct_keys: next, correct_key: next[0] ?? null };
    });
  }

  async function handleCreate(event) {
    event.preventDefault(); setError(''); setNotice('');
    try {
      if (!form.stem.trim() && !imageFile) { setError('Isi teks pertanyaan atau unggah gambar soal'); return; }
      if (!form.jenjang) { setError('Pilih jenjang terlebih dahulu'); return; }
      if (!form.mapel) { setError('Pilih mapel terlebih dahulu'); return; }
      let options = []; let correctKeys = []; let statements = [];
      if (isTrueFalse) {
        statements = form.statements.map((s) => ({ text: s.text.trim(), is_correct: Boolean(s.is_correct) }));
        if (statements.length < 1 || statements.length > 5) { setError('Jumlah pernyataan harus 1–5'); return; }
        if (statements.some((s) => !s.text)) { setError('Isi seluruh teks pernyataan'); return; }
        if (!statements.some((s) => s.is_correct)) { setError('Pilih minimal satu pernyataan yang benar'); return; }
      }
      if (withOptions) {
        options = form.options.filter((o) => o.content.trim());
        if (options.length < 2) { setError('Isi minimal dua opsi jawaban'); return; }
        const availableKeys = options.map((o) => o.key);
        correctKeys = form.correct_keys.filter((key) => availableKeys.includes(key));
        if (isMultipleAnswer) {
          if (correctKeys.length < 1) { setError('Pilih minimal satu kunci jawaban benar'); return; }
        } else {
          correctKeys = correctKeys.length ? correctKeys.slice(0, 1) : [availableKeys[0]];
        }
      }
      const payload = {
        stem: form.stem,
        jenjang: form.jenjang,
        mapel: form.mapel,
        question_type: form.question_type,
        difficulty: form.difficulty
      };
      if (withOptions) {
        payload.options = options.map((o) => ({ key: o.key, content: o.content, is_correct: correctKeys.includes(o.key) }));
        payload.correct_keys = correctKeys;
        payload.correct_key = correctKeys[0] ?? null;
        payload.answer_text = null;
        payload.explanation = form.explanation || null;
      } else if (!isTrueFalse) {
        payload.answer_text = form.answer_text || null;
        payload.explanation = form.explanation || null;
      }
      if (isTrueFalse) payload.statements = statements;
      await createQuestion(payload, imageFile);
      event.target.reset(); setForm(EMPTY_FORM); setImageFile(null);
      onCreated?.();
      setNotice('Soal berhasil disimpan. Lihat daftar di bawah halaman ini.');
    } catch (err) { setError(err.message); }
  }

  async function handleImport(event) {
    event.preventDefault(); setError(''); setNotice('');
    if (!selectedFile) { setError('Pilih file CSV atau XLSX dengan kolom jenjang terlebih dahulu'); return; }
    if (!/\.(csv|xlsx)$/i.test(selectedFile.name)) {
      setError('Impor soal hanya menerima file CSV atau XLSX yang memuat kolom jenjang');
      return;
    }
    try {
      const data = await importFile(selectedFile, sourceType);
      setNotice(`Import berhasil: ${data.created} soal dari sumber #${data.source_id} dengan kolom jenjang SD/SMP/SMA sesuai template.`);
      setSelectedFile(null);
      onCreated?.();
    } catch (err) {
      setError(`Impor soal gagal. Periksa kolom jenjang (SD/SMP/SMA) setelah mapel: ${err.message}`);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Buat Soal</h1>
        <p className="text-sm text-muted-foreground">Tambah soal manual atau impor dari file CSV/XLSX. Daftar soal dengan filter jenjang diperbarui otomatis di bawah halaman ini.</p>
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Soal Manual</CardTitle><CardDescription>Isi pertanyaan teks, gambar, atau keduanya.</CardDescription></CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleCreate}>
              <div className="space-y-2">
                <Label>Pertanyaan</Label>
                <Textarea rows="4" value={form.stem} placeholder="Tuliskan pertanyaan… kosongkan bila pertanyaan berupa gambar"
                  onChange={(e) => updateForm({ stem: e.target.value })} />
                <div className="flex flex-wrap items-center gap-3">
                  <Label className="inline-flex cursor-pointer items-center rounded-md border bg-background px-3 py-2 text-xs font-medium shadow-sm hover:bg-accent" htmlFor="question-image">Unggah gambar</Label>
                  <input id="question-image" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
                  <span className="text-xs text-muted-foreground">PNG/JPEG/WebP/GIF · maks 5 MB</span>
                </div>
                {imagePreview && (
                  <div className="flex items-center gap-3 rounded-md border border-dashed p-3">
                    <img src={imagePreview} alt="Pratinjau" className="h-20 w-28 rounded bg-muted object-contain" />
                    <div><div className="text-xs text-muted-foreground mb-2">{imageFile?.name}</div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setImageFile(null)}>Hapus gambar</Button></div>
                  </div>
                )}
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2"><Label>Jenjang</Label>
                  <SelectNative value={form.jenjang} onChange={(e) => updateForm({ jenjang: e.target.value })}>
                    <option value="">Pilih jenjang</option>
                    {jenjangs.map((jenjang) => <option key={jenjang.id} value={jenjang.kode}>{jenjang.kode}</option>)}
                  </SelectNative>
                  {jenjangs.length === 0 && <p className="text-xs text-muted-foreground">Belum ada jenjang tersedia.</p>}</div>
                <div className="space-y-2"><Label>Mapel</Label>
                  <SelectNative value={form.mapel} onChange={(e) => updateForm({ mapel: e.target.value })}>
                    <option value="">Pilih mapel</option>
                    {mapels.map((m) => <option key={m.id} value={m.code}>{m.name}</option>)}
                  </SelectNative>
                  {mapels.length === 0 && <p className="text-xs text-muted-foreground">Belum ada mapel tersedia. Tambahkan mapel di Kelola Mapel.</p>}</div>
                <div className="space-y-2"><Label>Tipe</Label>
                  <SelectNative value={form.question_type} onChange={(e) => handleTypeChange(e.target.value)}>
                    <option value="multiple_choice">Pilihan ganda</option><option value="true_false">Benar/Salah</option><option value="multiple_answer">Pilihan ganda multi-jawaban</option><option value="short_answer">Jawaban singkat</option><option value="essay">Esai</option>
                  </SelectNative></div>
                <div className="space-y-2"><Label>Kesulitan</Label>
                  <SelectNative value={form.difficulty} onChange={(e) => updateForm({ difficulty: e.target.value })}>
                    <option value="easy">Mudah</option><option value="medium">Sedang</option><option value="hard">Sulit</option>
                  </SelectNative></div>
              </div>

              {withOptions && (
                <div className="space-y-3 rounded-lg border p-4">
                  <Label className="text-sm font-semibold">Opsi Jawaban</Label>
                  {form.options.map((option, index) => (
                    <div className="flex items-center gap-3" key={option.key}>
                      <label className="flex w-14 items-center gap-2 text-sm font-medium">
                        <input
                          type={isMultipleAnswer ? 'checkbox' : 'radio'}
                          name={isMultipleAnswer ? 'correct_keys' : 'correct_key'}
                          className="accent-primary"
                          checked={isMultipleAnswer ? form.correct_keys.includes(option.key) : form.correct_key === option.key}
                          onChange={() => toggleCorrectKey(option.key)}
                        />{option.key}
                      </label>
                      <Input value={option.content} placeholder={`Isi opsi ${option.key}`} onChange={(e) => updateOption(index, e.target.value)} />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">{isMultipleAnswer ? 'Centang semua opsi yang benar (minimal satu).' : 'Pilih radio untuk menandai kunci jawaban benar.'}</p>
                </div>
              )}

              {isTrueFalse && (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Pernyataan Benar/Salah</Label>
                    <span className="text-xs text-muted-foreground">{form.statements.length}/5 pernyataan</span>
                  </div>
                  {form.statements.map((statement, index) => (
                    <div className="space-y-2 rounded-md border p-3" key={index}>
                      <div className="flex items-center justify-between gap-3">
                        <Label>Pernyataan {index + 1}</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeStatement(index)} disabled={form.statements.length <= 1}>Hapus</Button>
                      </div>
                      <Textarea rows="2" value={statement.text} placeholder="Contoh: Dari cerita tersebut, apakah tindakannya baik?"
                        onChange={(e) => updateStatement(index, { text: e.target.value })} />
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="radio" name={`statement-${index}`} className="accent-primary"
                            checked={statement.is_correct} onChange={() => updateStatement(index, { is_correct: true })} />Benar
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="radio" name={`statement-${index}`} className="accent-primary"
                            checked={!statement.is_correct} onChange={() => updateStatement(index, { is_correct: false })} />Salah
                        </label>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addStatement} disabled={form.statements.length >= 5}>Tambah Pernyataan</Button>
                  <p className="text-xs text-muted-foreground">Cerita/ringkasan ditulis di kolom Pertanyaan. Soal benar bila semua pernyataan benar.</p>
                </div>
              )}

              {!withOptions && !isTrueFalse && (
                <div className="space-y-2"><Label>Kunci / Jawaban Teks</Label>
                  <Textarea required rows="2" value={form.answer_text} onChange={(e) => updateForm({ answer_text: e.target.value })} /></div>
              )}

              <div className="space-y-2"><Label>Pembahasan (opsional)</Label>
                <Textarea rows="2" value={form.explanation} onChange={(e) => updateForm({ explanation: e.target.value })} /></div>
              <Button type="submit">Simpan Soal</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader><CardTitle>Impor Soal</CardTitle><CardDescription>Unggah file CSV atau XLSX dengan kolom jenjang setelah mapel. Payload tidak diterima.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border p-3 text-xs">
              <p className="font-medium">Template impor</p>
              <div className="mt-1 flex flex-wrap gap-3">
                <a className="text-primary underline" href="/templates/template-soal.csv" download>Unduh template CSV</a>
                <a className="text-primary underline" href="/templates/template-soal.xlsx" download>Unduh template XLSX</a>
              </div>
            </div>
            <form className="space-y-4" onSubmit={handleImport}>
              <div className="space-y-2"><Label>Jenis sumber</Label>
                <SelectNative value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
                  <option value="file_upload">Upload file</option><option value="external_collection">Pengumpulan eksternal</option><option value="manual">Input manual</option>
                </SelectNative></div>
              <div className="space-y-2"><Label>File CSV / XLSX</Label>
                <Input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} /></div>
              <Button type="submit" className="w-full">Impor Soal</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
