import { useEffect, useState } from 'react';
import {
  addTryoutParticipants,
  createParticipant,
  createTryout,
  deleteTryout,
  getMapels,
  getParticipantDetail,
  getQuestionSheets,
  getSiswa,
  getTryout,
  getTryoutParticipants,
  getTryouts,
  markParticipantProspek,
  removeTryoutParticipant,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const MAPEL_LABELS = {
  MTKA: 'Matematika',
  BIND: 'Bahasa Indonesia',
  IPAS: 'IPAS'
};
const TRYOUT_BASE_URL = 'https://tryout.hanyadi.web.id';

function tryoutUrl(slug) {
  return slug ? `${TRYOUT_BASE_URL}/${slug}` : '—';
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

function jakartaInputDate(offsetHours = 0) {
  const shifted = new Date(Date.now() + (7 + offsetHours) * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

const emptyForm = () => ({
  name: '',
  start_at: jakartaInputDate(),
  end_at: jakartaInputDate(2),
  mapel_codes: [],
  is_active: true,
  cbt_enabled: false,
  cbt_duration_minutes: 90,
  cbt_shuffle_questions: false,
  cbt_shuffle_options: false,
  cbt_require_fullscreen: true,
  cbt_max_violations: 3
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
  const [sheetsByMapel, setSheetsByMapel] = useState({});
  const [participants, setParticipants] = useState([]);
  const [siswaLoading, setSiswaLoading] = useState(false);
  const [draftParticipants, setDraftParticipants] = useState([]);
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
  const [participantTarget, setParticipantTarget] = useState('draft');
  const [umumForm, setUmumForm] = useState(emptyUmum);
  const [umumError, setUmumError] = useState('');
  const [savingPeserta, setSavingPeserta] = useState(false);
  const [siswaSearch, setSiswaSearch] = useState('');
  const [cbtTarget, setCbtTarget] = useState(null);
  const [cbtForm, setCbtForm] = useState(cbtFormFromTryout({}));
  const [savingCbt, setSavingCbt] = useState(false);
  const [cbtError, setCbtError] = useState('');

  const draftParticipantRows = selectedParticipants
    .map((id) => draftParticipants.find((participant) => String(participant.id) === String(id)))
    .filter(Boolean);
  const mapelOptions = Array.from(new Map(
    mapels.filter((mapel) => mapel.code).map((mapel) => [mapel.code, mapel])
  ).values());
  const sheetMapelById = new Map();
  Object.entries(sheetsByMapel).forEach(([code, list]) => {
    list.forEach((sheet) => sheetMapelById.set(String(sheet.id), code));
  });
  const seenSheetIds = new Set();
  const sheetOptions = form.mapel_codes.flatMap((code) => (sheetsByMapel[code] ?? [])
    .map((sheet) => ({ ...sheet, id: String(sheet.id), sheetMapelCode: sheet.mapel_code ?? code }))
    .filter((sheet) => {
      if (!sheet.id || seenSheetIds.has(sheet.id)) return false;
      seenSheetIds.add(sheet.id);
      return true;
    }));
  const siswaRows = participants.filter((participant) => (
    String(participant.nama ?? '').toLowerCase().includes(siswaSearch.trim().toLowerCase())
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
          getSiswa(),
          getTryouts()
        ]);
        if (!active) return;
        setMapels(mapelData.mapels);
        setParticipants(participantData.siswa.filter((participant) => participant.is_active));
        setTryouts(tryoutData.tryouts);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const mapelCodesKey = form.mapel_codes.join('|');

  useEffect(() => {
    let active = true;
    const codes = mapelCodesKey ? mapelCodesKey.split('|') : [];
    if (codes.length === 0) {
      setSheetsByMapel({});
      setSelectedSheets([]);
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
  }, [mapelCodesKey]);

  useEffect(() => {
    if (pesertaDialog !== 'siswa') return undefined;
    let active = true;
    setSiswaLoading(true);
    async function loadSiswa() {
      try {
        const data = await getSiswa();
        if (!active) return;
        setParticipants((data.siswa ?? []).filter((participant) => participant.is_active));
        setError('');
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setSiswaLoading(false);
      }
    }
    loadSiswa();
    const refreshOnVisible = () => { if (!document.hidden) loadSiswa(); };
    document.addEventListener('visibilitychange', refreshOnVisible);
    window.addEventListener('focus', refreshOnVisible);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', refreshOnVisible);
      window.removeEventListener('focus', refreshOnVisible);
    };
  }, [pesertaDialog]);

  function toggleMapel(code) {
    const nextMapels = form.mapel_codes.includes(code)
      ? form.mapel_codes.filter((item) => item !== code)
      : [...form.mapel_codes, code];
    setForm({ ...form, mapel_codes: nextMapels });
    if (nextMapels.length < form.mapel_codes.length) {
      setSelectedSheets((current) => current.filter((id) => nextMapels.includes(sheetMapelById.get(id))));
    }
  }

  function toggleValue(value, setter) {
    setter((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
  }

  function openPesertaUmum(target = 'draft') {
    setUmumForm(emptyUmum());
    setUmumError('');
    setParticipantTarget(target);
    setPesertaDialog('umum');
  }

  function openPesertaSiswa(target = 'draft') {
    setSiswaSearch('');
    setParticipantTarget(target);
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

  async function handlePickSiswa(participant) {
    setError('');
    setNotice('');
    if (participantTarget === 'manage') {
      try {
        setSavingPeserta(true);
        await addTryoutParticipants(managedTryoutId, [participant.id]);
        await loadManagedParticipants(managedTryoutId);
        await refreshTryouts();
        setNotice(`Siswa "${participant.nama}" ditambahkan ke tryout ini.`);
        setPesertaDialog('manage');
      } catch (err) {
        setError(err.message);
      } finally {
        setSavingPeserta(false);
      }
      return;
    }
    setSelectedParticipants((current) => (
      current.includes(String(participant.id)) ? current : [...current, String(participant.id)]
    ));
    setDraftParticipants((current) => (
      current.some((item) => String(item.id) === String(participant.id))
        ? current : [participant, ...current]
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
      setDraftParticipants((current) => current.filter((item) => String(item.id) !== String(participant.id)));
      setNotice(isUmum
        ? `Peserta Umum "${participant.nama}" dipindahkan ke Prospektus.`
        : `Siswa "${participant.nama}" dikeluarkan dari tryout. Data siswa tetap tersimpan.`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadManagedParticipants(tryoutId) {
    const [detail, participantData] = await Promise.all([
      getTryout(tryoutId),
      getTryoutParticipants(tryoutId)
    ]);
    setManagedTryoutId(detail.tryout.id);
    setManagedParticipants(participantData.participants);
  }

  function isAlreadySelected(participant) {
    const source = participantTarget === 'manage' ? managedParticipants : selectedParticipants;
    return source.some((item) => String(item.id ?? item) === String(participant.id));
  }

  function closePesertaFlow() {
    setPesertaDialog(participantTarget === 'manage' ? 'manage' : null);
  }

  async function openManageParticipants(tryout) {
    setError('');
    setNotice('');
    try {
      await loadManagedParticipants(tryout.id);
      setParticipantTarget('manage');
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
      setDraftParticipants((current) => [participant, ...current.filter((item) => item.id !== participant.id)]);
      if (participantTarget === 'manage') {
        await addTryoutParticipants(managedTryoutId, [participant.id]);
        await loadManagedParticipants(managedTryoutId);
        await refreshTryouts();
        setPesertaDialog('manage');
      } else {
        setSelectedParticipants((current) => (
          current.includes(String(participant.id)) ? current : [...current, String(participant.id)]
        ));
        setPesertaDialog(null);
      }
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
    if (!form.name.trim() || !form.start_at || !form.end_at || form.mapel_codes.length === 0
      || selectedSheets.length === 0) {
      setError('Lengkapi Nama Tryout, jadwal, minimal satu mapel, dan minimal satu lembar soal.');
      return;
    }
    if (Date.parse(form.end_at) <= Date.parse(form.start_at)) {
      setError('Tanggal & jam selesai harus setelah tanggal & jam mulai.');
      return;
    }
    if (form.cbt_enabled && (!Number.isInteger(Number(form.cbt_duration_minutes))
      || Number(form.cbt_duration_minutes) < 1 || Number(form.cbt_duration_minutes) > 600)) {
      setError('Durasi CBT harus antara 1 dan 600 menit.');
      return;
    }
    setSaving(true);
    try {
      const created = await createTryout({
        name: form.name.trim(),
        start_at: form.start_at,
        end_at: form.end_at,
        mapel_codes: form.mapel_codes,
        sheet_ids: [...new Set(selectedSheets.map(Number))],
        participant_ids: selectedParticipants.map(Number),
        is_active: form.is_active,
        cbt_enabled: form.cbt_enabled,
        cbt_duration_minutes: form.cbt_enabled ? Number(form.cbt_duration_minutes) : null,
        cbt_shuffle_questions: form.cbt_shuffle_questions,
        cbt_shuffle_options: form.cbt_shuffle_options,
        cbt_require_fullscreen: form.cbt_require_fullscreen,
        cbt_max_violations: Number(form.cbt_max_violations)
      });
      setNotice(`Tryout "${created.tryout.name}" berhasil dibuat. URL peserta: ${tryoutUrl(created.tryout.slug)}`);
      setForm(emptyForm());
      setSelectedSheets([]);
      setSelectedParticipants([]);
      setDraftParticipants([]);
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

  async function handleCopyUrl(tryout) {
    const url = tryoutUrl(tryout.slug);
    try {
      await navigator.clipboard.writeText(url);
      setError('');
      setNotice(`URL tryout "${tryout.name}" disalin: ${url}`);
    } catch (err) {
      setError(`Gagal menyalin URL: ${err.message}`);
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
            </div>

            <fieldset className="rounded-lg border p-4">
              <legend className="px-1 text-sm font-semibold">Mapel ({form.mapel_codes.length} dipilih)</legend>
              {mapelOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada mapel tersedia.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {mapelOptions.map((mapel) => (
                    <label className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted/40" key={mapel.code}>
                      <Checkbox className="mt-0.5" checked={form.mapel_codes.includes(mapel.code)}
                        onChange={() => toggleMapel(mapel.code)} />
                      <span>{mapelLabel(mapel.code, mapel.name)}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Pilih minimal satu mapel. Mapel yang sama tidak akan dihitung dua kali.</p>
            </fieldset>

            <fieldset className="rounded-lg border p-4">
              <legend className="px-1 text-sm font-semibold">Lembar Soal ({selectedSheets.length} dipilih)</legend>
              {form.mapel_codes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Pilih minimal satu mapel terlebih dahulu untuk memuat lembar soal.</p>
              ) : sheetOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada lembar soal aktif pada mapel yang dipilih.</p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {sheetOptions.map((sheet) => (
                    <label className="flex items-start gap-2 rounded-md border p-2 text-sm hover:bg-muted/40" key={sheet.id}>
                      <Checkbox className="mt-0.5" checked={selectedSheets.includes(sheet.id)}
                        onChange={() => toggleValue(sheet.id, setSelectedSheets)} />
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
              <legend className="px-1 text-sm font-semibold">Peserta Tryout ({selectedParticipants.length} dipilih, opsional)</legend>
              <ParticipantRows
                rows={draftParticipantRows}
                onDetail={openParticipantDetail}
                onRemove={handleRemoveDraftParticipant}
                emptyText="Belum ada peserta terpilih. Peserta tidak wajib diisi."
              />
              <div className="mt-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setPesertaDialog('choice')}>
                  Tambah Peserta Tryout
                </Button>
              </div>
            </fieldset>

            <fieldset className="rounded-lg border p-4">
              <legend className="px-1 text-sm font-semibold">Mode CBT</legend>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.cbt_enabled}
                    onChange={(event) => setForm({ ...form, cbt_enabled: event.target.checked })} />
                  Aktifkan CBT (timer, submit akhir, autosave, pengawasan)
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Durasi (menit)</Label>
                    <Input type="number" min={1} max={600} disabled={!form.cbt_enabled}
                      value={form.cbt_duration_minutes}
                      onChange={(event) => setForm({ ...form, cbt_duration_minutes: event.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Batas Pelanggaran</Label>
                    <Input type="number" min={0} max={100}
                      value={form.cbt_max_violations}
                      onChange={(event) => setForm({ ...form, cbt_max_violations: event.target.value })} />
                    <p className="text-xs text-muted-foreground">0 = tanpa batas; pelanggaran ke-N+1 mengumpulkan jawaban otomatis.</p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.cbt_shuffle_questions}
                      onChange={(event) => setForm({ ...form, cbt_shuffle_questions: event.target.checked })} />
                    Acak urutan soal
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.cbt_shuffle_options}
                      onChange={(event) => setForm({ ...form, cbt_shuffle_options: event.target.checked })} />
                    Acak opsi/pernyataan
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.cbt_require_fullscreen}
                      onChange={(event) => setForm({ ...form, cbt_require_fullscreen: event.target.checked })} />
                    Wajib fullscreen
                  </label>
                </div>
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

      <Dialog open={pesertaDialog === 'siswa'} onClose={closePesertaFlow} title="A. Peserta Didik">
        <p className="mb-3 text-sm text-muted-foreground">Pilih siswa dari data Kelola Siswa untuk dilampirkan ke tryout ini.</p>
        <Input
          value={siswaSearch}
          placeholder="Cari nama siswa"
          onChange={(event) => setSiswaSearch(event.target.value)}
        />
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {siswaLoading && participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">Memuat data siswa aktif…</p>
          ) : siswaRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {participants.length === 0
                ? 'Belum ada siswa aktif. Tambahkan siswa aktif di menu Kelola Siswa, lalu buka dialog ini lagi.'
                : 'Tidak ada siswa yang cocok dengan pencarian.'}
            </p>
          ) : siswaRows.map((participant) => (
            <div key={participant.id} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
              <span className="min-w-0">
                <strong className="block truncate">{participant.nama}</strong>
                <span className="block truncate text-xs text-muted-foreground">{participantSubtitle(participant)}</span>
              </span>
              <Button
                type="button"
                size="sm"
                disabled={savingPeserta || isAlreadySelected(participant)}
                onClick={() => handlePickSiswa(participant)}
              >
                {isAlreadySelected(participant) ? 'Dipilih' : savingPeserta ? 'Menambahkan…' : 'Pilih'}
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="ghost" onClick={closePesertaFlow}>Selesai</Button>
        </div>
      </Dialog>

      <Dialog open={pesertaDialog === 'umum'} onClose={closePesertaFlow} title="Tambah Peserta Umum">
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
            <Button type="button" variant="ghost" onClick={closePesertaFlow}>Batal</Button>
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
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Password / PIN</span><strong>{detailParticipant.pin_plain || detailParticipant.password_plain || '—'}</strong></div>
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
            openParticipantDetail(participant);
          }}
          onRemove={handleRemoveManagedParticipant}
          emptyText="Tidak ada peserta pada tryout ini."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Button type="button" variant="outline" className="h-auto flex-col items-start p-4 text-left"
            onClick={() => openPesertaSiswa('manage')}>
            <span className="font-semibold">A. Peserta Didik</span>
            <span className="text-xs text-muted-foreground">Pilih siswa untuk ditambahkan ke tryout ini</span>
          </Button>
          <Button type="button" variant="outline" className="h-auto flex-col items-start p-4 text-left"
            onClick={() => openPesertaUmum('manage')}>
            <span className="font-semibold">B. Peserta Umum</span>
            <span className="text-xs text-muted-foreground">Isi data peserta dan PIN login</span>
          </Button>
        </div>
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
                  <TableHead>URL Tryout</TableHead>
                  <TableHead>Mulai</TableHead>
                  <TableHead>Selesai</TableHead>
                  <TableHead>Mapel</TableHead>
                  <TableHead>Lembar</TableHead>
                  <TableHead>Soal</TableHead>
                  <TableHead>Peserta</TableHead>
                  <TableHead>Submission</TableHead>
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
                      <div className="flex items-center gap-2">
                        <Input aria-label={`URL tryout ${tryout.name}`} value={tryoutUrl(tryout.slug)} readOnly className="h-8 w-56 text-xs" />
                        <Button type="button" variant="outline" size="sm" onClick={() => handleCopyUrl(tryout)}>
                          Salin
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{formatDateTime(tryout.start_at)}</TableCell>
                    <TableCell>{formatDateTime(tryout.end_at)}</TableCell>
                    <TableCell>{tryoutMapelText(tryout)}</TableCell>
                    <TableCell>{tryout.sheet_count ?? '—'}</TableCell>
                    <TableCell>{tryout.question_count}</TableCell>
                    <TableCell>{tryout.participant_count}</TableCell>
                    <TableCell>{tryout.submission_count}</TableCell>
                    <TableCell>
                      <Badge variant={tryout.cbt_enabled ? 'default' : 'secondary'}>
                        {tryout.cbt_enabled ? `CBT ${tryout.cbt_duration_minutes}m` : 'Tryout'}
                      </Badge>
                    </TableCell>
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
