import { useEffect, useState } from 'react';
import {
  getJenjangs,
  getProspektus,
  getProspektusDetail,
  getProgramsBelajar,
  registerProspektus
} from '../api.js';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { SelectNative } from '@/components/ui/select-native';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import CredentialCopy from '@/components/CredentialCopy';

const EMPTY_FORM = {
  email: '', kelas: '', program_belajar_id: '', jenjang_id: '', wa_orang_tua: '', password: ''
};

function jenjangLabel(prospektus) {
  if (!prospektus.jenjang_kode) return '-';
  return `${prospektus.jenjang_kode} — ${prospektus.jenjang_nama || ''}`.trim();
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short'
  });
}

export default function ProspektusManagement() {
  const [items, setItems] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [jenjangs, setJenjangs] = useState([]);
  const [jenjangFilter, setJenjangFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [prospektusData, programData, jenjangData] = await Promise.all([
        getProspektus({ jenjang_id: jenjangFilter || null }),
        getProgramsBelajar(),
        getJenjangs()
      ]);
      setItems(prospektusData.prospektus);
      setPrograms(programData.programs ?? []);
      setJenjangs(jenjangData.jenjangs ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [jenjangFilter]);

  const visible = items.filter((item) => {
    const term = search.trim().toLowerCase();
    return !term
      || item.nama.toLowerCase().includes(term)
      || (item.username ?? '').toLowerCase().includes(term)
      || (item.jenjang_kode ?? '').toLowerCase().includes(term)
      || (item.sekolah ?? '').toLowerCase().includes(term);
  });

  async function openDetail(item) {
    setError('');
    setNotice('');
    try {
      const data = await getProspektusDetail(item.id);
      const prospektus = data.prospektus;
      setDetail(prospektus);
      setForm({
        email: '',
        kelas: '',
        program_belajar_id: '',
        jenjang_id: prospektus.jenjang_id || '',
        wa_orang_tua: prospektus.wa_orang_tua || '',
        password: ''
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDaftar(event) {
    event.preventDefault();
    if (!form.email || !form.kelas) {
      setError('Email dan Kelas wajib diisi.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await registerProspektus(detail.id, {
        email: form.email.trim().toLowerCase(),
        kelas: Number(form.kelas),
        program_belajar_id: form.program_belajar_id || null,
        jenjang_id: form.jenjang_id || detail.jenjang_id || null,
        wa_orang_tua: form.wa_orang_tua,
        password: form.password || undefined
      });
      setNotice(`${detail.nama} berhasil didaftarkan sebagai siswa.`);
      setDetail(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Peserta Umum</h1>
        <p className="text-sm text-muted-foreground">
          Klik baris untuk melihat detail dan mendaftarkannya sebagai siswa.
        </p>
      </div>
      {error && <Alert variant="destructive">Error: {error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}
      {loading && <Alert>Memuat peserta umum…</Alert>}

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input className="w-full sm:max-w-sm" value={search} placeholder="Cari nama, username, atau sekolah" aria-label="Cari peserta umum" onChange={(event) => setSearch(event.target.value)} />
            <SelectNative id="prospektus-filter-jenjang" aria-label="Filter jenjang peserta umum"
              className="w-full sm:w-36" value={jenjangFilter}
              onChange={(event) => setJenjangFilter(event.target.value)}>
              <option value="">Semua jenjang</option>
              {jenjangs.map((jenjang) => (
                <option key={jenjang.id} value={jenjang.id}>{jenjang.kode}</option>
              ))}
            </SelectNative>
            <Badge variant="secondary" className="h-9 shrink-0 px-3 sm:ml-auto">{visible.length} data</Badge>
          </div>
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada peserta umum.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Username / PIN</TableHead>
                  <TableHead>Jenjang</TableHead>
                  <TableHead>Sekolah</TableHead>
                  <TableHead>WA Orang Tua</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Tanggal Masuk</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((item) => (
                  <TableRow key={item.id} role="button" tabIndex={0}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => openDetail(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openDetail(item);
                      }
                    }}>
                    <TableCell className="font-medium">{item.nama}</TableCell>
                    <TableCell>
                      <CredentialCopy name={item.nama} username={item.username} secret={item.pin_plain || item.password_plain} label="PIN" />
                    </TableCell>
                    <TableCell>{jenjangLabel(item)}</TableCell>
                    <TableCell>{item.sekolah || '—'}</TableCell>
                    <TableCell>{item.wa_orang_tua || '—'}</TableCell>
                    <TableCell><Badge variant="secondary">Peserta Umum</Badge></TableCell>
                    <TableCell>{formatDateTime(item.prospek_at ?? item.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant={item.bergabung ? 'default' : 'secondary'}>
                        {item.bergabung ? 'Bergabung' : 'Prospek'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} title="Detail Peserta Umum">
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Nama</span><strong>{detail.nama}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Username / PIN</span><CredentialCopy name={detail.nama} username={detail.username} secret={detail.pin_plain || detail.password_plain} label="PIN" /></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Jenjang</span><span>{jenjangLabel(detail)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Sekolah</span><span>{detail.sekolah || '—'}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">WA Orang Tua</span><span>{detail.wa_orang_tua || '—'}</span></div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={detail.bergabung ? 'default' : 'secondary'}>
                  {detail.bergabung ? 'Bergabung' : 'Prospek'}
                </Badge>
              </div>
            </div>

            {detail.bergabung ? (
              <p className="text-xs text-muted-foreground">Peserta ini sudah didaftarkan sebagai siswa.</p>
            ) : (
              <form className="space-y-3 border-t pt-4" onSubmit={handleDaftar}>
                <p className="font-semibold">Daftarkan sebagai Siswa</p>
                <div className="space-y-1.5">
                  <Label>Email Siswa</Label>
                  <Input required type="email" value={form.email} placeholder="siswa@contoh.id"
                    onChange={(event) => setForm({ ...form, email: event.target.value.toLowerCase() })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Kelas</Label>
                    <Input required type="number" min={1} max={100} value={form.kelas}
                      onChange={(event) => setForm({ ...form, kelas: event.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Program Belajar</Label>
                    <SelectNative value={form.program_belajar_id}
                      onChange={(event) => setForm({ ...form, program_belajar_id: event.target.value })}>
                      <option value="">Tanpa program</option>
                      {programs.map((program) => (
                        <option key={program.id} value={program.id}>{program.name}</option>
                      ))}
                    </SelectNative>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Jenjang Siswa</Label>
                  <SelectNative value={form.jenjang_id}
                    onChange={(event) => setForm({ ...form, jenjang_id: event.target.value })}>
                    <option value="">Ikuti jenjang peserta</option>
                    {jenjangs.map((jenjang) => (
                      <option key={jenjang.id} value={jenjang.id}>{jenjang.kode}</option>
                    ))}
                  </SelectNative>
                </div>
                <div className="space-y-1.5">
                  <Label>WA Orang Tua</Label>
                  <Input value={form.wa_orang_tua} maxLength={20}
                    onChange={(event) => setForm({ ...form, wa_orang_tua: event.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Password (opsional)</Label>
                  <Input type="password" minLength={6} value={form.password}
                    placeholder="Kosongkan untuk password default"
                    onChange={(event) => setForm({ ...form, password: event.target.value })} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setDetail(null)}>Batal</Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Menyimpan…' : 'Daftarkan sebagai Siswa'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
