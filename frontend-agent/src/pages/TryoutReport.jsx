import { useEffect, useMemo, useState } from 'react';
import {
  downloadTryoutReportExcel,
  getJenjangs,
  getTryoutReport,
  getTryoutSessions
} from '../api.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Dialog } from '@/components/ui/dialog';
import { SelectNative } from '@/components/ui/select-native';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function displayDate(value) {
  const text = String(value ?? '');
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text || '-';
}

function displayDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short'
  });
}

function tryoutLabel(session) {
  return session.event_name || session.name || '—';
}

function uniqueTryouts(sessions) {
  const seen = new Set();
  return sessions
    .map((session) => tryoutLabel(session))
    .filter((name) => {
      if (!name || name === '—' || seen.has(name)) return false;
      seen.add(name);
      return true;
    })
    .sort((a, b) => String(a).localeCompare(String(b), 'id-ID'))
    .map((name) => ({ value: name, label: name }));
}

export default function TryoutReport() {
  const [filterSessions, setFilterSessions] = useState([]);
  const [reportSessions, setReportSessions] = useState([]);
  const [jenjangs, setJenjangs] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [appliedSessionId, setAppliedSessionId] = useState('');
  const [jenjangId, setJenjangId] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadTryout, setDownloadTryout] = useState('');
  const [report, setReport] = useState({ summary: [], attempts: [], violations: [] });
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [openViolations, setOpenViolations] = useState({});

  useEffect(() => {
    let active = true;
    Promise.all([getTryoutSessions({ jenjang_id: jenjangId || null }), getJenjangs()])
      .then(([sessions, jenjangData]) => {
        if (!active) return;
        setReportSessions(sessions.sessions ?? []);
        setJenjangs(jenjangData.jenjangs ?? []);
      })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [jenjangId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    getTryoutSessions({ search: debouncedSearch, jenjang_id: jenjangId || null })
      .then((data) => { if (active) setFilterSessions(data.sessions ?? []); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [debouncedSearch, jenjangId]);

  useEffect(() => {
    let active = true;
    getTryoutReport(appliedSessionId || null, jenjangId || null)
      .then((data) => {
        if (!active) return;
        setReport({
          summary: data.summary,
          attempts: data.attempts ?? [],
          violations: data.violations ?? []
        });
      })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [appliedSessionId, jenjangId]);

  async function handleDownload() {
    setError('');
    setDownloading(true);
    try {
      const name = downloadTryout.trim();
      const blob = await downloadTryoutReportExcel(
        appliedSessionId || null,
        name || null,
        jenjangId || null
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `laporan-tryout-${name.replace(/[\\/:*?"<>|]/g, '-') || 'semua'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDownloadOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  function toggleViolations(id) {
    setOpenViolations((current) => ({ ...current, [id]: !current[id] }));
  }

  const tryoutOptions = useMemo(() => uniqueTryouts(reportSessions), [reportSessions]);
  const sessionOptions = useMemo(() => {
    const options = filterSessions.map((session) => ({
      value: session.id,
      label: tryoutLabel(session)
    }));
    const selected = filterSessions.find((session) => session.id === selectedSessionId)
      ?? reportSessions.find((session) => session.id === selectedSessionId);
    if (selected && !options.some((option) => option.value === selected.id)) {
      options.unshift({ value: selected.id, label: tryoutLabel(selected) });
    }
    return options;
  }, [filterSessions, reportSessions, selectedSessionId]);

  const groupedSessions = reportSessions.map((session) => ({
    ...session,
    rows: report.summary.filter((row) => row.session_id === session.id),
    attempts: report.attempts.filter((row) => row.session_id === session.id),
    violations: report.violations.filter((row) => row.session_id === session.id)
  })).filter((session) => session.rows.length || session.attempts.length || session.is_active);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Laporan Tryout</h1>
        <p className="text-sm text-muted-foreground">
          Sesi tryout dan rekap jumlah benar, salah, serta skor per siswa dan mapel.
        </p>
      </div>
      {error && <Alert variant="destructive">Error: {error}</Alert>}

      <Card>
        <CardHeader><CardTitle className="text-base">Filter Laporan Tryout</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="tryout-report-search">Cari tryout</Label>
              <Combobox
                id="tryout-report-search"
                value={search}
                onChange={setSearch}
                options={tryoutOptions}
                placeholder="Cari tryout"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tryout-report-jenjang">Jenjang</Label>
              <SelectNative id="tryout-report-jenjang" value={jenjangId}
                onChange={(event) => setJenjangId(event.target.value)}>
                <option value="">Semua jenjang</option>
                {jenjangs.map((jenjang) => (
                  <option key={jenjang.id} value={jenjang.id}>{jenjang.kode} — {jenjang.nama}</option>
                ))}
              </SelectNative>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tryout-report-session">Sesi tryout</Label>
              <SelectNative id="tryout-report-session" value={selectedSessionId}
                onChange={(event) => setSelectedSessionId(event.target.value)}>
                <option value="">Semua sesi</option>
                {sessionOptions.map((session) => (
                  <option key={session.value} value={session.value}>{session.label}</option>
                ))}
              </SelectNative>
            </div>
            <Button type="button" onClick={() => {
              setError('');
              setAppliedSessionId(selectedSessionId);
            }}>
              Cari/Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Unduh Laporan</CardTitle></CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={() => setDownloadOpen(true)}>
            Unduh Excel
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Pilih tryout di popup unduhan. Filter jenjang dan sesi tetap diterapkan.
          </p>
        </CardContent>
      </Card>

      <Dialog open={downloadOpen} onClose={() => setDownloadOpen(false)} title="Unduh Laporan Tryout">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tryout-report-name">Nama tryout</Label>
            <Combobox
              id="tryout-report-name"
              value={downloadTryout}
              onChange={setDownloadTryout}
              options={tryoutOptions}
              placeholder="Cari tryout"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDownloadOpen(false)}>Batal</Button>
            <Button type="button" onClick={handleDownload} disabled={downloading}>
              {downloading ? 'Mengunduh…' : 'Unduh laporan'}
            </Button>
          </div>
        </div>
      </Dialog>

      {groupedSessions.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Belum ada sesi dengan submission. Minta peserta mengirim jawaban.</p>
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
            {session.rows.length === 0 && session.attempts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada jawaban pada sesi ini.</p>
            ) : (
              <div className="space-y-5">
                {session.rows.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama</TableHead>
                        <TableHead>Sekolah</TableHead>
                        <TableHead>Mapel</TableHead>
                        <TableHead>Jumlah Soal</TableHead>
                        <TableHead>Benar</TableHead>
                        <TableHead>Salah</TableHead>
                        <TableHead>Nilai</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {session.rows.map((row) => (
                        <TableRow key={`${row.user_id}-${row.mapel_id}`}>
                          <TableCell>{row.participant}</TableCell>
                          <TableCell>{row.sekolah || '—'}</TableCell>
                          <TableCell>{row.mapel}</TableCell>
                          <TableCell>{row.total ?? 0}</TableCell>
                          <TableCell>{row.correct}</TableCell>
                          <TableCell>{row.wrong}</TableCell>
                          <TableCell><strong>{Number(row.score ?? 0).toFixed(1)}</strong></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {session.attempts.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Attempt CBT</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Peserta</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Mulai</TableHead>
                          <TableHead>Deadline</TableHead>
                          <TableHead>Selesai</TableHead>
                          <TableHead>Benar</TableHead>
                          <TableHead>Skor</TableHead>
                          <TableHead>Pelanggaran</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {session.attempts.map((row) => (
                          <TableRow key={row.attempt_id}>
                            <TableCell>{row.participant ?? `#${row.participant_id}`}</TableCell>
                            <TableCell>
                              <Badge variant={row.status === 'submitted' ? 'default' : 'secondary'}>{row.status}</Badge>
                            </TableCell>
                            <TableCell>{displayDateTime(row.started_at)}</TableCell>
                            <TableCell>{displayDateTime(row.deadline_at)}</TableCell>
                            <TableCell>{displayDateTime(row.submitted_at)}</TableCell>
                            <TableCell>{row.correct_count}/{row.question_count}</TableCell>
                            <TableCell><strong>{Number(row.score ?? 0).toFixed(1)}</strong></TableCell>
                            <TableCell>{row.violation_count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {session.violations.length > 0 && (
                  <div>
                    <div className="mb-2 flex justify-end">
                      <Button type="button" variant="link" size="sm" onClick={() => toggleViolations(session.id)}>
                        {openViolations[session.id] ? 'Tutup detail' : 'Lihat detail'}
                      </Button>
                    </div>
                    {openViolations[session.id] && (
                      <div>
                        <h3 className="mb-2 text-sm font-semibold">Log Pelanggaran</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Waktu</TableHead>
                              <TableHead>Peserta</TableHead>
                              <TableHead>Jenis</TableHead>
                              <TableHead>Detail</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {session.violations.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell>{displayDateTime(row.created_at)}</TableCell>
                                <TableCell>{row.participant ?? `#${row.participant_id}`}</TableCell>
                                <TableCell>{row.violation_type}</TableCell>
                                <TableCell>{JSON.stringify(row.detail ?? {})}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </>
  );
}
