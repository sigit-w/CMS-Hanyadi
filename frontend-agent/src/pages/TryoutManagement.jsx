import { useEffect, useState } from 'react';
import {
  createParticipant,
  createTryout,
  deleteTryout,
  getMapels,
  getParticipants,
  getQuestionSheets,
  getTryout,
  getTryouts,
  markParticipantProspek,
  removeTryoutParticipant
} from '../api.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2 } from 'lucide-react';
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

function participantSubtitle(participant) {
  if (participant.jenis === 'umum') {
    return `Peserta Umum · ${participant.sekolah || '—'} · WA ${participant.wa_orang_tua || '—'}`;
  }
  return `Siswa · ${participant.email || '—'} · Kelas ${participant.kelas || '—'} · ${participant.sekolah || '—'}`;
}

function ParticipantRows({ rows, onDetail, onRemove, emptyText }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <div className="max-h-56 space-y-2 overflow-y-auto">
      {rows.map((participant) => (
        <div
          key={participant.id}
          role="button"
          tabIndex={0}
          className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary"
          onClick={() => onDetail(participant)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onDetail(participant);
            }
          }}
        >
          <span className="min-w-0">
            <strong className="block truncate">{participant.nama}</strong>
            <span className="block truncate text-xs text-muted-foreground">{participantSubtitle(participant)}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Hapus ${participant.nama} dari tryout`}
            onClick={(event) => {
              event.stopPropagation();
              onRemove(participant);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export default function TryoutManagement() {
  const [form, setForm] = useState(emptyForm);
  const [mapels, setMapels] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [detailParticipant, setDetailParticipant] = useState(null);
  const [managedTryoutId, setManagedTryoutId] = useState(null);
  const [managedParticipants, setManagedParticipants] = useState([]);
  const [tryouts, setTryouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pesertaDialog, setPesertaDialog] = useState(null);
  const [umumForm, setUmumForm] = useState(emptyUmum);
  const [umumError, setUmumError] = useState('');
  const [savingPeserta, setSavingPeserta] = useState(false);
  const [siswaSearch, setSiswaSearch] = useState('');

  const draftParticipantRows = selectedParticipants
    .map((id) => participants.find((participant) => String(participant.id) === String(id)))
    .filter(Boolean);
  const siswaRows = participants.filter((participant) => (
    participant.jenis === 'siswa'
    && participant.nama.toLowerCase().includes(siswaSearch.trim().toLowerCase())
  ));

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

  function openPesertaSiswa() {
    setSiswaSearch('');
    setPesertaDialog('siswa');
  }

  function handlePickSiswa(participant) {
    setSelectedParticipants((current) => (
      current.includes(String(participant.id)) ? current : [...current, String(participant.id)]
    ));
    setPesertaDialog(null);
    setNotice(`Siswa "${participant.nama}" ditambahkan ke tryout.`);
  }

  async function handleRemoveDraftParticipant(participant) {
    const isUmum = participant.jenis === 'umum';
    const message = isUmum
      ? `Keluarkan Peserta Umum "${participant.nama}" dari daftar tryout? Datanya akan disimpan di Prospektus dan login dinonaktifkan.`
      : `Keluarkan Siswa "${participant.nama}" dari daftar tryout? Data siswa tidak akan dihapus.`;
    if (!window.confirm(message)) return;
    setError('');
    setNotice('');
    try {
      if (isUmum) await markParticipantProspek(participant.id);
      setSelectedParticipants((current) => current.filter((id) => String(id) !== String(participant.id)));
      setNotice(isUmum
        ? `Peserta Umum "${participant.nama}" dipindahkan ke Prospektus.`
        : `Siswa "${participant.nama}" dikeluarkan dari tryout. Data siswa tetap tersimpan.`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function openManageParticipants(tryout) {
    setError('');
    setNotice('');
    try {
      const [detail, participantData] = await Promise.all([getTryout(tryout.id), getParticipants()]);
      const ids = detail.tryout.participant_ids.map(String);
      setManagedTryoutId(detail.tryout.id);
      setManagedParticipants(
        participantData.participants.filter((participant) => ids.includes(String(participant.id)))
      );
      setPesertaDialog('manage');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemoveManagedParticipant(participant) {
    const isUmum = participant.jenis === 'umum';
    const message = isUmum
      ? `Keluarkan Peserta Umum "${participant.nama}" dari tryout ini? Datanya akan disimpan di Prospektus.`
      : `Keluarkan Siswa "${participant.nama}" dari tryout ini? Data siswa tidak akan dihapus.`;
    if (!window.confirm(message)) return;
    setError('');
    setNotice('');
    try {
      await removeTryoutParticipant(managedTryoutId, participant.id);
      setManagedParticipants((current) => current.filter((item) => item.id !== participant.id));
      setNotice(isUmum
        ? `Peserta Umum "${participant.nama}" dipindahkan ke Prospektus.`
        : `Siswa "${participant.nama}" dikeluarkan dari tryout. Data siswa tetap tersimpan.`);
      await refreshTryouts();
    } catch (err) {
      setError(err.message);
    }
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
              <p className="mb-2 text-xs text-muted-foreground">
                Data siswa tidak ditampilkan sampai dipilih melalui A. Peserta Didik.
              </p>
              <ParticipantRows
                rows={draftParticipantRows}
                onDetail={setDetailParticipant}
                onRemove={handleRemoveDraftParticipant}
                emptyText="Belum ada peserta terpilih. Peserta tidak wajib diisi."
              />
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
          <Button type="button" variant="outline" className="h-auto flex-col items-start p-4 text-left" onClick={openPesertaSiswa}>
            <span className="font-semibold">A. Peserta Didik</span>
            <span className="text-xs text-muted-foreground">Pilih siswa dari Kelola Siswa</span>
          </Button>
          <Button type="button" variant="outline" className="h-auto flex-col items-start p-4 text-left" onClick={openPesertaUmum}>
            <span className="font-semibold">B. Peserta Umum</span>
            <span className="text-xs text-muted-foreground">Isi data peserta dan PIN login</span>
          </Button>
        </div>
      </Dialog>

      <Dialog open={pesertaDialog === 'siswa'} onClose={() => setPesertaDialog(null)} title="A. Peserta Didik">
        <p className="mb-3 text-sm text-muted-foreground">Pilih siswa dari data Kelola Siswa untuk dilampirkan ke tryout ini.</p>
        <Input
          value={siswaSearch}
          placeholder="Cari nama siswa"
          onChange={(event) => setSiswaSearch(event.target.value)}
        />
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {siswaRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada siswa yang cocok.</p>
          ) : siswaRows.map((participant) => (
            <div key={participant.id} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
              <span className="min-w-0">
                <strong className="block truncate">{participant.nama}</strong>
                <span className="block truncate text-xs text-muted-foreground">{participantSubtitle(participant)}</span>
              </span>
              <Button
                type="button"
                size="sm"
                disabled={selectedParticipants.some((id) => String(id) === String(participant.id))}
                onClick={() => handlePickSiswa(participant)}
              >
                {selectedParticipants.some((id) => String(id) === String(participant.id)) ? 'Dipilih' : 'Pilih'}
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="ghost" onClick={() => setPesertaDialog(null)}>Selesai</Button>
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

      <Dialog open={Boolean(detailParticipant)} onClose={() => setDetailParticipant(null)} title="Detail Peserta Tryout">
        {detailParticipant && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Nama</span><strong>{detailParticipant.nama}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Jenis</span><span>{detailParticipant.jenis === 'umum' ? 'Peserta Umum' : 'Peserta Didik'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Sekolah</span><span>{detailParticipant.sekolah || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Kelas</span><span>{detailParticipant.jenis === 'umum' ? '—' : detailParticipant.kelas || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Program Belajar</span><span>{detailParticipant.program_belajar_name || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Email</span><span>{detailParticipant.email || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">WA Orang Tua</span><span>{detailParticipant.wa_orang_tua || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Submission</span><span>{detailParticipant.submission_count ?? 0}</span></div>
            <p className="pt-2 text-xs text-muted-foreground">PIN atau password yang sudah di-hash tidak dapat ditampilkan kembali.</p>
          </div>
        )}
      </Dialog>

      <Dialog open={pesertaDialog === 'manage'} onClose={() => setPesertaDialog(null)} title="Kelola Peserta Tryout">
        <p className="mb-3 text-sm text-muted-foreground">
          {tryouts.find((tryout) => tryout.id === managedTryoutId)?.name ?? `Tryout #${managedTryoutId ?? '—'}`}
        </p>
        <ParticipantRows
          rows={managedParticipants}
          onDetail={(participant) => {
            setPesertaDialog(null);
            setDetailParticipant(participant);
          }}
          onRemove={handleRemoveManagedParticipant}
          emptyText="Tidak ada peserta pada tryout ini."
        />
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
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => openManageParticipants(tryout)}>
                          Kelola Peserta
                        </Button>
                        <Button type="button" variant="destructive" size="sm" onClick={() => handleDelete(tryout)}>
                          Hapus
                        </Button>
                      </div>
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
