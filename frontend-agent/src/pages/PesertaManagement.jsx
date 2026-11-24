import { useEffect, useState } from 'react';
import {
  createParticipant,
  deleteParticipant,
  getParticipantDetail,
  getParticipants,
  getProgramsBelajar,
  updateParticipant,
  updateParticipantPassword
} from '../api.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectNative } from '@/components/ui/select-native';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const EMPTY_FORM = {
  nama: '', email: '', kelas: '', sekolah: '',
  program_belajar_id: '', wa_orang_tua: '', password: ''
};
const EMPTY_PASSWORD_FORM = { password: '', confirm: '' };
const WA_PATTERN = /^\+?[0-9][0-9 -]{6,18}$/;
const EMPTY_EDIT_VALUES = {
  nama: '', email: '', kelas: '', sekolah: '', program_belajar_id: '', wa_orang_tua: ''
};

function defaultParticipantPassword(nama) {
  const firstName = nama.trim().split(/\s+/)[0] || '';
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear() % 100).padStart(2, '0');
  return `${firstName}@${mm}${yy}`;
}

function programName(programs, id) {
  return programs.find((program) => String(program.id) === String(id))?.name ?? '—';
}

export default function PesertaManagement() {
  const [participants, setParticipants] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [passwordEdited, setPasswordEdited] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState(EMPTY_EDIT_VALUES);
  const [passwordId, setPasswordId] = useState(null);
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
  const [detailParticipant, setDetailParticipant] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const [participantData, programData] = await Promise.all([
      getParticipants(),
      getProgramsBelajar()
    ]);
    setParticipants(participantData.participants ?? []);
    setPrograms(programData.programs ?? []);
  }

  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  async function run(action, message) {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await action();
      await load();
      setNotice(message);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function validateWa(wa) {
    if (!wa || !WA_PATTERN.test(wa.trim()) || wa.trim().length > 20) {
      setError('Nomor WA orang tua wajib diisi dengan format angka (maksimal 20 karakter)');
      return false;
    }
    return true;
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!validateWa(form.wa_orang_tua)) return;
    await run(async () => {
      await createParticipant(form);
      setForm(EMPTY_FORM);
      setPasswordEdited(false);
    }, `Siswa ${form.nama} berhasil ditambahkan`);
  }

  async function handleUpdate(participant) {
    if (!validateWa(editValues.wa_orang_tua)) return;
    await run(async () => {
      await updateParticipant(participant.id, editValues);
      setEditingId(null);
      setPasswordId(null);
      setPasswordForm(EMPTY_PASSWORD_FORM);
    }, `Data ${editValues.nama} diperbarui`);
  }

  async function openDetail(participant) {
    setError('');
    try {
      const data = await getParticipantDetail(participant.id);
      setDetailParticipant(data.participant);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(participant) {
    if (!window.confirm(`Nonaktifkan siswa "${participant.nama}"? Sesi login akan dicabut.`)) return;
    await run(() => deleteParticipant(participant.id), `Siswa ${participant.nama} dinonaktifkan`);
    setPasswordId((current) => (current === participant.id ? null : current));
  }

  async function handlePasswordChange(participant) {
    if (!passwordForm.password || !passwordForm.confirm) {
      setError('Password baru dan konfirmasi wajib diisi');
      return;
    }
    if (passwordForm.password.length < 6) {
      setError('Password minimal 6 karakter');
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      setError('Konfirmasi password tidak cocok');
      return;
    }
    await run(async () => {
      await updateParticipantPassword(participant.id, passwordForm.password, passwordForm.confirm);
      setPasswordId(null);
      setPasswordForm(EMPTY_PASSWORD_FORM);
    }, `Password ${participant.nama} diperbarui. Sesi lama dicabut.`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kelola Siswa</h1>
        <p className="text-sm text-muted-foreground">
          Buat, ubah, dan nonaktifkan siswa tryout lengkap dengan program belajar, kelas, sekolah, dan nomor WA orang tua. Siswa login memakai email dan password yang dibuat di sini.
        </p>
      </div>
      {error && <Alert variant="destructive">Error: {error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Tambah Siswa</CardTitle>
          <CardDescription>
            Default password: nama depan@mmyy. Bisa diganti dengan password lain (min. 6 karakter).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label htmlFor="siswa-nama">Nama Siswa</Label>
              <Input id="siswa-nama" required maxLength={128} value={form.nama}
                placeholder="Nama lengkap siswa"
                onChange={(e) => {
                  const nama = e.target.value;
                  setForm((current) => ({
                    ...current,
                    nama,
                    password: passwordEdited ? current.password : defaultParticipantPassword(nama)
                  }));
                }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siswa-email">Email Siswa</Label>
              <Input id="siswa-email" required type="email" value={form.email}
                placeholder="siswa@contoh.id"
                onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="siswa-program">Program Belajar</Label>
                <SelectNative id="siswa-program" required value={form.program_belajar_id}
                  onChange={(e) => setForm({ ...form, program_belajar_id: e.target.value })}>
                  <option value="">Pilih program belajar</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name} — Kelas {program.kelas}
                    </option>
                  ))}
                </SelectNative>
              </div>
              <div className="space-y-2">
                <Label htmlFor="siswa-wa">No. WA Orang Tua</Label>
                <Input id="siswa-wa" required type="tel" maxLength={20} pattern={WA_PATTERN.source}
                  value={form.wa_orang_tua} placeholder="Contoh: 081234567890"
                  onChange={(e) => setForm({ ...form, wa_orang_tua: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="siswa-kelas">Kelas</Label>
                <Input id="siswa-kelas" required type="number" min={1} max={100} value={form.kelas}
                  placeholder="Contoh: 12"
                  onChange={(e) => setForm({ ...form, kelas: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="siswa-sekolah">Sekolah</Label>
                <Input id="siswa-sekolah" required maxLength={255} value={form.sekolah}
                  placeholder="Nama sekolah"
                  onChange={(e) => setForm({ ...form, sekolah: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="siswa-password">Password</Label>
              <Input id="siswa-password" required type="password" minLength={6}
                autoComplete="new-password" value={form.password}
                onChange={(e) => {
                  setPasswordEdited(true);
                  setForm({ ...form, password: e.target.value });
                }} />
              <p className="text-xs text-muted-foreground">
                Default: {defaultParticipantPassword(form.nama) || 'nama_depan@mmyy'} — bisa diganti.
              </p>
            </div>
            <Button type="submit" disabled={saving}>Tambah Siswa</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Siswa</CardTitle>
          <CardDescription>
            {participants.length} siswa terdaftar. Gunakan Ubah untuk data atau Password untuk mereset kunci login.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada siswa.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Siswa</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Program Belajar</TableHead>
                  <TableHead>WA Orang Tua</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Sekolah</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submission</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.map((participant) => (
                  <TableRow key={participant.id}>
                    <TableCell>
                      {editingId === participant.id ? (
                        <Input value={editValues.nama} maxLength={128}
                          onChange={(e) => setEditValues({ ...editValues, nama: e.target.value })} />
                      ) : participant.nama}
                    </TableCell>
                    <TableCell>
                      {editingId === participant.id ? (
                        <Input type="email" value={editValues.email}
                          onChange={(e) => setEditValues({ ...editValues, email: e.target.value.toLowerCase() })} />
                      ) : participant.email}
                    </TableCell>
                    <TableCell>
                      {editingId === participant.id ? (
                        <SelectNative value={editValues.program_belajar_id}
                          onChange={(e) => setEditValues({ ...editValues, program_belajar_id: e.target.value })}>
                          <option value="">Tanpa program</option>
                          {programs.map((program) => (
                            <option key={program.id} value={program.id}>
                              {program.name} — Kelas {program.kelas}
                            </option>
                          ))}
                        </SelectNative>
                      ) : participant.program_belajar_name ?? programName(programs, participant.program_belajar_id)}
                    </TableCell>
                    <TableCell>
                      {editingId === participant.id ? (
                        <Input type="tel" maxLength={20} value={editValues.wa_orang_tua}
                          placeholder="081234567890"
                          onChange={(e) => setEditValues({ ...editValues, wa_orang_tua: e.target.value })} />
                      ) : participant.wa_orang_tua || '—'}
                    </TableCell>
                    <TableCell>
                      {editingId === participant.id ? (
                        <Input type="number" min={1} max={100} value={editValues.kelas}
                          onChange={(e) => setEditValues({ ...editValues, kelas: e.target.value })} />
                      ) : participant.kelas || '—'}
                    </TableCell>
                    <TableCell>
                      {editingId === participant.id ? (
                        <Input maxLength={255} value={editValues.sekolah}
                          onChange={(e) => setEditValues({ ...editValues, sekolah: e.target.value })} />
                      ) : participant.sekolah || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={participant.is_active ? 'default' : 'secondary'}>
                        {participant.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    <TableCell>{participant.submission_count}</TableCell>
                    <TableCell className="w-72">
                      <div className="flex flex-wrap gap-2">
                        {passwordId === participant.id ? (
                          <div className="w-full space-y-2">
                            <Input type="password" minLength={6} autoComplete="new-password"
                              placeholder="Password baru (min. 6 karakter)"
                              value={passwordForm.password}
                              onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })} />
                            <Input type="password" minLength={6} autoComplete="new-password"
                              placeholder="Konfirmasi password"
                              value={passwordForm.confirm}
                              onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} />
                            <div className="flex gap-2">
                              <Button type="button" size="sm" disabled={saving}
                                onClick={() => handlePasswordChange(participant)}>Simpan Password</Button>
                              <Button type="button" size="sm" variant="outline"
                                onClick={() => {
                                  setPasswordId(null);
                                  setPasswordForm(EMPTY_PASSWORD_FORM);
                                }}>Batal</Button>
                            </div>
                          </div>
                        ) : editingId === participant.id ? (
                          <>
                            <Button type="button" size="sm" disabled={saving}
                              onClick={() => handleUpdate(participant)}>Simpan</Button>
                            <Button type="button" size="sm" variant="outline"
                              onClick={() => setEditingId(null)}>Batal</Button>
                          </>
                        ) : (
                          <>
                            <Button type="button" size="sm" variant="outline"
                              onClick={() => openDetail(participant)}>Detail</Button>
                            <Button type="button" size="sm" variant="outline"
                              onClick={() => {
                                setEditingId(participant.id);
                                setPasswordId(null);
                                setPasswordForm(EMPTY_PASSWORD_FORM);
                                setEditValues({
                                  nama: participant.nama,
                                  email: participant.email,
                                  kelas: participant.kelas || '',
                                  sekolah: participant.sekolah || '',
                                  program_belajar_id: participant.program_belajar_id ?? '',
                                  wa_orang_tua: participant.wa_orang_tua || ''
                                });
                              }}>Ubah</Button>
                            <Button type="button" size="sm" variant="outline"
                              disabled={!participant.is_active || saving}
                              onClick={() => {
                                setEditingId(null);
                                setPasswordId(participant.id);
                                setPasswordForm(EMPTY_PASSWORD_FORM);
                              }}>Password</Button>
                            <Button type="button" size="sm" variant="destructive"
                              onClick={() => handleDelete(participant)}>Hapus</Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(detailParticipant)} onClose={() => setDetailParticipant(null)} title="Detail Siswa">
        {detailParticipant && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Nama</span><strong>{detailParticipant.nama}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Email</span><span>{detailParticipant.email || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Kelas</span><span>{detailParticipant.kelas || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Sekolah</span><span>{detailParticipant.sekolah || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Program Belajar</span><span>{detailParticipant.program_belajar_name || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">WA Orang Tua</span><span>{detailParticipant.wa_orang_tua || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Password</span><strong>{detailParticipant.password_plain || '—'}</strong></div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
