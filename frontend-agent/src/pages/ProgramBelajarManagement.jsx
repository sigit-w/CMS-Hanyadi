import { useEffect, useState } from 'react';
import {
  createProgramBelajar,
  deleteProgramBelajar,
  getJenjangs,
  getProgramsBelajar,
  updateProgramBelajar
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

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const EMPTY_SCHEDULE = { day: 'Senin', start_time: '08:00', end_time: '10:00' };
const EMPTY_FORM = {
  name: '', jenjang: '', kelas: '', description: '', biaya: '',
  schedules: [{ ...EMPTY_SCHEDULE }]
};
const currency = new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 2
});

function toForm(program) {
  return {
    name: program.name ?? '',
    jenjang: program.jenjang_kode ?? '',
    kelas: String(program.kelas ?? ''),
    description: program.description ?? '',
    biaya: String(Number(program.biaya ?? 0)),
    schedules: (program.schedules ?? []).map((schedule) => ({
      day: schedule.day,
      start_time: schedule.start_time,
      end_time: schedule.end_time
    }))
  };
}

function validateForm(form) {
  if (!form.name.trim()) return 'Nama program wajib diisi';
  if (!form.jenjang) return 'Pilih jenjang terlebih dahulu';
  const kelas = Number(form.kelas);
  if (!Number.isInteger(kelas) || kelas < 1 || kelas > 12) return 'Kelas harus angka bulat 1 sampai 12';
  const biaya = Number(form.biaya || 0);
  if (!Number.isFinite(biaya) || biaya < 0) return 'Biaya harus angka nonnegative';
  if (!Array.isArray(form.schedules) || form.schedules.length === 0) return 'Tambahkan minimal satu jadwal';
  const seen = new Set();
  for (const [index, schedule] of form.schedules.entries()) {
    if (!DAYS.includes(schedule.day)) return `Hari jadwal ${index + 1} tidak valid`;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.start_time) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.end_time)) {
      return `Jam jadwal ${index + 1} harus berformat HH:MM`;
    }
    if (schedule.end_time <= schedule.start_time) return `Jam selesai jadwal ${index + 1} harus setelah jam mulai`;
    const key = `${schedule.day}|${schedule.start_time}|${schedule.end_time}`;
    if (seen.has(key)) return `Jadwal duplikat: ${key.replaceAll('|', ' ')}`;
    seen.add(key);
  }
  return '';
}

