import { useEffect, useState } from 'react';
import {
  createParticipant,
  createTryout,
  deleteTryout,
  downloadTryoutQuestions,
  downloadTryoutQuestionsWithKeys,
  getJenjangs,
  getMapels,
  getParticipantDetail,
  getProspektus,
  getQuestionSheet,
  getQuestionSheets,
  getSiswa,
  getTryout,
  getTryouts,
  markParticipantProspek,
  updateTryout,
  updateTryoutCbt
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
import CredentialCopy from '@/components/CredentialCopy';

const MAPEL_LABELS = {
  MTKA: 'Matematika',
  BIND: 'Bahasa Indonesia',
  IPAS: 'IPAS'
};
const TRYOUT_BASE_URL = 'https://tryout.hanyadi.web.id';

function tryoutUrl(slug) {
  return slug ? `${TRYOUT_BASE_URL}/${slug}` : '—';
}

function tryoutSessionUrls(tryout) {
  return (tryout?.sessions ?? []).map((session) => tryoutUrl(session.slug)).filter((url) => url !== '—');
}

function mapelLabel(code, name) {
  return MAPEL_LABELS[code] ?? name ?? code ?? '—';
}

function tryoutMapelText(tryout) {
  const mapels = Array.isArray(tryout.mapels) ? tryout.mapels : [];
  const labels = mapels.length > 0
    ? mapels.map((mapel) => mapelLabel(mapel.code, mapel.name))
    : [mapelLabel(tryout.mapel_code, tryout.mapel_name ?? tryout.mapel_code)];
  if (mapels.length === 0 && !tryout.mapel_code && !tryout.mapel_name) return '—';
  return [...new Set(labels.filter(Boolean))].join(', ') || '—';
}

function statusVariant(status) {
  if (status === 'berlangsung') return 'default';
  if (status === 'selesai') return 'secondary';
  return 'outline';
}

function jakartaInputDate(offsetHours = 0) {
  const shifted = new Date(Date.now() + (7 + offsetHours) * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

const emptySession = () => ({
  name: '',
  mapel_code: '',
  sheet_ids: [],
  cbt_enabled: false,
  cbt_duration_minutes: 90,
  cbt_shuffle_questions: false,
  cbt_shuffle_options: false,
  cbt_require_fullscreen: true,
  cbt_max_violations: 3
});

const emptyForm = () => ({
  name: '',
  slug: '',
  starts_at: jakartaInputDate(),
  ends_at: jakartaInputDate(2),
  sessions: [emptySession()]
});

const cbtFormFromTryout = (tryout) => ({
  cbt_enabled: Boolean(tryout.cbt_enabled),
  cbt_duration_minutes: tryout.cbt_duration_minutes ?? 90,
  cbt_shuffle_questions: Boolean(tryout.cbt_shuffle_questions),
  cbt_shuffle_options: Boolean(tryout.cbt_shuffle_options),
  cbt_require_fullscreen: Boolean(tryout.cbt_require_fullscreen),
  cbt_max_violations: tryout.cbt_max_violations ?? 3
});

const emptyUmum = () => ({
  nama: '',
  sekolah: '',
  jenjang_id: '',
  wa_orang_tua: ''
});

function waDigits(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}

function sanitizeDownloadName(value) {
  return String(value ?? 'tryout')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || 'tryout';
}

function editFormFromTryout(tryout) {
  const toInput = (value) => (value ? new Date(new Date(value).getTime() - 7 * 60 * 60 * 1000).toISOString().slice(0, 16) : '');
  return {
    name: tryout.name ?? '',
    starts_at: toInput(tryout.starts_at ?? tryout.start_at),
    ends_at: toInput(tryout.ends_at ?? tryout.end_at)
  };
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short'
  });
}

function participantSubtitle(participant, source) {
  const label = source ?? (participant.jenis === 'umum' ? 'Peserta Umum' : 'Siswa');
  if (label === 'Siswa' || label === 'Prospektus') {
    return `${label} · ${participant.email || '—'} · Kelas ${participant.kelas || '—'} · ${participant.sekolah || '—'}`;
  }
  return `${label} · ${participant.sekolah || '—'} · WA ${participant.wa_orang_tua || '—'}`;
}

function ParticipantRows({ rows, onDetail, onRemove, emptyText }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <div className="max-h-56 space-y-2 overflow-y-auto">
      {rows.map((participant) => (
        <div
          key={`${participant.source ?? ''}-${participant.id}`}
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
            <span className="block truncate text-xs text-muted-foreground">
              {participantSubtitle(participant, participant.source)}
            </span>
            {(participant.username || participant.pin_plain || participant.password_plain) && (
              <span className="mt-1 block">
                <CredentialCopy name={participant.nama} username={participant.username} secret={participant.pin_plain || participant.password_plain} label="PIN/password" />
              </span>
            )}
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
  const [sheetsByMapel, setSheetsByMapel] = useState({});
  const [participants, setParticipants] = useState([]);
  const [prospektus, setProspektus] = useState([]);
  const [jenjangs, setJenjangs] = useState([]);
  const [participantJenjangFilter, setParticipantJenjangFilter] = useState('');
  const [sourceLoading, setSourceLoading] = useState(false);
  const [draftParticipants, setDraftParticipants] = useState([]);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [detailParticipant, setDetailParticipant] = useState(null);
  const [tryouts, setTryouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pesertaDialog, setPesertaDialog] = useState(null);
  const [umumTab, setUmumTab] = useState('manual');
  const [participantSearch, setParticipantSearch] = useState('');
  const [umumForm, setUmumForm] = useState(emptyUmum);
  const [umumError, setUmumError] = useState('');
  const [savingPeserta, setSavingPeserta] = useState(false);
  const [cbtTarget, setCbtTarget] = useState(null);
  const [cbtForm, setCbtForm] = useState(cbtFormFromTryout({}));
  const [savingCbt, setSavingCbt] = useState(false);
  const [cbtError, setCbtError] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(editFormFromTryout({}));
  const [editSheets, setEditSheets] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  const draftParticipantRows = selectedParticipants
    .map((id) => draftParticipants.find((participant) => String(participant.id) === String(id)))
    .filter(Boolean);
  const mapelOptions = Array.from(new Map(
    mapels.filter((mapel) => mapel.code).map((mapel) => [mapel.code, mapel])
  ).values());
  const usedMapelCodes = [...new Set(form.sessions.map((session) => session.mapel_code).filter(Boolean))];
  const sheetCodesKey = [...usedMapelCodes].sort().join('|');
  const participantSource = pesertaDialog === 'siswa' || (pesertaDialog === 'umum' && umumTab === 'siswa')
    ? 'siswa'
    : pesertaDialog === 'umum' && umumTab === 'prospektus' ? 'prospektus' : null;
  const sourceRows = participantSource === 'siswa'
    ? participants
    : participantSource === 'prospektus' ? prospektus : [];
  const searchTerm = participantSearch.trim().toLowerCase();
  const filteredSourceRows = sourceRows.filter((participant) => (
    [participant.nama, participant.username, participant.jenjang_kode, participant.email, participant.kelas, participant.sekolah]
      .some((value) => String(value ?? '').toLowerCase().includes(searchTerm))
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
        const [mapelData, participantData, tryoutData, jenjangData] = await Promise.all([
          getMapels(),
          getSiswa(),
          getTryouts(),
          getJenjangs()
        ]);
        if (!active) return;
        setMapels(mapelData.mapels);
        setParticipants(participantData.siswa.filter((participant) => participant.is_active));
        setTryouts(tryoutData.tryouts);
        setJenjangs(jenjangData.jenjangs ?? []);
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
    const codes = sheetCodesKey ? sheetCodesKey.split('|') : [];
    if (codes.length === 0) {
      setSheetsByMapel({});
      return undefined;
    }
    async function loadSheets() {
      try {
        const results = await Promise.all(codes.map(async (code) => {
          const data = await getQuestionSheets({ status: 'active', mapel: code, limit: 100 });
          return [code, data.sheets];
        }));
        if (!active) return;
        setSheetsByMapel(Object.fromEntries(results));
        const available = new Set(results.flatMap(([, list]) => list.map((sheet) => String(sheet.id))));
        setForm((current) => ({
          ...current,
          sessions: current.sessions.map((session) => ({
            ...session,
            sheet_ids: codes.includes(session.mapel_code)
              ? session.sheet_ids.filter((id) => available.has(String(id)))
              : []
          }))
        }));
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
  }, [sheetCodesKey]);

  useEffect(() => {
    if (!participantSource) return undefined;
    let active = true;
    async function loadSource() {
      try {
        setSourceLoading(true);
        const params = {
          search: participantSearch.trim(),
          jenjang_id: participantJenjangFilter || null
        };
        const data = participantSource === 'siswa'
          ? await getSiswa(params)
          : await getProspektus(params);
        if (!active) return;
        if (participantSource === 'siswa') {
          setParticipants((data.siswa ?? []).filter((participant) => participant.is_active));
        } else {
          setProspektus((data.prospektus ?? []).filter((participant) => participant.is_active));
        }
        setError('');
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setSourceLoading(false);
      }
    }
    const timer = window.setTimeout(loadSource, 250);
    const refreshOnVisible = () => { if (!document.hidden) loadSource(); };
    document.addEventListener('visibilitychange', refreshOnVisible);
    window.addEventListener('focus', refreshOnVisible);
    return () => {
      active = false;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refreshOnVisible);
      window.removeEventListener('focus', refreshOnVisible);
    };
  }, [participantSource, participantSearch, participantJenjangFilter]);

  function updateSession(index, patch) {
    setForm((current) => ({
      ...current,
      sessions: current.sessions.map((session, position) => (
        position === index ? { ...session, ...patch } : session
      ))
    }));
  }

  function changeSessionMapel(index, code) {
    updateSession(index, { mapel_code: code, sheet_ids: [] });
  }

  function toggleSessionSheet(index, id) {
    setForm((current) => ({
      ...current,
      sessions: current.sessions.map((session, position) => {
        if (position !== index) return session;
        const sheetId = String(id);
        return {
          ...session,
          sheet_ids: session.sheet_ids.includes(sheetId)
            ? session.sheet_ids.filter((item) => String(item) !== sheetId)
            : [...session.sheet_ids, sheetId]
        };
      })
    }));
  }

  function addSession() {
    setForm((current) => ({ ...current, sessions: [...current.sessions, emptySession()] }));
  }

  function removeSession(index) {
    setForm((current) => ({
      ...current,
      sessions: current.sessions.length === 1
        ? current.sessions
        : current.sessions.filter((_, position) => position !== index)
    }));
  }

  function openPesertaUmum() {
    setUmumForm(emptyUmum());
    setUmumError('');
    setUmumTab('manual');
    setParticipantSearch('');
    setParticipantJenjangFilter('');
    setPesertaDialog('umum');
  }

  function openPesertaSiswa() {
    setParticipantSearch('');
    setParticipantJenjangFilter('');
    setPesertaDialog('siswa');
  }

  async function openParticipantDetail(participant) {
    setDetailParticipant(participant);
    try {
      const data = await getParticipantDetail(participant.id);
      setDetailParticipant(data.participant);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePickParticipant(participant, sourceLabel) {
    setError('');
    setNotice('');
    setSelectedParticipants((current) => (
      current.some((id) => String(id) === String(participant.id))
        ? current : [...current, String(participant.id)]
    ));
    setDraftParticipants((current) => (
      current.some((item) => String(item.id) === String(participant.id))
        ? current : [{ ...participant, source: sourceLabel }, ...current]
    ));
    setPesertaDialog(null);
    setNotice(`${sourceLabel} "${participant.nama}" ditambahkan ke tryout.`);
  }

  async function handleRemoveDraftParticipant(participant) {
    const isProspektus = participant.source === 'Prospektus';
    const isUmum = participant.jenis === 'umum' && !isProspektus;
    const label = isProspektus ? 'Prospektus' : isUmum ? 'Peserta Umum' : 'Siswa';
    const message = isProspektus
      ? `Keluarkan Prospektus "${participant.nama}" dari daftar tryout?`
      : `Keluarkan ${label} "${participant.nama}" dari daftar tryout?`;
    if (!window.confirm(message)) return;
    setError('');
    setNotice('');
    try {
      if (isUmum) await markParticipantProspek(participant.id);
      setSelectedParticipants((current) => current.filter((id) => String(id) !== String(participant.id)));
      setDraftParticipants((current) => current.filter((item) => String(item.id) !== String(participant.id)));
      setNotice(isUmum
        ? `Peserta Umum "${participant.nama}" dipindahkan ke Prospektus.`
        : `${label} "${participant.nama}" dikeluarkan dari tryout.`);
    } catch (err) {
      setError(err.message);
    }
  }

  function isAlreadySelected(participant) {
    return selectedParticipants.some((item) => String(item.id ?? item) === String(participant.id));
  }

  function closePesertaFlow() {
    setPesertaDialog(null);
  }

  async function handleCreateUmum(event) {
    event.preventDefault();
    setUmumError('');
    if (!umumForm.nama.trim() || !umumForm.sekolah.trim() || !umumForm.jenjang_id
      || !waDigits(umumForm.wa_orang_tua)) {
      setUmumError('Lengkapi Nama, Sekolah, Jenjang, dan Nomor WA Orang Tua 8–15 digit.');
      return;
    }
    setSavingPeserta(true);
    try {
      const created = await createParticipant({
        jenis: 'umum',
        nama: umumForm.nama.trim(),
        sekolah: umumForm.sekolah.trim(),
        jenjang_id: Number(umumForm.jenjang_id),
        wa_orang_tua: umumForm.wa_orang_tua.trim()
      });
      const participant = created.participant;
      setDraftParticipants((current) => [
        { ...participant, source: 'Peserta Umum' },
        ...current.filter((item) => item.id !== participant.id)
      ]);
      setSelectedParticipants((current) => (
        current.some((id) => String(id) === String(participant.id))
          ? current : [...current, String(participant.id)]
      ));
      setPesertaDialog(null);
      setNotice(`Peserta Umum "${participant.nama}" ditambahkan. PIN: ${participant.pin_plain || waDigits(umumForm.wa_orang_tua)}`);
    } catch (err) {
      setUmumError(err.message);
    } finally {
      setSavingPeserta(false);
    }
  }

  function validateForm() {
    if (!form.name.trim() || !form.starts_at || !form.ends_at) {
      return 'Lengkapi Nama Tryout, slug jika diinginkan, dan jadwal tryout.';
    }
    if (Date.parse(form.ends_at) <= Date.parse(form.starts_at)) {
      return 'Tanggal & jam selesai harus setelah tanggal & jam mulai.';
    }
    if (form.sessions.length === 0) return 'Tryout harus memiliki minimal satu sesi.';
    const codes = form.sessions.map((session) => session.mapel_code);
    if (codes.some((code) => !code)) return 'Setiap sesi wajib memilih tepat satu mapel.';
    if (new Set(codes).size !== codes.length) return 'Setiap sesi harus memakai mapel yang berbeda.';
    for (const session of form.sessions) {
      if (session.sheet_ids.length === 0) {
        return `Sesi "${mapelLabel(session.mapel_code)}" wajib memilih minimal satu lembar soal.`;
      }
      const duration = Number(session.cbt_duration_minutes);
      if (session.cbt_enabled && (!String(session.cbt_duration_minutes).trim()
        || !Number.isInteger(duration) || duration < 1 || duration > 600)) {
        return 'Durasi CBT tiap sesi harus antara 1 dan 600 menit.';
      }
      const maxViolations = Number(session.cbt_max_violations);
      if (!Number.isInteger(maxViolations) || maxViolations < 0 || maxViolations > 100) {
        return 'Batas pelanggaran tiap sesi harus antara 0 dan 100.';
      }
    }
    return '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      const name = form.name.trim();
      const created = await createTryout({
        name,
        slug: form.slug.trim() || undefined,
        starts_at: form.starts_at,
        ends_at: form.ends_at,
        participant_ids: selectedParticipants.map(Number),
        sessions: form.sessions.map((session) => ({
          name: session.name.trim() || undefined,
          mapel_code: session.mapel_code,
          sheet_ids: session.sheet_ids.map(Number),
          cbt_enabled: session.cbt_enabled,
          cbt_duration_minutes: session.cbt_enabled ? Number(session.cbt_duration_minutes) : null,
          cbt_shuffle_questions: session.cbt_shuffle_questions,
          cbt_shuffle_options: session.cbt_shuffle_options,
          cbt_require_fullscreen: session.cbt_require_fullscreen,
          cbt_max_violations: Number(session.cbt_max_violations)
        }))
      });
      setNotice(`Tryout "${created.tryout.name}" berhasil dibuat. URL peserta per sesi: ${tryoutSessionUrls(created.tryout).join(' · ') || '—'}`);
      setForm(emptyForm());
      setSelectedParticipants([]);
      setDraftParticipants([]);
      await refreshTryouts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function openEditTryout(tryout) {
    setError('');
    setEditError('');
    setEditForm(editFormFromTryout(tryout));
    setEditSheets([]);
    setEditTarget(tryout);
    try {
      const detail = await getTryout(tryout.id);
      const sheetIds = [...new Set((detail.tryout.sessions ?? []).flatMap((session) => session.sheet_ids ?? []))];
      const sheets = await Promise.all(sheetIds.map(async (id) => {
        try {
          const data = await getQuestionSheet(id);
          return data.sheet;
        } catch {
          return null;
        }
      }));
      setEditSheets(sheets.filter(Boolean));
    } catch (err) {
      setEditError(err.message);
    }
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    setEditError('');
    if (!editForm.name.trim() || !editForm.starts_at || !editForm.ends_at) {
      setEditError('Lengkapi nama, tanggal mulai, dan tanggal selesai.');
      return;
    }
    if (Date.parse(editForm.ends_at) <= Date.parse(editForm.starts_at)) {
      setEditError('Tanggal selesai harus setelah tanggal mulai.');
      return;
    }
    setSavingEdit(true);
    try {
      const updated = await updateTryout(editTarget.id, {
        name: editForm.name.trim(),
        starts_at: editForm.starts_at,
        ends_at: editForm.ends_at
      });
      setNotice(`Tryout "${updated.tryout.name}" diperbarui. URL peserta tiap sesi tetap ${tryoutSessionUrls(updated.tryout).join(' · ') || '—'}.`);
      setEditTarget(null);
      await refreshTryouts();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDownloadQuestions(tryout, includeKeys) {
    const key = `${tryout.id}-${includeKeys ? 'keys' : 'soal'}`;
    setError('');
    setDownloadingId(key);
    try {
      const blob = includeKeys
        ? await downloadTryoutQuestionsWithKeys(tryout.id)
        : await downloadTryoutQuestions(tryout.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sanitizeDownloadName(tryout.name)}-${includeKeys ? 'soal-dan-kunci' : 'soal'}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice(`Unduhan ${includeKeys ? 'soal dan kunci' : 'soal'} tryout "${tryout.name}" siap.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingId(null);
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

  function openCbtSettings(tryout) {
    setCbtError('');
    setCbtTarget(tryout);
    setCbtForm(cbtFormFromTryout(tryout));
  }

  async function handleSaveCbt() {
    if (!cbtTarget) return;
    setCbtError('');
    if (cbtForm.cbt_enabled && (!Number.isInteger(Number(cbtForm.cbt_duration_minutes))
      || Number(cbtForm.cbt_duration_minutes) < 1 || Number(cbtForm.cbt_duration_minutes) > 600)) {
      setCbtError('Durasi CBT harus antara 1 dan 600 menit.');
      return;
    }
    setSavingCbt(true);
    try {
      const updated = await updateTryoutCbt(cbtTarget.id, {
        cbt_enabled: cbtForm.cbt_enabled,
        cbt_duration_minutes: cbtForm.cbt_enabled ? Number(cbtForm.cbt_duration_minutes) : null,
        cbt_shuffle_questions: cbtForm.cbt_shuffle_questions,
        cbt_shuffle_options: cbtForm.cbt_shuffle_options,
        cbt_require_fullscreen: cbtForm.cbt_require_fullscreen,
        cbt_max_violations: Number(cbtForm.cbt_max_violations)
      });
      setNotice(`Pengaturan CBT "${updated.tryout.name}" tersimpan.`);
      setCbtTarget(null);
      await refreshTryouts();
    } catch (err) {
      setCbtError(err.message);
    } finally {
      setSavingCbt(false);
    }
  }

  async function handleCopyUrl(session, tryoutName) {
    const url = tryoutUrl(session.slug);
    try {
      await navigator.clipboard.writeText(url);
      setError('');
      setNotice(`URL sesi "${session.name || tryoutName}" disalin: ${url}`);
    } catch (err) {
      setError(`Gagal menyalin URL: ${err.message}`);
    }
  }

  function renderSourcePicker(sourceLabel) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SelectNative className="max-w-[180px]" value={participantJenjangFilter}
            onChange={(event) => setParticipantJenjangFilter(event.target.value)}>
            <option value="">Semua jenjang</option>
            {jenjangs.map((jenjang) => (
              <option key={jenjang.id} value={jenjang.id}>{jenjang.kode} — {jenjang.nama}</option>
            ))}
          </SelectNative>
          <Input
            className="flex-1"
            value={participantSearch}
            placeholder={`Cari nama, email, kelas, atau sekolah ${sourceLabel.toLowerCase()}`}
            onChange={(event) => setParticipantSearch(event.target.value)}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => {
            setParticipantSearch('');
            setParticipantJenjangFilter('');
          }}>
            Bersihkan
          </Button>
        </div>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {sourceLoading && filteredSourceRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Memuat data {sourceLabel.toLowerCase()}…</p>
          ) : filteredSourceRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {sourceRows.length === 0
                ? `Belum ada ${sourceLabel.toLowerCase()} yang tersedia.`
                : `Tidak ada ${sourceLabel.toLowerCase()} yang cocok dengan pencarian.`}
            </p>
          ) : filteredSourceRows.map((participant) => (
            <div key={`${sourceLabel}-${participant.id}`} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
              <span className="min-w-0">
                <strong className="block truncate">{participant.nama}</strong>
                <span className="block truncate text-xs text-muted-foreground">
                  {participantSubtitle(participant, sourceLabel)}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                disabled={savingPeserta || isAlreadySelected(participant)}
                onClick={() => handlePickParticipant(participant, sourceLabel)}
              >
                {isAlreadySelected(participant) ? 'Dipilih' : savingPeserta ? 'Menambahkan…' : 'Pilih'}
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Pencarian dijalankan di server dan disaring kembali di halaman ini.
        </p>
      </div>
    );
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Manajemen Tryout</h1>
        <p className="text-sm text-muted-foreground">Buat Tryout baru, tentukan jadwal, sesi/mapel, lembar soal, dan peserta yang diundang.</p>
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
                <Input value={form.name} maxLength={128} placeholder="Contoh: Tryout November"
                  onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Slug Grup Tryout (opsional, bukan URL peserta)</Label>
                <Input value={form.slug} placeholder="contoh: tryout-november"
                  onChange={(event) => setForm({ ...form, slug: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal &amp; Jam Mulai</Label>
                <Input type="datetime-local" value={form.starts_at}
                  onChange={(event) => setForm({ ...form, starts_at: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal &amp; Jam Selesai</Label>
                <Input type="datetime-local" value={form.ends_at}
                  onChange={(event) => setForm({ ...form, ends_at: event.target.value })} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Sesi Tryout ({form.sessions.length})</h2>
                <Button type="button" variant="outline" size="sm" onClick={addSession}>Tambah Sesi</Button>
              </div>
              {form.sessions.map((session, index) => {
                const sheetOptions = (sheetsByMapel[session.mapel_code] ?? []).map((sheet) => ({
                  ...sheet,
                  id: String(sheet.id),
                  sheetMapelCode: sheet.mapel_code ?? session.mapel_code
                }));
                return (
                  <fieldset key={index} className="space-y-4 rounded-lg border p-4">
                    <legend className="px-1 text-sm font-semibold">Sesi {index + 1}</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Nama Sesi (opsional)</Label>
                        <Input value={session.name} maxLength={128} placeholder={`Sesi ${index + 1}`}
                          onChange={(event) => updateSession(index, { name: event.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Mapel (tepat satu)</Label>
                        <SelectNative value={session.mapel_code}
                          onChange={(event) => changeSessionMapel(index, event.target.value)}>
                          <option value="">Pilih mapel</option>
                          {mapelOptions.map((mapel) => {
                            const usedElsewhere = usedMapelCodes.includes(mapel.code) && session.mapel_code !== mapel.code;
                            return (
                              <option key={mapel.code} value={mapel.code} disabled={usedElsewhere}>
                                {mapelLabel(mapel.code, mapel.name)}{usedElsewhere ? ' (dipakai sesi lain)' : ''}
                              </option>
                            );
                          })}
                        </SelectNative>
                        {mapelOptions.length === 0 && (
                          <p className="text-xs text-muted-foreground">Belum ada mapel tersedia.</p>
                        )}
                      </div>
                    </div>

                    <fieldset className="rounded-lg border p-4">
                      <legend className="px-1 text-sm font-semibold">
                        Lembar Soal ({session.sheet_ids.length} dipilih)
                      </legend>
                      {!session.mapel_code ? (
                        <p className="text-sm text-muted-foreground">Pilih mapel pada sesi ini untuk memuat lembar soal.</p>
                      ) : sheetOptions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Belum ada lembar soal aktif pada mapel sesi ini.</p>
                      ) : (
                        <div className="max-h-56 space-y-2 overflow-y-auto">
                          {sheetOptions.map((sheet) => (
                            <label className="flex items-start gap-2 rounded-md border p-2 text-sm hover:bg-muted/40" key={sheet.id}>
                              <Checkbox className="mt-0.5" checked={session.sheet_ids.includes(sheet.id)}
                                onChange={() => toggleSessionSheet(index, sheet.id)} />
                              <span>
                                <strong>{sheet.name}</strong> <span className="text-muted-foreground">({sheet.code})</span>
                                <span className="block text-xs text-muted-foreground">
                                  {mapelLabel(sheet.sheetMapelCode)} · {sheet.question_count} soal · {sheet.duration_minutes ? `${sheet.duration_minutes} menit` : 'durasi bebas'}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </fieldset>

                    <fieldset className="rounded-lg border p-4">
                      <legend className="px-1 text-sm font-semibold">Mode CBT Sesi Ini</legend>
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={session.cbt_enabled}
                            onChange={(event) => updateSession(index, { cbt_enabled: event.target.checked })} />
                          Aktifkan CBT untuk sesi ini
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label>Durasi (menit)</Label>
                            <Input type="number" min={1} max={600} disabled={!session.cbt_enabled}
                              value={session.cbt_duration_minutes}
                              onChange={(event) => updateSession(index, { cbt_duration_minutes: event.target.value })} />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Batas Pelanggaran</Label>
                            <Input type="number" min={0} max={100} value={session.cbt_max_violations}
                              onChange={(event) => updateSession(index, { cbt_max_violations: event.target.value })} />
                            <p className="text-xs text-muted-foreground">0 = tanpa batas; pelanggaran ke-N+1 mengumpulkan jawaban otomatis.</p>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked={session.cbt_shuffle_questions}
                              onChange={(event) => updateSession(index, { cbt_shuffle_questions: event.target.checked })} />
                            Acak urutan soal
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked={session.cbt_shuffle_options}
                              onChange={(event) => updateSession(index, { cbt_shuffle_options: event.target.checked })} />
                            Acak opsi/pernyataan
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked={session.cbt_require_fullscreen}
                              onChange={(event) => updateSession(index, { cbt_require_fullscreen: event.target.checked })} />
                            Wajib fullscreen
                          </label>
                        </div>
                      </div>
                    </fieldset>

                    {form.sessions.length > 1 && (
                      <div className="flex justify-end">
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeSession(index)}>
                          <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Hapus Sesi
                        </Button>
                      </div>
                    )}
                  </fieldset>
                );
              })}
            </div>

            <fieldset className="rounded-lg border p-4">
              <legend className="px-1 text-sm font-semibold">Peserta Umum ({selectedParticipants.length} dipilih, opsional)</legend>
              <ParticipantRows
                rows={draftParticipantRows}
                onDetail={openParticipantDetail}
                onRemove={handleRemoveDraftParticipant}
                emptyText="Belum ada peserta terpilih. Peserta tidak wajib diisi."
              />
              <div className="mt-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setPesertaDialog('choice')}>
                  Tambah Peserta Umum
                </Button>
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Menyimpan…' : 'Simpan Tryout'}
              </Button>
              <span className="text-xs text-muted-foreground">Tiap sesi wajib memiliki satu mapel dan minimal satu lembar soal; peserta opsional.</span>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={pesertaDialog === 'choice'} onClose={() => setPesertaDialog(null)} title="Tambah Peserta Umum">
        <p className="mb-4 text-sm text-muted-foreground">Pilih jenis peserta yang akan ditambahkan ke tryout ini.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="button" variant="outline" className="h-auto flex-col items-start p-4 text-left" onClick={openPesertaSiswa}>
            <span className="font-semibold">A. Peserta Didik</span>
            <span className="text-xs text-muted-foreground">Pilih siswa dari Kelola Siswa</span>
          </Button>
          <Button type="button" variant="outline" className="h-auto flex-col items-start p-4 text-left" onClick={openPesertaUmum}>
            <span className="font-semibold">B. Peserta Umum</span>
            <span className="text-xs text-muted-foreground">Isi data baru atau pilih siswa/prospektus</span>
          </Button>
        </div>
      </Dialog>

      <Dialog open={pesertaDialog === 'siswa'} onClose={closePesertaFlow} title="A. Peserta Didik">
        <p className="mb-3 text-sm text-muted-foreground">Pilih siswa dari data Kelola Siswa untuk dilampirkan ke tryout ini.</p>
        {renderSourcePicker('Siswa')}
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="ghost" onClick={closePesertaFlow}>Selesai</Button>
        </div>
      </Dialog>

      <Dialog open={pesertaDialog === 'umum'} onClose={closePesertaFlow} title="B. Peserta Umum">
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          {[
            { key: 'manual', label: 'Form Manual' },
            { key: 'siswa', label: 'Dari Siswa' },
            { key: 'prospektus', label: 'Dari Prospektus' }
          ].map((tab) => (
            <Button
              key={tab.key}
              type="button"
              variant={umumTab === tab.key ? 'default' : 'outline'}
              size="sm"
              role="tab"
              aria-selected={umumTab === tab.key}
              onClick={() => { setUmumTab(tab.key); setParticipantSearch(''); }}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        {umumTab === 'manual' && (
          <>
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
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closePesertaFlow}>Batal</Button>
                <Button type="submit" disabled={savingPeserta}>
                  {savingPeserta ? 'Menyimpan…' : 'Simpan Peserta'}
                </Button>
              </div>
            </form>
          </>
        )}
        {(umumTab === 'siswa' || umumTab === 'prospektus') && renderSourcePicker(
          umumTab === 'siswa' ? 'Siswa' : 'Prospektus'
        )}
        {(umumTab === 'siswa' || umumTab === 'prospektus') && (
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="ghost" onClick={closePesertaFlow}>Selesai</Button>
          </div>
        )}
      </Dialog>

      <Dialog open={Boolean(detailParticipant)} onClose={() => setDetailParticipant(null)} title="Detail Peserta Umum">
        {detailParticipant && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Nama</span><strong>{detailParticipant.nama}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Kredensial</span><CredentialCopy name={detailParticipant.nama} username={detailParticipant.username} secret={detailParticipant.pin_plain || detailParticipant.password_plain} label="PIN/password" /></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Jenjang</span><span>{detailParticipant.jenjang_kode ? `${detailParticipant.jenjang_kode} — ${detailParticipant.jenjang_nama || ''}`.trim() : '-'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Jenis</span><span>{detailParticipant.jenis === 'umum' ? 'Peserta Umum' : 'Peserta Didik'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Sekolah</span><span>{detailParticipant.sekolah || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Kelas</span><span>{detailParticipant.jenis === 'umum' ? '—' : detailParticipant.kelas || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Program Belajar</span><span>{detailParticipant.program_belajar_name || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Email</span><span>{detailParticipant.email || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">WA Orang Tua</span><span>{detailParticipant.wa_orang_tua || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Submission</span><span>{detailParticipant.submission_count ?? 0}</span></div>
          </div>
        )}
      </Dialog>

      <Dialog open={Boolean(editTarget)} onClose={() => setEditTarget(null)} title="Ubah Tryout">
        {editError && <Alert variant="destructive">{editError}</Alert>}
        {editTarget && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Status saat ini: <Badge variant={statusVariant(editTarget.status)}>{editTarget.status ?? '—'}</Badge>.
              Mengubah jadwal dapat mengubah status tryout; URL dan JWT peserta tiap sesi tidak berubah.
            </p>
            <div className="space-y-1.5">
              <Label>Nama Tryout</Label>
              <Input value={editForm.name} maxLength={128}
                onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tanggal &amp; Jam Mulai</Label>
                <Input type="datetime-local" value={editForm.starts_at}
                  onChange={(event) => setEditForm({ ...editForm, starts_at: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal &amp; Jam Selesai</Label>
                <Input type="datetime-local" value={editForm.ends_at}
                  onChange={(event) => setEditForm({ ...editForm, ends_at: event.target.value })} />
              </div>
            </div>
            <fieldset className="space-y-2 rounded-lg border p-4">
              <legend className="px-1 text-sm font-semibold">Sesi, Mapel, dan Peserta (tidak dapat diubah)</legend>
              {(editTarget.sessions ?? []).map((session) => (
                <div key={session.id} className="flex flex-wrap justify-between gap-2 text-sm">
                  <span>{session.name || 'Sesi tanpa nama'}</span>
                  <span className="text-muted-foreground">
                    {mapelLabel(session.mapel_code, session.mapel_name)} · {session.participant_ids?.length ?? 0} peserta · {tryoutUrl(session.slug)}
                  </span>
                </div>
              ))}
              {(editTarget.sessions ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Tidak ada sesi.</p>
              )}
            </fieldset>
            <fieldset className="space-y-2 rounded-lg border p-4">
              <legend className="px-1 text-sm font-semibold">Lembar Soal yang Dipakai</legend>
              {editSheets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada lembar soal terlampir.</p>
              ) : editSheets.map((sheet) => (
                <div key={sheet.id} className="flex flex-wrap justify-between gap-2 text-sm">
                  <span>{sheet.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{sheet.code}</span>
                </div>
              ))}
            </fieldset>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditTarget(null)}>Batal</Button>
              <Button type="button" onClick={handleSaveEdit} disabled={savingEdit}>
                {savingEdit ? 'Menyimpan…' : 'Simpan Perubahan'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={Boolean(cbtTarget)} onClose={() => setCbtTarget(null)} title="Pengaturan CBT Tryout">
        {cbtError && <Alert variant="destructive">{cbtError}</Alert>}
        <div className="mt-3 space-y-4">
          <p className="text-sm text-muted-foreground">{cbtTarget?.name}</p>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={cbtForm.cbt_enabled}
              onChange={(event) => setCbtForm({ ...cbtForm, cbt_enabled: event.target.checked })} />
            Aktifkan mode CBT
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Durasi (menit)</Label>
              <Input type="number" min={1} max={600} disabled={!cbtForm.cbt_enabled}
                value={cbtForm.cbt_duration_minutes}
                onChange={(event) => setCbtForm({ ...cbtForm, cbt_duration_minutes: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Batas Pelanggaran</Label>
              <Input type="number" min={0} max={100} value={cbtForm.cbt_max_violations}
                onChange={(event) => setCbtForm({ ...cbtForm, cbt_max_violations: event.target.value })} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={cbtForm.cbt_shuffle_questions}
                onChange={(event) => setCbtForm({ ...cbtForm, cbt_shuffle_questions: event.target.checked })} />
              Acak soal
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={cbtForm.cbt_shuffle_options}
                onChange={(event) => setCbtForm({ ...cbtForm, cbt_shuffle_options: event.target.checked })} />
              Acak opsi
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={cbtForm.cbt_require_fullscreen}
                onChange={(event) => setCbtForm({ ...cbtForm, cbt_require_fullscreen: event.target.checked })} />
              Wajib fullscreen
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCbtTarget(null)}>Batal</Button>
            <Button type="button" onClick={handleSaveCbt} disabled={savingCbt}>
              {savingCbt ? 'Menyimpan…' : 'Simpan Pengaturan'}
            </Button>
          </div>
        </div>
      </Dialog>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <CardTitle className="text-base">Daftar Tryout</CardTitle>
          <Badge variant="secondary">{tryouts.length} tryout</Badge>
        </CardHeader>
        <CardContent>
          {tryouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada tryout.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>URL Peserta per Sesi</TableHead>
                  <TableHead>Mulai</TableHead>
                  <TableHead>Selesai</TableHead>
                  <TableHead>Mapel</TableHead>
                  <TableHead>Soal</TableHead>
                  <TableHead>Peserta</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tryouts.map((tryout) => (
                  <TableRow key={tryout.id}>
                    <TableCell>#{tryout.id} {tryout.name}</TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        {(tryout.sessions ?? []).length === 0 && (
                          <span className="text-xs text-muted-foreground">Tidak ada sesi</span>
                        )}
                        {(tryout.sessions ?? []).map((session) => (
                          <div key={session.id} className="flex items-center gap-2">
                            <Input aria-label={`URL sesi ${session.name || tryout.name}`} value={tryoutUrl(session.slug)} readOnly className="h-8 w-56 text-xs" />
                            <Button type="button" variant="outline" size="sm" onClick={() => handleCopyUrl(session, tryout.name)}>
                              Salin
                            </Button>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{formatDateTime(tryout.starts_at ?? tryout.start_at)}</TableCell>
                    <TableCell>{formatDateTime(tryout.ends_at ?? tryout.end_at)}</TableCell>
                    <TableCell>{tryoutMapelText(tryout)}</TableCell>
                    <TableCell>{tryout.question_count}</TableCell>
                    <TableCell>{tryout.participant_count}</TableCell>
                    <TableCell>
                      <Badge variant={tryout.cbt_enabled ? 'default' : 'secondary'}>
                        {tryout.cbt_enabled ? `CBT ${tryout.cbt_duration_minutes}m` : 'Tryout'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(tryout.status)}>{tryout.status ?? '—'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => openEditTryout(tryout)}>
                          Ubah
                        </Button>
                        <Button type="button" variant="outline" size="sm"
                          disabled={downloadingId === `${tryout.id}-soal`}
                          onClick={() => handleDownloadQuestions(tryout, false)}>
                          {downloadingId === `${tryout.id}-soal` ? 'Mengunduh…' : 'Unduh Soal'}
                        </Button>
                        <Button type="button" variant="outline" size="sm"
                          disabled={downloadingId === `${tryout.id}-keys`}
                          onClick={() => handleDownloadQuestions(tryout, true)}>
                          {downloadingId === `${tryout.id}-keys` ? 'Mengunduh…' : 'Unduh Soal + Kunci'}
                        </Button>
                        <Button type="button" variant="outline" size="sm"
                          onClick={() => { window.location.hash = `#/tryouts/${tryout.id}/peserta`; }}>
                          Kelola Peserta
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => openCbtSettings(tryout)}>
                          Atur CBT
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
