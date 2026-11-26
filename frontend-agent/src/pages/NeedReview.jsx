import { useCallback, useEffect, useState } from 'react';
import {
  approveResearchSubmission, getJenjangs, getMapels, getResearchSubmission,
  getResearchSubmissions, rejectResearchSubmission
} from '../api.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { SelectNative } from '@/components/ui/select-native';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog } from '@/components/ui/dialog';

const STATUS_LABELS = { need_review: 'Perlu review', approved: 'Disetujui', rejected: 'Ditolak' };
const QUESTION_TYPE_LABELS = {
  multiple_choice: 'Pilihan ganda',
  true_false: 'Benar/Salah',
  multiple_answer: 'Pilihan ganda multi-jawaban',
  short_answer: 'Jawaban singkat',
  essay: 'Esai'
};
const INITIAL_FILTERS = { status: 'need_review', mapel: '', jenjang: '' };
const PAGE_SIZE = 20;

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('id-ID');
}

export default function NeedReview() {
  const [mapels, setMapels] = useState([]);
  const [jenjangs, setJenjangs] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [pagination, setPagination] = useState({ total: 0 });
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [deciding, setDeciding] = useState(null);

  const load = useCallback(async (nextFilters, nextPage) => {
    const data = await getResearchSubmissions({ ...nextFilters, page: nextPage, limit: PAGE_SIZE });
    setSubmissions(data.submissions ?? []);
    setPagination(data.pagination ?? { total: 0 });
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const [mapelData, jenjangData] = await Promise.all([getMapels(), getJenjangs()]);
        if (!active) return;
        setMapels(mapelData.mapels ?? []);
        setJenjangs(jenjangData.jenjangs ?? []);
        await load(INITIAL_FILTERS, 1);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [load]);

  function applyFilter(patch) {
    const next = { ...filters, ...patch };
    setFilters(next);
    setPage(1);
    setError('');
    setNotice('');
    setLoading(true);
    load(next, 1)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function goToPage(nextPage) {
    setPage(nextPage);
    setError('');
    setLoading(true);
    load(filters, nextPage)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function openDetail(item) {
    setDetail(item);
    setDecisionNote('');
    setDetailError('');
    setDetailLoading(true);
    try {
      const data = await getResearchSubmission(item.id);
      setDetail(data.submission);
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetail(null);
    setDetailError('');
    setDecisionNote('');
    setDeciding(null);
  }

  async function decide(action) {
    if (!detail || deciding) return;
    const note = decisionNote.trim();
    if (action === 'reject' && !note) {
      setDetailError('Catatan penolakan wajib diisi.');
      return;
    }
    const label = action === 'approve' ? 'disetujui dan dipublish' : 'ditolak';
    if (!window.confirm(`Draft #${detail.id} akan ${label}. Lanjutkan?`)) return;
    setDeciding(action);
    setDetailError('');
    try {
      const submit = action === 'approve' ? approveResearchSubmission : rejectResearchSubmission;
      const result = await submit(detail.id, note);
      setNotice(action === 'approve'
        ? `Draft #${detail.id} disetujui menjadi soal #${result.question?.id ?? result.submission?.question_id}.`
        : `Draft #${detail.id} ditolak.`);
      closeDetail();
      await load(filters, page);
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDeciding(null);
    }
  }

  const total = pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Need Review — Soal Riset Agent</h1>
        <p className="text-sm text-muted-foreground">Setujui draft hasil riset sebelum soal masuk bank soal dan bisa dipakai tryout.</p>
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filter antrean</CardTitle>
          <CardDescription>Default menampilkan draft yang menunggu keputusan.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2"><Label>Status</Label>
              <SelectNative value={filters.status} onChange={(event) => applyFilter({ status: event.target.value })}>
                <option value="need_review">Perlu review</option>
                <option value="approved">Disetujui</option>
                <option value="rejected">Ditolak</option>
              </SelectNative>
            </div>
            <div className="space-y-2"><Label>Jenjang</Label>
              <SelectNative value={filters.jenjang} onChange={(event) => applyFilter({ jenjang: event.target.value })}>
                <option value="">Semua jenjang</option>
                {jenjangs.map((jenjang) => <option key={jenjang.id} value={jenjang.kode}>{jenjang.kode}</option>)}
              </SelectNative>
            </div>
            <div className="space-y-2"><Label>Mapel</Label>
              <SelectNative value={filters.mapel} onChange={(event) => applyFilter({ mapel: event.target.value })}>
                <option value="">Semua mapel</option>
                {mapels.map((mapel) => <option key={mapel.id} value={mapel.code}>{mapel.name}</option>)}
              </SelectNative>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <div><CardTitle className="text-base">Antrean Draft</CardTitle><CardDescription>{total} draft ditemukan</CardDescription></div>
          <Badge variant="secondary">{total}</Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-20 w-full" />)}</div>
          ) : submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <p className="text-sm font-medium">Tidak ada draft</p>
              <p className="text-sm text-muted-foreground">Draft baru dari agent riset akan muncul di sini.</p>
            </div>
          ) : (
            <ul className="m-0 list-none divide-y rounded-md border p-0">
              {submissions.map((submission) => (
                <li key={submission.id} className="cursor-pointer p-4 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  tabIndex={0} onClick={() => openDetail(submission)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openDetail(submission);
                    }
                  }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">#{submission.id}</span>
                        <Badge variant="outline">{submission.jenjang_kode ?? '—'}</Badge>
                        <Badge variant="outline">{submission.mapel_name ?? submission.mapel_code ?? '—'}</Badge>
                        <Badge variant={submission.status === 'need_review' ? 'secondary' : submission.status === 'approved' ? 'default' : 'destructive'}>
                          {STATUS_LABELS[submission.status] ?? submission.status}
                        </Badge>
                      </div>
                      <p className="text-sm leading-snug line-clamp-2">{submission.stem}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {QUESTION_TYPE_LABELS[submission.question_type] ?? submission.question_type} · {submission.source_system} · dibuat {formatDate(submission.created_at)}
                      </p>
                      {submission.external_ref && <p className="mt-1 font-mono text-xs text-muted-foreground">ref: {submission.external_ref}</p>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
            <span className="text-xs text-muted-foreground">Halaman {currentPage} dari {totalPages}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={loading || currentPage <= 1}
                onClick={() => goToPage(currentPage - 1)}>Prev</Button>
              <Button type="button" variant="outline" size="sm" disabled={loading || currentPage >= totalPages}
                onClick={() => goToPage(currentPage + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(detail)} onClose={closeDetail} title={`Draft Soal #${detail?.id ?? ''}`}>
        {detailLoading && (
          <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</div>
        )}
        {detailError && <Alert variant="destructive">{detailError}</Alert>}
        {detail && !detailLoading && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{detail.jenjang_kode ?? '—'}</Badge>
              <Badge variant="outline">{detail.mapel_name ?? detail.mapel_code ?? '—'}</Badge>
              <Badge variant={detail.status === 'need_review' ? 'secondary' : detail.status === 'approved' ? 'default' : 'destructive'}>
                {STATUS_LABELS[detail.status] ?? detail.status}
              </Badge>
              <span className="text-xs text-muted-foreground">{QUESTION_TYPE_LABELS[detail.question_type] ?? detail.question_type}</span>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Pertanyaan</div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{detail.stem}</p>
            </div>
            {detail.payload?.options?.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">Pilihan jawaban</div>
                <ul className="space-y-2">
                  {detail.payload.options.map((option) => (
                    <li key={option.key} className={`flex gap-3 rounded-md border p-3 text-sm ${option.is_correct ? 'border-primary bg-primary/5' : ''}`}>
                      <span className="font-mono text-xs text-muted-foreground">{option.key}</span>
                      <span className="whitespace-pre-wrap font-normal">{option.content}</span>
                      {option.is_correct && <Badge variant="secondary" className="ml-auto">Kunci</Badge>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {detail.payload?.statements?.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">Pernyataan</div>
                <ul className="space-y-2">
                  {detail.payload.statements.map((statement, index) => (
                    <li key={`${statement.position ?? index}`} className="flex gap-3 rounded-md border p-3 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{statement.position ?? index + 1}</span>
                      <span className="whitespace-pre-wrap font-normal">{statement.text}</span>
                      <Badge variant={statement.is_correct ? 'secondary' : 'outline'} className="ml-auto">
                        {statement.is_correct ? 'Benar' : 'Salah'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(detail.payload?.answer_text || detail.payload?.explanation) && (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <div className="text-xs font-medium text-muted-foreground">Kunci &amp; pembahasan</div>
                {detail.payload.answer_text && <p className="whitespace-pre-wrap text-sm">{detail.payload.answer_text}</p>}
                {detail.payload.explanation && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{detail.payload.explanation}</p>}
              </div>
            )}
            <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <div>Sumber: {detail.source_system}{detail.external_ref ? ` · ref: ${detail.external_ref}` : ''}</div>
              {detail.source_url && <div><a href={detail.source_url} target="_blank" rel="noreferrer" className="break-all underline">{detail.source_url}</a></div>}
              <div>Dibuat {formatDate(detail.created_at)}{detail.question_id ? ` · soal #${detail.question_id}` : ''}</div>
              {detail.reviewed_at && <div>Diproses {formatDate(detail.reviewed_at)}{detail.decision_note ? ` · catatan: ${detail.decision_note}` : ''}</div>}
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono">{JSON.stringify(detail.metadata ?? {}, null, 2)}</pre>
            </div>
            {detail.status === 'need_review' && (
              <div className="space-y-3 border-t pt-4">
                <div className="space-y-2">
                  <Label>Catatan keputusan {'(wajib untuk penolakan)'}</Label>
                  <Textarea rows="3" value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)}
                    placeholder="Opsional untuk persetujuan, wajib untuk penolakan" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={Boolean(deciding)} onClick={() => decide('approve')}>
                    {deciding === 'approve' ? 'Memproses…' : 'Setujui & Publish'}
                  </Button>
                  <Button type="button" variant="destructive" disabled={Boolean(deciding)} onClick={() => decide('reject')}>
                    {deciding === 'reject' ? 'Memproses…' : 'Tolak'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
