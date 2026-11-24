import { useEffect, useState } from 'react';
import {
  createParticipant,
  createTryout,
  deleteTryout,
  getMapels,
  getParticipants,
  getQuestionSheets,
  getTryouts
} from '../api.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { SelectNative } from '@/components/ui/select-native';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const MAPEL_LABELS = {
  MTKA: 'Matematika',
  BIND: 'Bahasa Indonesia',
  IPAS: 'IPAS'
};

function jakartaInputDate(offsetHours = 0) {
  const shifted = new Date(Date.now() + (7 + offsetHours) * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

const emptyForm = () => ({
  name: '',
  start_at: jakartaInputDate(),
  end_at: jakartaInputDate(2),
  mapel_code: '',
  is_active: true
});

const emptyUmum = () => ({
  nama: '',
  sekolah: '',
  pin: generatePin(),
  wa_orang_tua: ''
});

function generatePin() {
  const values = new Uint32Array(9);
  window.crypto.getRandomValues(values);
  return Array.from(values, (value) => value % 10).join('');
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short'
  });
}

export default function TryoutManagement() {
  const [form, setForm] = useState(emptyForm);
  const [mapels, setMapels] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [tryouts, setTryouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pesertaDialog, setPesertaDialog] = useState(null);
  const [umumForm, setUmumForm] = useState(emptyUmum);
  const [umumError, setUmumError] = useState('');
  const [savingPeserta, setSavingPeserta] = useState(false);

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
      setSheets([]);
      setSelectedSheets([]);
      return undefined;
    }
    async function loadSheets() {
      try {
        const data = await getQuestionSheets({ status: 'active', mapel, limit: 100 });
        if (!active) return;
        setSheets(data.sheets);
        const available = new Set(data.sheets.map((sheet) => String(sheet.id)));
        setSelectedSheets((current) => current.filter((id) => available.has(id)));
      } catch (err) {
        if (active) setError(err.message);
      }
    }
    loadSheets();
    const refreshOnVisible = () => { if (!document.hidden) loadSheets(); };
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

  function openPesertaUmum() {
    setUmumForm(emptyUmum());
    setUmumError('');
    setPesertaDialog('umum');
  }

  async function handleCreateUmum(event) {
    event.preventDefault();
    setUmumError('');
    if (!umumForm.nama.trim() || !umumForm.sekolah.trim()
      || !/^\d{9}$/.test(umumForm.pin) || !umumForm.wa_orang_tua.trim()) {
      setUmumError('Lengkapi Nama, Sekolah, PIN 9 digit, dan Nomor WA Orang Tua.');
      return;
    }
    setSavingPeserta(true);
    try {
      const created = await createParticipant({
        jenis: 'umum',
        nama: umumForm.nama.trim(),
        sekolah: umumForm.sekolah.trim(),
        pin: umumForm.pin,
        wa_orang_tua: umumForm.wa_orang_tua.trim()
      });
      const participant = created.participant;
      setParticipants((current) => [participant, ...current.filter((item) => item.id !== participant.id)]);
      setSelectedParticipants((current) => (
        current.includes(String(participant.id)) ? current : [...current, String(participant.id)]
      ));
      setPesertaDialog(null);
      setNotice(`Peserta Umum "${participant.nama}" ditambahkan. PIN: ${umumForm.pin}`);
    } catch (err) {
      setUmumError(err.message);
    } finally {
      setSavingPeserta(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!form.name.trim() || !form.start_at || !form.end_at || !form.mapel_code
      || selectedSheets.length === 0) {
      setError('Lengkapi Nama Tryout, jadwal, mapel, dan minimal satu lembar soal.');
      return;
    }
    if (Date.parse(form.end_at) <= Date.parse(form.start_at)) {
      setError('Tanggal & jam selesai harus setelah tanggal & jam mulai.');
      return;
    }
    setSaving(true);
    try {
      const created = await createTryout({
        name: form.name.trim(),
        start_at: form.start_at,
        end_at: form.end_at,
        mapel_code: form.mapel_code,
        sheet_ids: selectedSheets.map(Number),
        participant_ids: selectedParticipants.map(Number),
        is_active: form.is_active
      });
      setNotice(`Tryout "${created.tryout.name}" berhasil dibuat.`);
      setForm(emptyForm());
      setSelectedSheets([]);
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
        <p className="text-sm text-muted-foreground">Buat Tryout baru, tentukan jadwal, mapel, lembar soal, dan peserta yang diundang.</p>
      </div>
      {error && <Alert variant="destructive">Error: {error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}
      {loading && <Alert>Memuat data…</Alert>}

      <Card>
        <CardHeader><CardTitle className="text-base">Buat Tryout Baru</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nama Tryout</Label>
                <Input value={form.name} maxLength={128} placeholder="Contoh: Tryout Matematika November"
                  onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal &amp; Jam Mulai</Label>
                <Input type="datetime-local" value={form.start_at}
                  onChange={(event) => setForm({ ...form, start_at: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal &amp; Jam Selesai</Label>
                <Input type="datetime-local" value={form.end_at}
                  onChange={(event) => setForm({ ...form, end_at: event.target.value })} />
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
            </div>

            <fieldset className="rounded-lg border p-4">
              <legend className="px-1 text-sm font-semibold">Lembar Soal ({selectedSheets.length} dipilih)</legend>
              {!form.mapel_code ? (
                <p className="text-sm text-muted-foreground">Pilih mapel terlebih dahulu untuk memuat lembar soal.</p>
              ) : sheets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada lembar soal aktif pada mapel ini.</p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {sheets.map((sheet) => {
                    const id = String(sheet.id);
                    return (
                      <label className="flex items-start gap-2 rounded-md border p-2 text-sm hover:bg-muted/40" key={id}>
                        <Checkbox className="mt-0.5" checked={selectedSheets.includes(id)}
                          onChange={() => toggleValue(id, setSelectedSheets)} />
                        <span>
                          <strong>{sheet.name}</strong> <span className="text-muted-foreground">({sheet.code})</span>
                          <span className="block text-xs text-muted-foreground">
                            {sheet.question_count} soal · {sheet.duration_minutes ? `${sheet.duration_minutes} menit` : 'durasi bebas'}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>

            <fieldset className="rounded-lg border p-4">
              <legend className="px-1 text-sm font-semibold">Peserta Tryout ({selectedParticipants.length} dipilih, opsional)</legend>
              {participants.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada peserta. Peserta tidak wajib diisi.</p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {participants.map((participant) => {
                    const id = String(participant.id);
                    return (
                      <label className="flex items-start gap-2 rounded-md border p-2 text-sm hover:bg-muted/40" key={id}>
                        <Checkbox className="mt-0.5" checked={selectedParticipants.includes(id)}
                          onChange={() => toggleValue(id, setSelectedParticipants)} />
                        <span>
                          <strong>{participant.nama}</strong>
                          <span className="block text-xs text-muted-foreground">
                            {participant.jenis === 'umum'
                              ? `Peserta Umum · ${participant.sekolah || '—'}`
                              : `Siswa · ${participant.email || '—'} · Kelas ${participant.kelas || '—'} · ${participant.sekolah || '—'}`}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="mt-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setPesertaDialog('choice')}>
                  Tambah Peserta Tryout
                </Button>
              </div>
            </fieldset>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_active}
                onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
              Jadikan sesi aktif
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Menyimpan…' : 'Simpan Tryout'}
              </Button>
              <span className="text-xs text-muted-foreground">Lembar soal wajib dipilih minimal satu; peserta opsional.</span>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={pesertaDialog === 'choice'} onClose={() => setPesertaDialog(null)} title="Tambah Peserta Tryout">
        <p className="mb-4 text-sm text-muted-foreground">Pilih jenis peserta yang akan ditambahkan ke tryout ini.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="button" variant="outline" className="h-auto flex-col items-start p-4 text-left"
            onClick={() => {
              setPesertaDialog(null);
              setNotice('Peserta Didik akan segera tersedia. Untuk sementara, gunakan Peserta Umum.');
            }}>
            <span className="font-semibold">A. Peserta Didik</span>
            <span className="text-xs text-muted-foreground">Segera hadir</span>
          </Button>
          <Button type="button" variant="outline" className="h-auto flex-col items-start p-4 text-left" onClick={openPesertaUmum}>
            <span className="font-semibold">B. Peserta Umum</span>
            <span className="text-xs text-muted-foreground">Isi data peserta dan PIN login</span>
          </Button>
        </div>
      </Dialog>

      <Dialog open={pesertaDialog === 'umum'} onClose={() => setPesertaDialog(null)} title="Tambah Peserta Umum">
        {umumError && <Alert variant="destructive">{umumError}</Alert>}
        <form className="mt-3 space-y-4" onSubmit={handleCreateUmum}>
          <div className="space-y-1.5">
            <Label>Nama</Label>
            <Input value={umumForm.nama} maxLength={128}
              onChange={(event) => setUmumForm({ ...umumForm, nama: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Sekolah</Label>
            <Input value={umumForm.sekolah} maxLength={255}
              onChange={(event) => setUmumForm({ ...umumForm, sekolah: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>PIN (9 digit)</Label>
            <div className="flex gap-2">
              <Input value={umumForm.pin} readOnly inputMode="numeric" maxLength={9} />
              <Button type="button" variant="secondary" onClick={() => setUmumForm({ ...umumForm, pin: generatePin() })}>
                Generate ulang
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">PIN otomatis dibuat dan dipakai peserta untuk login bersama Nama.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Nomor WA Orang Tua</Label>
            <Input value={umumForm.wa_orang_tua} maxLength={20} placeholder="08xxxxxxxxxx"
              onChange={(event) => setUmumForm({ ...umumForm, wa_orang_tua: event.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setPesertaDialog(null)}>Batal</Button>
            <Button type="submit" disabled={savingPeserta}>
              {savingPeserta ? 'Menyimpan…' : 'Simpan Peserta'}
            </Button>
          </div>
        </form>
      </Dialog>

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
                  <TableHead>Mulai</TableHead>
                  <TableHead>Selesai</TableHead>
                  <TableHead>Mapel</TableHead>
                  <TableHead>Lembar</TableHead>
                  <TableHead>Soal</TableHead>
                  <TableHead>Peserta</TableHead>
                  <TableHead>Submission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tryouts.map((tryout) => (
                  <TableRow key={tryout.id}>
                    <TableCell>#{tryout.id} {tryout.name}</TableCell>
                    <TableCell>{formatDateTime(tryout.start_at)}</TableCell>
                    <TableCell>{formatDateTime(tryout.end_at)}</TableCell>
                    <TableCell>{MAPEL_LABELS[tryout.mapel_code] ?? tryout.mapel_name ?? '—'}</TableCell>
                    <TableCell>{tryout.sheet_count ?? '—'}</TableCell>
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
