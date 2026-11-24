import { useEffect, useState } from 'react';
import {
  createTryout,
  deleteTryout,
  getMapels,
  getParticipants,
  getQuestions,
  getTryouts
} from '../api.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { SelectNative } from '@/components/ui/select-native';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const MAPEL_LABELS = {
  MTKA: 'Matematika',
  BIND: 'Bahasa Indonesia',
  IPAS: 'IPAS'
};

const emptyForm = () => ({
  name: '',
  session_date: new Date().toISOString().slice(0, 10),
  mapel_code: '',
  is_active: true
});

function shortText(value, max = 96) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export default function TryoutManagement() {
  const [form, setForm] = useState(emptyForm);
  const [mapels, setMapels] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [tryouts, setTryouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refreshTryouts = async () => {
    const data = await getTryouts();
    setTryouts(data.tryouts);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const [mapelData, participantData, tryoutData] = await Promise.all([
          getMapels(),
          getParticipants(),
          getTryouts()
        ]);
        if (!active) return;
        setMapels(mapelData.mapels);
        setParticipants(participantData.participants.filter((participant) => participant.is_active));
        setTryouts(tryoutData.tryouts);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const mapel = form.mapel_code;
    if (!mapel) {
      setQuestions([]);
      setSelectedQuestions([]);
      return undefined;
    }
    async function loadQuestions() {
      try {
        const data = await getQuestions({ mapel, limit: 100 });
        if (!active) return;
        setQuestions(data.questions);
        const available = new Set(data.questions.map((question) => String(question.id)));
        setSelectedQuestions((current) => current.filter((id) => available.has(id)));
      } catch (err) {
        if (active) setError(err.message);
      }
    }
    loadQuestions();
    const refreshOnVisible = () => { if (!document.hidden) loadQuestions(); };
    document.addEventListener('visibilitychange', refreshOnVisible);
    window.addEventListener('focus', refreshOnVisible);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', refreshOnVisible);
      window.removeEventListener('focus', refreshOnVisible);
    };
  }, [form.mapel_code]);

  function toggleValue(value, setter) {
    setter((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!form.name.trim() || !form.session_date || !form.mapel_code
      || selectedQuestions.length === 0 || selectedParticipants.length === 0) {
      setError('Lengkapi nama, tanggal, mapel, minimal satu soal, dan minimal satu siswa.');
      return;
    }
    setSaving(true);
    try {
      const created = await createTryout({
        name: form.name.trim(),
        session_date: form.session_date,
        mapel_code: form.mapel_code,
        question_ids: selectedQuestions.map(Number),
        participant_ids: selectedParticipants.map(Number),
        is_active: form.is_active
      });
      setNotice(`Tryout "${created.tryout.name}" berhasil dibuat.`);
      setForm(emptyForm());
      setSelectedQuestions([]);
      setSelectedParticipants([]);
      await refreshTryouts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tryout) {
    if (!window.confirm(`Hapus tryout "${tryout.name}"? Submission lama akan tetap tersimpan tanpa sesi.`)) return;
    setError('');
    setNotice('');
    try {
      await deleteTryout(tryout.id);
      setNotice(`Tryout "${tryout.name}" dihapus.`);
      await refreshTryouts();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Manajemen Tryout</h1>
        <p className="text-sm text-muted-foreground">Buat Tryout baru, tentukan mapel, soal yang dipakai, dan siswa yang diundang.</p>
      </div>
      {error && <Alert variant="destructive">Error: {error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}
      {loading && <Alert>Memuat data…</Alert>}

      <Card>
        <CardHeader><CardTitle className="text-base">Buat Tryout Baru</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Nama tryout</Label>
                <Input value={form.name} maxLength={128} placeholder="Contoh: Tryout Matematika November"
                  onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal pelaksanaan</Label>
                <Input type="date" value={form.session_date}
                  onChange={(event) => setForm({ ...form, session_date: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Mapel</Label>
                <SelectNative value={form.mapel_code}
                  onChange={(event) => setForm({ ...form, mapel_code: event.target.value })}>
                  <option value="">Pilih mapel</option>
                  {mapels.map((mapel) => (
                    <option key={mapel.id} value={mapel.code}>
                      {MAPEL_LABELS[mapel.code] ?? mapel.name}
                    </option>
                  ))}
                </SelectNative>
              </div>
              <label className="flex items-center gap-2 pt-7 text-sm">
                <Checkbox checked={form.is_active}
                  onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
                Jadikan sesi aktif
              </label>
            </div>

            <fieldset className="rounded-lg border p-4">
              <legend className="px-1 text-sm font-semibold">Soal yang digunakan ({selectedQuestions.length} dipilih)</legend>
              {!form.mapel_code ? (
                <p className="text-sm text-muted-foreground">Pilih mapel terlebih dahulu untuk memuat daftar soal.</p>
              ) : questions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada soal aktif pada mapel ini.</p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {questions.map((question) => {
                    const id = String(question.id);
                    return (
                      <label className="flex items-start gap-2 rounded-md border p-2 text-sm hover:bg-muted/40" key={id}>
                        <Checkbox className="mt-0.5" checked={selectedQuestions.includes(id)}
                          onChange={() => toggleValue(id, setSelectedQuestions)} />
                        <span>
                          <strong>#{id}</strong> {shortText(question.stem)}
                          <span className="text-muted-foreground"> · {question.status} · {question.mapel_name}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>

            <fieldset className="rounded-lg border p-4">
              <legend className="px-1 text-sm font-semibold">Siswa ({selectedParticipants.length} dipilih)</legend>
              {participants.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada siswa. Tambahkan lewat menu Kelola Siswa.</p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {participants.map((participant) => {
                    const id = String(participant.id);
                    return (
                      <label className="flex items-start gap-2 rounded-md border p-2 text-sm hover:bg-muted/40" key={id}>
                        <Checkbox className="mt-0.5" checked={selectedParticipants.includes(id)}
                          onChange={() => toggleValue(id, setSelectedParticipants)} />
                        <span>
                          <strong>{participant.nama}</strong> ({participant.email})
                          <span className="block text-xs text-muted-foreground">
                            Kelas {participant.kelas || '—'} · {participant.sekolah || '—'}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Menyimpan…' : 'Simpan Tryout'}
              </Button>
              <span className="text-xs text-muted-foreground">Soal dan siswa wajib dipilih minimal satu.</span>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <CardTitle className="text-base">Daftar Tryout</CardTitle>
          <Badge variant="secondary">{tryouts.length} sesi</Badge>
        </CardHeader>
        <CardContent>
          {tryouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada tryout.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Mapel</TableHead>
                  <TableHead>Soal</TableHead>
                  <TableHead>Siswa</TableHead>
                  <TableHead>Submission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tryouts.map((tryout) => (
                  <TableRow key={tryout.id}>
                    <TableCell>#{tryout.id} {tryout.name}</TableCell>
                    <TableCell>{tryout.session_date}</TableCell>
                    <TableCell>{MAPEL_LABELS[tryout.mapel_code] ?? tryout.mapel_name ?? '—'}</TableCell>
                    <TableCell>{tryout.question_count}</TableCell>
                    <TableCell>{tryout.participant_count}</TableCell>
                    <TableCell>{tryout.submission_count}</TableCell>
                    <TableCell>
                      <Badge variant={tryout.is_active ? 'default' : 'secondary'}>
                        {tryout.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="destructive" size="sm" onClick={() => handleDelete(tryout)}>
                        Hapus
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
