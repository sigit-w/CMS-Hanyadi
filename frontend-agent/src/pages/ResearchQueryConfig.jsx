import { useEffect, useState } from 'react';
import {
  getJenjangs, getMapels, getResearchAgentUsage, getResearchQueryConfig,
  updateResearchQueryConfig
} from '../api.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SelectNative } from '@/components/ui/select-native';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert } from '@/components/ui/alert';

const EMPTY_FORM = {
  queries: '', mapel: 'IPAS', jenjang: 'SD', max_questions: 3,
  is_enabled: true, max_searches: 2, max_results_per_query: 3,
  max_output_tokens: 1200, max_runs_per_month: 25
};

function toForm(config) {
  if (!config) return EMPTY_FORM;
  return {
    queries: config.queries.join('\n'),
    mapel: config.mapel,
    jenjang: config.jenjang,
    max_questions: config.max_questions,
    is_enabled: config.is_enabled,
    max_searches: config.max_searches,
    max_results_per_query: config.max_results_per_query,
    max_output_tokens: config.max_output_tokens,
    max_runs_per_month: config.max_runs_per_month
  };
}

export default function ResearchQueryConfig() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [mapels, setMapels] = useState([]);
  const [jenjangs, setJenjangs] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const [configData, mapelData, jenjangData, usageData] = await Promise.all([
      getResearchQueryConfig(),
      getMapels({ include_inactive: true }),
      getJenjangs({ include_inactive: true }),
      getResearchAgentUsage()
    ]);
    setForm(toForm(configData.config));
    setUpdatedAt(configData.config.updated_at);
    setUsage(usageData);
    setMapels(mapelData.mapels.filter((item) => item.is_active));
    setJenjangs(jenjangData.jenjangs.filter((item) => item.is_active));
  }

  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await updateResearchQueryConfig({
        queries: form.queries,
        mapel: form.mapel,
        jenjang: form.jenjang,
        max_questions: Number(form.max_questions),
        is_enabled: form.is_enabled,
        max_searches: Number(form.max_searches),
        max_results_per_query: Number(form.max_results_per_query),
        max_output_tokens: Number(form.max_output_tokens),
        max_runs_per_month: Number(form.max_runs_per_month)
      });
      setForm(toForm(saved.config));
      setUpdatedAt(saved.config.updated_at);
      setUsage(await getResearchAgentUsage());
      setNotice('Konfigurasi query research agent tersimpan. n8n akan memakainya pada siklus berikutnya.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Query Research Agent</h1>
        <p className="text-sm text-muted-foreground">
          Atur topik yang dicari agent, mapel/jenjang default, dan jumlah draft soal. Halaman ini hanya tersedia untuk role dengan permission <code>research_queries.manage</code>.
        </p>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}
      {usage && (
        <Alert>
          Siklus bulan ini: <strong>{usage.usage.runs}</strong> / {usage.limit} · Tavily search {usage.usage.searches} · Soal dibuat {usage.usage.questions} · Sisa {usage.remaining}.
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Konfigurasi riset</CardTitle>
          <CardDescription>
            Satu query per baris; maksimal 10 query. n8n mengambil konfigurasi ini otomatis memakai akun service <code>research_agent</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSave}>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                id="research-enabled"
                checked={form.is_enabled}
                onChange={(event) => setForm({ ...form, is_enabled: event.target.checked })}
              />
              Aktifkan research agent
            </label>
            <p className="-mt-3 text-xs text-muted-foreground">
              Nonaktifkan untuk menghentikan semua siklus tanpa mengubah env atau jadwal n8n.
            </p>

            <div className="space-y-2">
              <Label htmlFor="research-queries">Daftar query</Label>
              <Textarea
                id="research-queries"
                rows={7}
                value={form.queries}
                onChange={(event) => setForm({ ...form, queries: event.target.value })}
                placeholder={'soal SD kelas 4 IPAS energi\nsoal SD kelas 5 Matematika perkalian'}
              />
              <p className="text-xs text-muted-foreground">
                {form.queries.split('\n').filter((item) => item.trim()).length} query terisi.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="research-mapel">Mapel default</Label>
                <SelectNative
                  id="research-mapel"
                  value={form.mapel}
                  onChange={(event) => setForm({ ...form, mapel: event.target.value })}
                >
                  {mapels.map((mapel) => <option key={mapel.id} value={mapel.code}>{mapel.code} — {mapel.name}</option>)}
                </SelectNative>
              </div>
              <div className="space-y-2">
                <Label htmlFor="research-jenjang">Jenjang default</Label>
                <SelectNative
                  id="research-jenjang"
                  value={form.jenjang}
                  onChange={(event) => setForm({ ...form, jenjang: event.target.value })}
                >
                  {jenjangs.map((jenjang) => <option key={jenjang.id} value={jenjang.kode}>{jenjang.kode} — {jenjang.nama}</option>)}
                </SelectNative>
              </div>
              <div className="space-y-2">
                <Label htmlFor="research-max">Maksimal soal per siklus</Label>
                <Input
                  id="research-max"
                  type="number"
                  min={1}
                  max={10}
                  value={form.max_questions}
                  onChange={(event) => setForm({ ...form, max_questions: event.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="research-searches">Maks. Tavily search / siklus</Label>
                <Input
                  id="research-searches"
                  type="number"
                  min={1}
                  max={5}
                  value={form.max_searches}
                  onChange={(event) => setForm({ ...form, max_searches: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="research-results">Hasil / search</Label>
                <Input
                  id="research-results"
                  type="number"
                  min={1}
                  max={10}
                  value={form.max_results_per_query}
                  onChange={(event) => setForm({ ...form, max_results_per_query: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="research-tokens">Maks. output token OpenAI</Label>
                <Input
                  id="research-tokens"
                  type="number"
                  min={300}
                  max={4000}
                  value={form.max_output_tokens}
                  onChange={(event) => setForm({ ...form, max_output_tokens: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="research-runs">Maks. siklus / bulan</Label>
                <Input
                  id="research-runs"
                  type="number"
                  min={1}
                  max={100}
                  value={form.max_runs_per_month}
                  onChange={(event) => setForm({ ...form, max_runs_per_month: event.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan Konfigurasi'}</Button>
              {updatedAt && (
                <span className="text-xs text-muted-foreground">
                  Terakhir diperbarui {new Date(updatedAt).toLocaleString('id-ID')}
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