export default function ProgramBelajarManagement() {
  const [programs, setPrograms] = useState([]);
  const [jenjangs, setJenjangs] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await getProgramsBelajar();
    setPrograms(data.programs ?? []);
  }

  useEffect(() => {
    let active = true;
    Promise.all([load(), getJenjangs()])
      .then(([, jenjangData]) => { if (active) setJenjangs(jenjangData.jenjangs ?? []); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  async function run(action, message) {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await action();
      await load();
      setNotice(message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM, schedules: [{ ...EMPTY_SCHEDULE }] });
    setEditingId(null);
  }

  function updateForm(patch) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function updateSchedule(index, patch) {
    setForm((current) => ({
      ...current,
      schedules: current.schedules.map((schedule, i) => i === index ? { ...schedule, ...patch } : schedule)
    }));
  }

  function addSchedule() {
    setForm((current) => ({ ...current, schedules: [...current.schedules, { ...EMPTY_SCHEDULE }] }));
  }

  function removeSchedule(index) {
    setForm((current) => ({ ...current, schedules: current.schedules.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validateForm(form);
    if (validationError) { setError(validationError); return; }
    const payload = {
      name: form.name.trim(),
      jenjang: form.jenjang,
      kelas: Number(form.kelas),
      description: form.description.trim(),
      biaya: Number(form.biaya || 0),
      schedules: form.schedules
    };
    const wasEditing = Boolean(editingId);
    await run(async () => {
      if (wasEditing) await updateProgramBelajar(editingId, payload);
      else await createProgramBelajar(payload);
      resetForm();
    }, wasEditing ? 'Program belajar diperbarui' : 'Program belajar ditambahkan');
  }

  async function handleDelete(program) {
    if (!window.confirm(`Hapus program belajar "${program.name}" beserta jadwalnya?`)) return;
    await run(() => deleteProgramBelajar(program.id), `Program belajar ${program.name} dihapus`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kelola Program Belajar</h1>
        <p className="text-sm text-muted-foreground">
          Tambah, ubah, atau hapus program belajar. Satu program dapat memiliki beberapa jadwal hari dan jam.
        </p>
      </div>
      {error && <Alert variant="destructive">Error: {error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>{editingId ? 'Ubah Program Belajar' : 'Program Belajar Baru'}</CardTitle>
            <CardDescription>Kelas 1–12, biaya angka nonnegative, dan minimal satu jadwal.</CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={resetForm}>
            {editingId ? 'Batal Edit' : 'Kosongkan Form'}
          </Button>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="program-name">Nama Program</Label>
                <Input id="program-name" required maxLength={128} placeholder="Contoh: Kelas Intensif Matematika"
                  value={form.name} onChange={(event) => updateForm({ name: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="program-jenjang">Jenjang</Label>
                <SelectNative id="program-jenjang" value={form.jenjang}
                  onChange={(event) => updateForm({ jenjang: event.target.value })}>
                  <option value="">Pilih jenjang</option>
                  {jenjangs.map((jenjang) => <option key={jenjang.id} value={jenjang.kode}>{jenjang.kode}</option>)}
                </SelectNative>
              </div>
              <div className="space-y-2">
                <Label htmlFor="program-kelas">Kelas (maks. 2 digit, maks. 12)</Label>
                <Input id="program-kelas" required type="text" inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2}
                  placeholder="Contoh: 03" value={form.kelas}
                  onChange={(event) => updateForm({ kelas: event.target.value.replace(/\D/g, '').slice(0, 2) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="program-biaya">Biaya</Label>
                <Input id="program-biaya" type="number" min="0" step="0.01" placeholder="Contoh: 150000"
                  value={form.biaya} onChange={(event) => updateForm({ biaya: event.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="program-description">Deskripsi Program</Label>
                <Textarea id="program-description" maxLength={1000} rows={2} placeholder="Opsional"
                  value={form.description} onChange={(event) => updateForm({ description: event.target.value })} />
              </div>
            </div>

            <div className="space-y-3 rounded-md border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label>Jadwal</Label>
                  <p className="text-xs text-muted-foreground">Bisa lebih dari satu jadwal dalam satu program.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{form.schedules.length} jadwal</Badge>
                  <Button type="button" size="sm" variant="outline" onClick={addSchedule}>Tambah Jadwal</Button>
                </div>
              </div>
              {form.schedules.map((schedule, index) => (
                <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor={`schedule-day-${index}`}>Hari</Label>
                    <SelectNative id={`schedule-day-${index}`} value={schedule.day}
                      onChange={(event) => updateSchedule(index, { day: event.target.value })}>
                      {DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
                    </SelectNative>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`schedule-start-${index}`}>Jam mulai</Label>
                    <Input id={`schedule-start-${index}`} type="time" required value={schedule.start_time}
                      onChange={(event) => updateSchedule(index, { start_time: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`schedule-end-${index}`}>Jam selesai</Label>
                    <Input id={`schedule-end-${index}`} type="time" required value={schedule.end_time}
                      onChange={(event) => updateSchedule(index, { end_time: event.target.value })} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Hapus jadwal ${index + 1}`}
                    disabled={form.schedules.length === 1} onClick={() => removeSchedule(index)}>×</Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {editingId ? 'Simpan Perubahan' : 'Tambah Program'}
              </Button>
              {editingId && <Button type="button" variant="outline" onClick={resetForm}>Batal</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Program Belajar</CardTitle>
          <CardDescription>{programs.length} program terdaftar.</CardDescription>
        </CardHeader>
        <CardContent>
          {programs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada program belajar.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Program</TableHead>
                  <TableHead>Jenjang</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Jadwal</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Biaya</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programs.map((program) => (
                  <TableRow key={program.id}>
                    <TableCell className="font-medium">{program.name}</TableCell>
                    <TableCell>{[program.jenjang_kode, program.jenjang_nama].filter(Boolean).join(' — ') || '—'}</TableCell>
                    <TableCell>{program.kelas}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {(program.schedules ?? []).map((schedule) => (
                          <div key={schedule.id ?? `${schedule.day}-${schedule.start_time}`} className="whitespace-nowrap text-xs">
                            {schedule.day} · {schedule.start_time}–{schedule.end_time}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[260px] text-sm text-muted-foreground">{program.description || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{currency.format(Number(program.biaya))}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => {
                          setForm(toForm(program));
                          setEditingId(program.id);
                          setError('');
                          setNotice('');
                        }}>Ubah</Button>
                        <Button type="button" size="sm" variant="destructive" disabled={saving}
                          onClick={() => handleDelete(program)}>Hapus</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
