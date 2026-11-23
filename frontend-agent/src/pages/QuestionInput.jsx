import { useEffect, useState } from 'react';
import { createQuestion, getMapels, importFile, importPayload } from '../api.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { SelectNative } from '@/components/ui/select-native';
import { Separator } from '@/components/ui/separator';

const CHOICE_TYPES = ['multiple_choice', 'true_false', 'multiple_answer'];
const EMPTY_FORM = {
  stem: '', mapel: 'MTKA', question_type: 'multiple_choice', difficulty: 'medium',
  options: [{ key: 'A', content: '' }, { key: 'B', content: '' }, { key: 'C', content: '' }, { key: 'D', content: '' }],
  correct_keys: ['A'], correct_key: 'A', answer_text: '', explanation: ''
};
const MAPEL_LABELS = { MTKA: 'Matematika', BIND: 'Bahasa Indonesia', IPAS: 'IPAS' };

export default function QuestionInput() {
  const [mapels, setMapels] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [importMode, setImportMode] = useState('file');
  const [importText, setImportText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [sourceType, setSourceType] = useState('file_upload');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { getMapels().then((d) => setMapels(d.mapels)).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    if (!imageFile) { setImagePreview(''); return undefined; }
    const preview = URL.createObjectURL(imageFile);
    setImagePreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [imageFile]);

  const updateForm = (patch) => setForm((p) => ({ ...p, ...patch }));
  const updateOption = (index, content) => setForm((p) => ({ ...p, options: p.options.map((o, i) => i === index ? { ...o, content } : o) }));
  const isMultipleAnswer = form.question_type === 'multiple_answer';
  const withOptions = CHOICE_TYPES.includes(form.question_type);

  function handleTypeChange(questionType) {
    setForm((p) => {
      const current = p.correct_keys.length ? p.correct_keys : [p.correct_key].filter(Boolean);
      const nextKeys = questionType === 'multiple_answer'
        ? [...new Set([...current, ...p.options.map((option) => option.key)])].slice(0, 1)
        : current.slice(0, 1);
      return { ...p, question_type: questionType, correct_keys: nextKeys, correct_key: nextKeys[0] ?? null };
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
      let options = []; let correctKeys = [];
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
      await createQuestion({
        stem: form.stem, mapel: form.mapel, question_type: form.question_type, difficulty: form.difficulty,
        options: withOptions ? options.map((o) => ({ key: o.key, content: o.content, is_correct: correctKeys.includes(o.key) })) : [],
        correct_keys: correctKeys, correct_key: correctKeys[0] ?? null,
        answer_text: form.answer_text || null, explanation: form.explanation || null
      }, imageFile);
      event.target.reset(); setForm(EMPTY_FORM); setImageFile(null);
      setNotice('Soal berhasil disimpan. Lihat daftar di menu Dashboard.');
    } catch (err) { setError(err.message); }
  }

  async function handleImport(event) {
    event.preventDefault(); setError(''); setNotice('');
    if (importMode === 'file' && !selectedFile) { setError('Pilih file terlebih dahulu'); return; }
    if (importMode === 'payload' && !importText.trim()) { setError('Konten impor wajib diisi'); return; }
    try {
      const data = importMode === 'file' ? await importFile(selectedFile, sourceType) : await importPayload({ content: importText, source: { type: sourceType, label: 'Payload Manual' } });
      setNotice(`Import berhasil: ${data.created} soal dari sumber #${data.source_id}`);
      setImportText(''); setSelectedFile(null);
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Input Soal</h1>
        <p className="text-sm text-muted-foreground">Tambah soal manual atau impor dari file/payload.</p>
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
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2"><Label>Mapel</Label>
                  <SelectNative value={form.mapel} onChange={(e) => updateForm({ mapel: e.target.value })}>
                    {mapels.length === 0 ? Object.entries(MAPEL_LABELS).map(([code, name]) => <option key={code} value={code}>{name}</option>) : mapels.map((m) => <option key={m.id} value={m.code}>{m.name}</option>)}
                  </SelectNative></div>
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

              {!withOptions && (
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
          <CardHeader><CardTitle>Impor Soal</CardTitle><CardDescription>Upload file atau tempel payload terstruktur.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={importMode === 'file' ? 'default' : 'outline'} onClick={() => setImportMode('file')}>File</Button>
              <Button type="button" variant={importMode === 'payload' ? 'default' : 'outline'} onClick={() => setImportMode('payload')}>Payload</Button>
            </div>
            <form className="space-y-4" onSubmit={handleImport}>
              <div className="space-y-2"><Label>Jenis sumber</Label>
                <SelectNative value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
                  <option value="file_upload">Upload file</option><option value="external_collection">Pengumpulan eksternal</option><option value="manual">Input manual</option>
                </SelectNative></div>
              {importMode === 'file' ? (
                <div className="space-y-2"><Label>File JSON / CSV / TXT</Label>
                  <Input type="file" accept=".json,.csv,.txt,application/json,text/csv,text/plain" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} /></div>
              ) : (
                <div className="space-y-2"><Label>Konten soal</Label>
                  <Textarea required rows="10" value={importText} placeholder={'Mapel: MTKA\nSoal: 2 + 2 = ?\nA. 3\nB. 4\nJawaban: B\n\n# Multi-jawaban: Jawaban: B,D'} onChange={(e) => setImportText(e.target.value)} /></div>
              )}
              <Button type="submit" className="w-full">Impor Soal</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
