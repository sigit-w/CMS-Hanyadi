import { useEffect, useState } from 'react';
import { getProspektus } from '../api.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short'
  });
}

export default function ProspektusManagement() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await getProspektus();
      setItems(data.prospektus);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const visible = items.filter((item) => {
    const term = search.trim().toLowerCase();
    return !term
      || item.nama.toLowerCase().includes(term)
      || (item.sekolah ?? '').toLowerCase().includes(term);
  });

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Prospektus</h1>
        <p className="text-sm text-muted-foreground">
          Data Peserta Umum yang dikeluarkan dari tryout tetap tersimpan di sini.
        </p>
      </div>
      {error && <Alert variant="destructive">Error: {error}</Alert>}
      {loading && <Alert>Memuat prospektus…</Alert>}

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Daftar Prospektus</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{items.length} data</Badge>
            <Button type="button" variant="outline" size="sm" onClick={load}>Muat ulang</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 max-w-sm">
            <Input value={search} placeholder="Cari nama atau sekolah" onChange={(event) => setSearch(event.target.value)} />
          </div>
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada Peserta Umum yang masuk prospektus.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Sekolah</TableHead>
                  <TableHead>WA Orang Tua</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Masuk Prospektus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.nama}</TableCell>
                    <TableCell>{item.sekolah || '—'}</TableCell>
                    <TableCell>{item.wa_orang_tua || '—'}</TableCell>
                    <TableCell><Badge variant="secondary">Peserta Umum</Badge></TableCell>
                    <TableCell>{formatDateTime(item.prospek_at)}</TableCell>
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
