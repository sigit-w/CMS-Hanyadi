import { useEffect, useState } from 'react';
import {
  createJenjang, createMapel, deleteJenjang, deleteMapel,
  getJenjangs, getMapels, updateJenjang, updateMapel
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

const EMPTY_FORM = { code: '', name: '', description: '' };
const EMPTY_EDIT = { code: '', name: '', description: '', is_active: true };
const EMPTY_JENJANG_FORM = { kode: '', nama: '', deskripsi: '' };
const EMPTY_JENJANG_EDIT = { kode: '', nama: '', deskripsi: '', is_active: true };

export default function MapelManagement() {
  const [mapels, setMapels] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState(EMPTY_EDIT);
  const [jenjangs, setJenjangs] = useState([]);
  const [jenjangForm, setJenjangForm] = useState(EMPTY_JENJANG_FORM);
  const [editingJenjangId, setEditingJenjangId] = useState(null);
  const [jenjangEdit, setJenjangEdit] = useState(EMPTY_JENJANG_EDIT);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const [data, jenjangData] = await Promise.all([
      getMapels({ include_inactive: true }),
      getJenjangs({ include_inactive: true })
    ]);
    setMapels(data.mapels);
    setJenjangs(jenjangData.jenjangs);
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

  async function handleCreate(event) {
    event.preventDefault();
    await run(async () => {
      await createMapel({ ...form, is_active: true });
      setForm(EMPTY_FORM);
    }, `Mapel ${form.name} berhasil ditambahkan`);
  }

  async function handleUpdate(mapel) {
    await run(async () => {
      await updateMapel(mapel.id, editValues);
      setEditingId(null);
    }, `Data ${editValues.name} diperbarui`);
  }

  async function handleDelete(mapel) {
    if (!window.confirm(`Hapus mapel "${mapel.name}"? Aksi ini permanen bila mapel belum dipakai.`)) return;
    await run(() => deleteMapel(mapel.id), `Mapel ${mapel.name} dihapus`);
  }

  async function handleJenjangCreate(event) {
    event.preventDefault();
    const kode = jenjangForm.kode.trim().toUpperCase();
    await run(async () => {
      await createJenjang({ ...jenjangForm, kode, is_active: true });
      setJenjangForm(EMPTY_JENJANG_FORM);
    }, `Jenjang ${kode} berhasil ditambahkan`);
  }

  async function handleJenjangUpdate(jenjang) {
    await run(async () => {
      await updateJenjang(jenjang.id, {
        ...jenjangEdit,
        kode: jenjangEdit.kode.trim().toUpperCase()
      });
      setEditingJenjangId(null);
    }, `Data ${jenjangEdit.nama} diperbarui`);
  }

  async function handleJenjangDelete(jenjang) {
    if (!window.confirm(`Hapus jenjang "${jenjang.nama}"?`)) return;
    await run(() => deleteJenjang(jenjang.id), `Jenjang ${jenjang.nama} dihapus`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kelola Mapel &amp; Jenjang</h1>
        <p className="text-sm text-muted-foreground">
          Tambah, ubah, nonaktifkan, atau hapus mata pelajaran. Kode mapel 4 karakter dipakai filter soal, import, tryout, dan prefix kode lembar soal.
        </p>
      </div>
      {error && <Alert variant="destructive">Error: {error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Tambah Mapel</CardTitle>
          <CardDescription>Kode unik tepat 4 karakter A-Z atau 0-9; huruf kecil akan diubah ke kapital.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[180px_1fr_2fr_auto] md:items-end" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label htmlFor="mapel-code">Kode</Label>
              <Input id="mapel-code" required maxLength={4} pattern="[A-Z0-9]{4}"
                placeholder="contoh: MTKA" value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mapel-name">Nama</Label>
              <Input id="mapel-name" required maxLength={64} placeholder="Nama mata pelajaran"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mapel-description">Deskripsi</Label>
              <Input id="mapel-description" maxLength={1000} placeholder="Opsional"
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <Button type="submit" disabled={saving}>Tambah Mapel</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Mapel</CardTitle>
          <CardDescription>{mapels.length} mapel terdaftar, termasuk yang nonaktif.</CardDescription>
        </CardHeader>
        <CardContent>
          {mapels.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada mapel.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mapels.map((mapel) => (
                  <TableRow key={mapel.id}>
                    <TableCell className="font-mono text-xs">
                      {editingId === mapel.id ? (
                        <Input maxLength={4} pattern="[A-Z0-9]{4}" value={editValues.code}
                          onChange={(e) => setEditValues({ ...editValues, code: e.target.value.toUpperCase() })} />
                      ) : mapel.code}
                    </TableCell>
                    <TableCell>
                      {editingId === mapel.id ? (
                        <Input maxLength={64} value={editValues.name}
                          onChange={(e) => setEditValues({ ...editValues, name: e.target.value })} />
                      ) : mapel.name}
                    </TableCell>
                    <TableCell>
                      {editingId === mapel.id ? (
                        <Textarea maxLength={1000} value={editValues.description}
                          onChange={(e) => setEditValues({ ...editValues, description: e.target.value })} />
                      ) : (mapel.description || '—')}
                    </TableCell>
                    <TableCell>
                      {editingId === mapel.id ? (
                        <SelectNative value={String(editValues.is_active)}
                          onChange={(e) => setEditValues({ ...editValues, is_active: e.target.value === 'true' })}>
                          <option value="true">Aktif</option>
                          <option value="false">Nonaktif</option>
                        </SelectNative>
                      ) : (
                        <Badge variant={mapel.is_active ? 'default' : 'secondary'}>
                          {mapel.is_active ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {editingId === mapel.id ? (
                          <>
                            <Button type="button" size="sm" disabled={saving}
                              onClick={() => handleUpdate(mapel)}>Simpan</Button>
                            <Button type="button" size="sm" variant="outline"
                              onClick={() => setEditingId(null)}>Batal</Button>
                          </>
                        ) : (
                          <>
                            <Button type="button" size="sm" variant="outline"
                              onClick={() => {
                                setEditingId(mapel.id);
                                setEditValues({
                                  code: mapel.code,
                                  name: mapel.name,
                                  description: mapel.description ?? '',
                                  is_active: mapel.is_active
                                });
                              }}>Ubah</Button>
                            <Button type="button" size="sm" variant="destructive" disabled={saving || mapel.question_count > 0 || mapel.tryout_count > 0}
                              title={mapel.question_count > 0 || mapel.tryout_count > 0
                                ? 'Mapel masih dipakai soal atau tryout' : undefined}
                              onClick={() => handleDelete(mapel)}>Hapus</Button>
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

      <Card>
        <CardHeader>
          <CardTitle>Jenjang Pendidikan</CardTitle>
          <CardDescription>Kode jenjang dipakai sebagai awalan username peserta. Data awal: SD, SMP, SMA.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[140px_1fr_2fr_auto] md:items-end" onSubmit={handleJenjangCreate}>
            <div className="space-y-2">
              <Label htmlFor="jenjang-kode">Kode</Label>
              <Input id="jenjang-kode" required maxLength={8} placeholder="contoh: SD"
                value={jenjangForm.kode}
                onChange={(e) => setJenjangForm({ ...jenjangForm, kode: e.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jenjang-nama">Nama</Label>
              <Input id="jenjang-nama" required maxLength={64} placeholder="Nama jenjang"
                value={jenjangForm.nama}
                onChange={(e) => setJenjangForm({ ...jenjangForm, nama: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jenjang-deskripsi">Deskripsi</Label>
              <Input id="jenjang-deskripsi" maxLength={1000} placeholder="Opsional"
                value={jenjangForm.deskripsi}
                onChange={(e) => setJenjangForm({ ...jenjangForm, deskripsi: e.target.value })} />
            </div>
            <Button type="submit" disabled={saving}>Tambah Jenjang</Button>
          </form>

          <div className="mt-6">
            {jenjangs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada jenjang.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jenjangs.map((jenjang) => (
                    <TableRow key={jenjang.id}>
                      <TableCell className="font-mono text-xs">
                        {editingJenjangId === jenjang.id ? (
                          <Input maxLength={8} value={jenjangEdit.kode}
                            onChange={(e) => setJenjangEdit({ ...jenjangEdit, kode: e.target.value.toUpperCase() })} />
                        ) : jenjang.kode}
                      </TableCell>
                      <TableCell>
                        {editingJenjangId === jenjang.id ? (
                          <Input maxLength={64} value={jenjangEdit.nama}
                            onChange={(e) => setJenjangEdit({ ...jenjangEdit, nama: e.target.value })} />
                        ) : jenjang.nama}
                      </TableCell>
                      <TableCell>
                        {editingJenjangId === jenjang.id ? (
                          <Textarea maxLength={1000} value={jenjangEdit.deskripsi}
                            onChange={(e) => setJenjangEdit({ ...jenjangEdit, deskripsi: e.target.value })} />
                        ) : (jenjang.deskripsi || '—')}
                      </TableCell>
                      <TableCell>
                        {editingJenjangId === jenjang.id ? (
                          <SelectNative value={String(jenjangEdit.is_active)}
                            onChange={(e) => setJenjangEdit({ ...jenjangEdit, is_active: e.target.value === 'true' })}>
                            <option value="true">Aktif</option>
                            <option value="false">Nonaktif</option>
                          </SelectNative>
                        ) : (
                          <Badge variant={jenjang.is_active ? 'default' : 'secondary'}>
                            {jenjang.is_active ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {editingJenjangId === jenjang.id ? (
                            <>
                              <Button type="button" size="sm" disabled={saving}
                                onClick={() => handleJenjangUpdate(jenjang)}>Simpan</Button>
                              <Button type="button" size="sm" variant="outline"
                                onClick={() => setEditingJenjangId(null)}>Batal</Button>
                            </>
                          ) : (
                            <>
                              <Button type="button" size="sm" variant="outline"
                                onClick={() => {
                                  setEditingJenjangId(jenjang.id);
                                  setJenjangEdit({
                                    kode: jenjang.kode,
                                    nama: jenjang.nama,
                                    deskripsi: jenjang.deskripsi ?? '',
                                    is_active: jenjang.is_active
                                  });
                                }}>Ubah</Button>
                              <Button type="button" size="sm" variant="destructive"
                                disabled={saving || jenjang.participant_count > 0}
                                title={jenjang.participant_count > 0 ? 'Jenjang masih dipakai peserta' : undefined}
                                onClick={() => handleJenjangDelete(jenjang)}>Hapus</Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
