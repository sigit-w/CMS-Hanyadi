import { useEffect, useMemo, useState } from 'react';
import {
  addTryoutParticipants,
  createParticipant,
  getJenjangs,
  getParticipantDetail,
  getProspektus,
  getSiswa,
  getTryout,
  getTryoutParticipants,
  removeTryoutParticipant
} from '../api.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { SelectNative } from '@/components/ui/select-native';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import CredentialCopy from '@/components/CredentialCopy';

const emptyUmum = () => ({ nama: '', sekolah: '', jenjang_id: '', wa_orang_tua: '' });

function waDigits(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}

function jenjangText(row) {
  if (!row?.jenjang_kode) return '-';
  return `${row.jenjang_kode} — ${row.jenjang_nama || ''}`.trim();
}

function participantType(row) {
  return row?.jenis === 'umum' ? 'Peserta Umum' : 'Peserta Didik';
}

function sourceSubtitle(row, sourceLabel) {
  if (sourceLabel === 'Prospektus') {
    return `${sourceLabel} · ${row.sekolah || '—'} · WA ${row.wa_orang_tua || '—'}`;
  }
  return `${sourceLabel} · ${row.email || '—'} · Kelas ${row.kelas || '—'} · ${row.sekolah || '—'}`;
}

function mergeParticipants(participants, siswaRows, prospektusRows) {
  const byId = new Map([...(siswaRows ?? []), ...(prospektusRows ?? [])]
    .map((row) => [String(row.id), row]));
  return (participants ?? []).map((row) => ({ ...(byId.get(String(row.id)) ?? {}), ...row }));
}

