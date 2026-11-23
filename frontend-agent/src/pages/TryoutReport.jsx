import { useCallback, useEffect, useState } from 'react';
import {
  activateTryoutSession,
  createTryoutSession,
  getTryoutReport,
  getTryoutSessions
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

const emptySession = () => ({
  name: '',
  session_date: new Date().toISOString().slice(0, 10),
  is_active: true
});

function displayDate(value) {
  const text = String(value ?? '');
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text || '-';
}

export default function TryoutReport() {
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState('');
  const [report, setReport] = useState({ summary: [] });
  const [form, setForm] = useState(emptySession);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [sessionData, reportData] = await Promise.all([
      getTryoutSessions(),
      getTryoutReport(sessionId || null)
    ]);
    setSessions(sessionData.sessions);
    setReport({ summary: reportData.summary });
  }, [sessionId]);

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [load]);

  async function handleCreate(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!form.name.trim()) {
      setError('Nama sesi wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const data = await createTryoutSession({
        name: form.name.trim(),
        session_date: form.session_date,
        is_active: form.is_active
      });
      setNotice(`Sesi ${data.session.name} dibuat${data.session.is_active ? ' dan diaktifkan' : ''}.`);
      setForm({ ...emptySession(), is_active: false });
      setSessionId(data.session.id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(id) {
    setError('');
    setNotice('');
    try {
      const data = await activateTryoutSession(id);
      setNotice(`Sesi ${data.session.name} sekarang aktif untuk submission baru.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const groupedSessions = sessions.map((session) => ({
    ...session,
    rows: report.summary.filter((row) => row.session_id === session.id)
  })).filter((session) => session.rows.length || session.is_active);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Laporan Tryout</h1>
        <p className="text-sm text-muted-foreground">
          Sesi tryout dan rekap jumlah benar, salah, serta skor per peserta dan mapel.
        </p>
      </div>
      {error && <Alert variant="destructive">Error: {error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Buat Sesi Tryout</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="space-y-1.5">
                <Label>Nama sesi</Label>
                <Input value={form.name} placeholder="Contoh: Tryout Minggu 1"
                  onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal sesi</Label>
                <Input type="date" value={form.session_date}
                  onChange={(event) => setForm({ ...form, session_date: event.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.is_active}
                  onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
                <span>Jadikan sesi aktif</span>
              </label>
              <Button type="submit" disabled={saving}>
                {saving ? 'Menyimpan…' : 'Buat Sesi'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Sesi Tersedia</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Filter laporan</Label>
              <SelectNative value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
                <option value="">Semua sesi</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name} · {displayDate(session.session_date)}
                  </option>
                ))}
              </SelectNative>
            </div>
            <ul className="m-0 list-none space-y-2 p-0">
              {sessions.map((session) => (
                <li key={session.id} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
                  <span>
                    <strong>{session.name}</strong>
                    <span className="text-muted-foreground"> · {displayDate(session.session_date)} · {session.submission_count} jawaban</span>
                    {session.is_active && <Badge className="ml-2" variant="secondary">aktif</Badge>}
                  </span>
                  {!session.is_active && (
                    <Button type="button" variant="outline" size="sm" onClick={() => handleActivate(session.id)}>
                      Aktifkan
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {groupedSessions.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Belum ada sesi dengan submission. Buat sesi lalu minta peserta mengirim jawaban.</p>
          </CardContent>
        </Card>
      )}

      {groupedSessions.map((session) => (
        <Card key={session.id}>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <CardTitle className="text-base">{session.name}</CardTitle>
            <Badge variant="secondary">{displayDate(session.session_date)}</Badge>
          </CardHeader>
          <CardContent>
            {session.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada jawaban pada sesi ini.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Peserta</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Sekolah</TableHead>
                    <TableHead>Mapel</TableHead>
                    <TableHead>Benar</TableHead>
                    <TableHead>Salah</TableHead>
                    <TableHead>Skor/Nilai</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session.rows.map((row) => (
                    <TableRow key={`${row.user_id}-${row.mapel_id}`}>
                      <TableCell>{row.participant}</TableCell>
                      <TableCell>{row.kelas || '—'}</TableCell>
                      <TableCell>{row.sekolah || '—'}</TableCell>
                      <TableCell>{row.mapel}</TableCell>
                      <TableCell>{row.correct}</TableCell>
                      <TableCell>{row.wrong}</TableCell>
                      <TableCell><strong>{Number(row.score ?? 0).toFixed(1)}</strong></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}
    </>
  );
}