export default function TryoutParticipantsPage({ tryoutId, onBack }) {
  const [tryout, setTryout] = useState(null);
  const [rows, setRows] = useState([]);
  const [siswa, setSiswa] = useState([]);
  const [prospektus, setProspektus] = useState([]);
  const [jenjangs, setJenjangs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [jenjangFilter, setJenjangFilter] = useState('');
  const [addMode, setAddMode] = useState(null);
  const [umumTab, setUmumTab] = useState('manual');
  const [sourceSearch, setSourceSearch] = useState('');
  const [sourceJenjangFilter, setSourceJenjangFilter] = useState('');
  const [umumForm, setUmumForm] = useState(emptyUmum);
  const [umumError, setUmumError] = useState('');
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);

  async function loadParticipants() {
    const [participantData, siswaData, prospektusData] = await Promise.all([
      getTryoutParticipants(tryoutId),
      getSiswa(),
      getProspektus()
    ]);
    setRows(mergeParticipants(participantData.participants, siswaData.siswa, prospektusData.prospektus));
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const [tryoutData, participantData, siswaData, prospektusData, jenjangData] = await Promise.all([
          getTryout(tryoutId),
          getTryoutParticipants(tryoutId),
          getSiswa(),
          getProspektus(),
          getJenjangs()
        ]);
        if (!active) return;
        setTryout(tryoutData.tryout);
        setSiswa((siswaData.siswa ?? []).filter((row) => row.is_active));
        setProspektus(prospektusData.prospektus ?? []);
        setJenjangs(jenjangData.jenjangs ?? []);
        setRows(mergeParticipants(participantData.participants, siswaData.siswa, prospektusData.prospektus));
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [tryoutId]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (jenjangFilter && String(row.jenjang_id) !== String(jenjangFilter)) return false;
      if (!term) return true;
      return [row.nama, row.username, row.jenjang_kode, row.sekolah, row.email]
        .some((value) => String(value ?? '').toLowerCase().includes(term));
    });
  }, [rows, search, jenjangFilter]);

  const sourceRows = addMode === 'siswa' || (addMode === 'umum' && umumTab === 'siswa')
    ? siswa
    : addMode === 'umum' && umumTab === 'prospektus' ? prospektus : [];
  const sourceLabel = addMode === 'umum' && umumTab === 'prospektus' ? 'Prospektus' : 'Siswa';
  const filteredSourceRows = sourceRows.filter((row) => {
    if (sourceJenjangFilter && String(row.jenjang_id) !== String(sourceJenjangFilter)) return false;
    const term = sourceSearch.trim().toLowerCase();
    if (!term) return true;
    return [row.nama, row.username, row.jenjang_kode, row.email, row.kelas, row.sekolah]
      .some((value) => String(value ?? '').toLowerCase().includes(term));
  });

  function isAlreadySelected(row) {
    return rows.some((item) => String(item.id) === String(row.id));
  }

  function openAdd(mode) {
    setError('');
    setNotice('');
    setUmumError('');
    setAddMode(mode);
    setSourceSearch('');
    setSourceJenjangFilter('');
    if (mode === 'umum') {
      setUmumForm(emptyUmum());
      setUmumTab('manual');
    }
  }

  async function openDetail(row) {
    setError('');
    setNotice('');
    setDetail(row);
    try {
      const data = await getParticipantDetail(row.id);
      setDetail({ ...row, ...data.participant });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAttach(row) {
    if (isAlreadySelected(row)) return;
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await addTryoutParticipants(tryoutId, [row.id]);
      await loadParticipants();
      setNotice(`${sourceLabel} "${row.nama}" ditambahkan ke tryout ini.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateUmum(event) {
    event.preventDefault();
    setUmumError('');
    if (!umumForm.nama.trim() || !umumForm.sekolah.trim() || !umumForm.jenjang_id
      || !waDigits(umumForm.wa_orang_tua)) {
      setUmumError('Lengkapi Nama, Sekolah, Jenjang, dan Nomor WA Orang Tua 8–15 digit.');
      return;
    }
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const created = await createParticipant({
        jenis: 'umum',
        nama: umumForm.nama.trim(),
        sekolah: umumForm.sekolah.trim(),
        jenjang_id: Number(umumForm.jenjang_id),
        wa_orang_tua: umumForm.wa_orang_tua.trim()
      });
      const participant = created.participant;
      await addTryoutParticipants(tryoutId, [participant.id]);
      await loadParticipants();
      setNotice(`Peserta Umum "${participant.nama}" ditambahkan. PIN: ${participant.pin_plain || waDigits(umumForm.wa_orang_tua)}`);
      setUmumForm(emptyUmum());
      setAddMode(null);
    } catch (err) {
      setUmumError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(row) {
    const isUmum = row.jenis === 'umum';
    const message = isUmum
      ? `Keluarkan Peserta Umum "${row.nama}" dari tryout ini? Datanya akan disimpan di Prospektus.`
      : `Keluarkan Siswa "${row.nama}" dari tryout ini? Data siswa tidak akan dihapus.`;
    if (!window.confirm(message)) return;
    setError('');
    setNotice('');
    try {
      await removeTryoutParticipant(tryoutId, row.id);
      await loadParticipants();
      setNotice(isUmum
        ? `Peserta Umum "${row.nama}" dipindahkan ke Prospektus.`
        : `Siswa "${row.nama}" dikeluarkan dari tryout. Data siswa tetap tersimpan.`);
    } catch (err) {
      setError(err.message);
    }
  }

  function renderSourcePicker(label) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SelectNative className="max-w-[180px]" value={sourceJenjangFilter}
            onChange={(event) => setSourceJenjangFilter(event.target.value)}>
            <option value="">Semua jenjang</option>
            {jenjangs.map((jenjang) => (
              <option key={jenjang.id} value={jenjang.id}>{jenjang.kode} — {jenjang.nama}</option>
            ))}
          </SelectNative>
          <Input className="flex-1" value={sourceSearch}
            placeholder={`Cari nama, email, kelas, atau sekolah ${label.toLowerCase()}`}
            onChange={(event) => setSourceSearch(event.target.value)} />
          <Button type="button" variant="outline" size="sm" onClick={() => {
            setSourceSearch('');
            setSourceJenjangFilter('');
          }}>
            Bersihkan
          </Button>
        </div>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {filteredSourceRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {sourceRows.length === 0
                ? `Belum ada ${label.toLowerCase()} yang tersedia.`
                : `Tidak ada ${label.toLowerCase()} yang cocok dengan pencarian.`}
            </p>
          ) : filteredSourceRows.map((row) => (
            <div key={`${label}-${row.id}`} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
              <span className="min-w-0">
                <strong className="block truncate">{row.nama}</strong>
                <span className="block truncate text-xs text-muted-foreground">{sourceSubtitle(row, label)}</span>
              </span>
              <Button type="button" size="sm" disabled={saving || isAlreadySelected(row)}
                onClick={() => handleAttach(row)}>
                {isAlreadySelected(row) ? 'Dipilih' : saving ? 'Menambahkan…' : 'Pilih'}
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kelola Peserta</h1>
          <p className="text-sm text-muted-foreground">
            {tryout?.name ?? `Tryout #${tryoutId}`} · daftar peserta memakai tampilan Peserta Umum.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onBack}>Kembali ke Daftar Tryout</Button>
      </div>
      {error && <Alert variant="destructive">Error: {error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}
      {loading && <Alert>Memuat peserta tryout…</Alert>}

      <Card>
        <CardHeader><CardTitle className="text-base">Daftar Peserta</CardTitle></CardHeader>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input className="w-full max-w-sm" value={search} placeholder="Cari nama, username, atau sekolah"
              aria-label="Cari peserta tryout" onChange={(event) => setSearch(event.target.value)} />
            <Label htmlFor="tryout-peserta-jenjang">Jenjang</Label>
            <SelectNative id="tryout-peserta-jenjang" value={jenjangFilter}
              onChange={(event) => setJenjangFilter(event.target.value)}>
              <option value="">Semua jenjang</option>
              {jenjangs.map((jenjang) => (
                <option key={jenjang.id} value={jenjang.id}>{jenjang.kode} — {jenjang.nama}</option>
              ))}
            </SelectNative>
            <Badge variant="secondary" className="h-9 px-3">{visible.length} data</Badge>
          </div>
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada peserta pada tryout ini.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Username / Kredensial</TableHead>
                  <TableHead>Jenjang</TableHead>
                  <TableHead>Sekolah</TableHead>
                  <TableHead>Kelas / Email</TableHead>
                  <TableHead>WA Orang Tua</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => (
                  <TableRow key={row.id} role="button" tabIndex={0} className="cursor-pointer hover:bg-muted/40"
                    onClick={() => openDetail(row)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openDetail(row);
                      }
                    }}>
                    <TableCell className="font-medium">{row.nama}</TableCell>
                    <TableCell>
                      <CredentialCopy name={row.nama} username={row.username}
                        secret={row.jenis === 'umum' ? row.pin_plain : row.password_plain}
                        label={row.jenis === 'umum' ? 'PIN' : 'Password'} />
                    </TableCell>
                    <TableCell>{jenjangText(row)}</TableCell>
                    <TableCell>{row.sekolah || '—'}</TableCell>
                    <TableCell>{row.jenis === 'umum' ? '—' : `Kelas ${row.kelas || '—'} · ${row.email || '—'}`}</TableCell>
                    <TableCell>{row.wa_orang_tua || '—'}</TableCell>
                    <TableCell><Badge variant={row.jenis === 'umum' ? 'secondary' : 'outline'}>{participantType(row)}</Badge></TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="icon"
                        aria-label={`Hapus ${row.nama} dari tryout`}
                        onClick={(event) => { event.stopPropagation(); handleRemove(row); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Tambah Peserta ke Tryout Ini</CardTitle></CardHeader>
        <CardContent className="pt-6">
          {!addMode && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="outline" className="h-auto flex-col items-start p-4 text-left"
                onClick={() => openAdd('siswa')}>
                <span className="font-semibold">A. Peserta Didik</span>
                <span className="text-xs text-muted-foreground">Pilih siswa dari Kelola Siswa</span>
              </Button>
              <Button type="button" variant="outline" className="h-auto flex-col items-start p-4 text-left"
                onClick={() => openAdd('umum')}>
                <span className="font-semibold">B. Peserta Umum</span>
                <span className="text-xs text-muted-foreground">Isi data baru atau pilih siswa/prospektus</span>
              </Button>
            </div>
          )}

          {addMode === 'siswa' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Pilih siswa dari data Kelola Siswa untuk dilampirkan ke tryout ini.</p>
              {renderSourcePicker('Siswa')}
              <div className="flex justify-end">
                <Button type="button" variant="ghost" onClick={() => setAddMode(null)}>Selesai</Button>
              </div>
            </div>
          )}

          {addMode === 'umum' && (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { key: 'manual', label: 'Form Manual' },
                  { key: 'siswa', label: 'Dari Siswa' },
                  { key: 'prospektus', label: 'Dari Prospektus' }
                ].map((tab) => (
                  <Button key={tab.key} type="button"
                    variant={umumTab === tab.key ? 'default' : 'outline'} size="sm"
                    role="tab" aria-selected={umumTab === tab.key}
                    onClick={() => { setUmumTab(tab.key); setSourceSearch(''); setSourceJenjangFilter(''); }}>
                    {tab.label}
                  </Button>
                ))}
              </div>
              {umumTab === 'manual' && (
                <>
                  {umumError && <Alert variant="destructive">{umumError}</Alert>}
                  <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleCreateUmum}>
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
                      <Label>Jenjang</Label>
                      <SelectNative required value={umumForm.jenjang_id}
                        onChange={(event) => setUmumForm({ ...umumForm, jenjang_id: event.target.value })}>
                        <option value="">Pilih jenjang</option>
                        {jenjangs.map((jenjang) => (
                          <option key={jenjang.id} value={jenjang.id}>{jenjang.kode} — {jenjang.nama}</option>
                        ))}
                      </SelectNative>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nomor WA Orang Tua</Label>
                      <Input value={umumForm.wa_orang_tua} maxLength={20} placeholder="08xxxxxxxxxx"
                        onChange={(event) => setUmumForm({ ...umumForm, wa_orang_tua: event.target.value })} />
                      <p className="text-xs text-muted-foreground">PIN dan username dibuat dari digit nomor WA ini.</p>
                    </div>
                    <div className="flex justify-end gap-2 sm:col-span-2">
                      <Button type="button" variant="ghost" onClick={() => setAddMode(null)}>Batal</Button>
                      <Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan Peserta'}</Button>
                    </div>
                  </form>
                </>
              )}
              {(umumTab === 'siswa' || umumTab === 'prospektus') && renderSourcePicker(sourceLabel)}
              {(umumTab === 'siswa' || umumTab === 'prospektus') && (
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" onClick={() => setAddMode(null)}>Selesai</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} title="Detail Peserta Umum">
        {detail && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Nama</span><strong>{detail.nama}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Kredensial</span><CredentialCopy name={detail.nama} username={detail.username} secret={detail.pin_plain || detail.password_plain} label="PIN/password" /></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Jenjang</span><span>{jenjangText(detail)}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Jenis</span><span>{participantType(detail)}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Sekolah</span><span>{detail.sekolah || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Kelas</span><span>{detail.jenis === 'umum' ? '—' : detail.kelas || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Program Belajar</span><span>{detail.program_belajar_name || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Email</span><span>{detail.email || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">WA Orang Tua</span><span>{detail.wa_orang_tua || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Submission</span><span>{detail.submission_count ?? 0}</span></div>
          </div>
        )}
      </Dialog>
    </>
  );
}
