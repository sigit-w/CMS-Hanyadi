import { useEffect, useState } from 'react';
import { createRole, deactivateRole, getPermissions, getRoles, updateRolePermissions } from '../api.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const GROUP_LABELS = {
  cms: 'CMS',
  questions: 'Soal',
  question_sheets: 'Lembar Soal',
  mapels: 'Manajemen Mapel',
  roles: 'Manajemen Role',
  tryout: 'Tryout',
  tryouts: 'Manajemen Tryout',
  participants: 'Siswa & Peserta',
  presentation: 'Penyajian',
  users: 'Pengguna',
  reports: 'Laporan',
  tryout_reports: 'Laporan Tryout',
  program_belajar: 'Program Belajar'
};
const permissionCodes = (role) => role?.permissions ?? [];
const removedRoleCodes = new Set(['editor', 'validator', 'viewer']);
const visibleRoles = (roles) => roles.filter((role) => !removedRoleCodes.has(role.code));

export default function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [checked, setChecked] = useState([]);
  const [newRole, setNewRole] = useState({ code: '', name: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const visiblePermissions = permissions;

  async function load() {
    const [roleData, permissionData] = await Promise.all([getRoles(), getPermissions()]);
    const roles = visibleRoles(roleData.roles);
    setRoles(roles); setPermissions(permissionData.permissions);
    return roles;
  }

  useEffect(() => {
    load().then((roleData) => {
      if (!selectedRoleId && roleData.length) { setSelectedRoleId(roleData[0].id); setChecked(permissionCodes(roleData[0])); }
    }).catch((e) => setError(e.message));
  }, []);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;
  const selectRole = (role) => { setSelectedRoleId(role.id); setChecked(permissionCodes(role)); setError(''); setNotice(''); };
  const togglePermission = (code) => setChecked((p) => p.includes(code) ? p.filter((i) => i !== code) : [...p, code]);

  async function handleCreate(e) {
    e.preventDefault(); setError(''); setNotice('');
    try {
      await createRole(newRole);
      const roleData = await load();
      const roleId = roleData.find((r) => r.code === newRole.code)?.id;
      if (roleId) { setSelectedRoleId(roleId); setChecked([]); }
      setNotice(`Role ${newRole.code} dibuat.`); setNewRole({ code: '', name: '' });
    } catch (err) { setError(err.message); }
  }

  async function handleDeactivate(role) {
    setError(''); setNotice('');
    try { await deactivateRole(role.id); await load(); setNotice(`Role ${role.code} dinonaktifkan`); } catch (err) { setError(err.message); }
  }

  async function handleSave(e) {
    e.preventDefault(); if (!selectedRole) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const payload = [...new Set(checked)];
      const saved = await updateRolePermissions(selectedRole.id, payload);
      setChecked(saved.permissions);
      const roleData = await load();
      const fresh = roleData.find((r) => r.id === selectedRole.id);
      if (fresh) setChecked(permissionCodes(fresh));
      const visibleCount = visiblePermissions.filter((p) => saved.permissions.includes(p.code)).length;
      setNotice(`Hak akses role ${selectedRole.code} diperbarui (${visibleCount} permission terlihat)`);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  const groups = visiblePermissions.reduce((acc, p) => { const key = p.code.split('.')[0]; acc[key] = acc[key] ?? []; acc[key].push(p); return acc; }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kelola Role & Hak Akses</h1>
        <p className="text-sm text-muted-foreground">Atur semua opsi CRUD per role. Perubahan berlaku langsung.</p>
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Card>
        <CardHeader><CardTitle>Buat Role Baru</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={handleCreate}>
            <div className="space-y-2"><Label>Kode role</Label><Input required pattern="[a-z][a-z0-9_]{2,31}" value={newRole.code} placeholder="contoh: auditor" onChange={(e) => setNewRole({ ...newRole, code: e.target.value })} /></div>
            <div className="space-y-2"><Label>Nama role</Label><Input required value={newRole.name} placeholder="Nama tampilan" onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} /></div>
            <Button type="submit">Buat Role</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader><CardTitle>Daftar Role</CardTitle><CardDescription>Pilih role untuk diedit.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {roles.map((role) => (
              <div key={role.id} className={cn('flex items-center gap-2 rounded-lg border p-3 transition-colors', role.id === selectedRoleId ? 'border-primary bg-accent' : 'hover:bg-muted/30')}>
                <button type="button" className="flex-1 text-left" onClick={() => selectRole(role)}>
                  <div className="flex items-center gap-2"><Badge variant={role.id === selectedRoleId ? 'default' : 'secondary'}>{role.code}</Badge>{role.is_system && <span className="text-xs text-muted-foreground">sistem</span>}</div>
                  <div className="text-sm mt-1">{role.name}</div>
                </button>
                {!role.is_system && role.is_active && <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeactivate(role)}>Nonaktifkan</Button>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">Hak Akses {selectedRole && <Badge variant="outline">{selectedRole.code}</Badge>}</CardTitle>
            <CardDescription>{selectedRole ? `Pilih permission untuk role ${selectedRole.name}.` : 'Pilih role di kiri.'}</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedRole ? <p className="text-sm text-muted-foreground">Pilih role untuk mengatur permission.</p> : (
              <form className="space-y-5" onSubmit={handleSave}>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setChecked(visiblePermissions.map((p) => p.code))}>Pilih semua</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setChecked([])}>Kosongkan</Button>
                  <span className="text-xs text-muted-foreground ml-auto">{visiblePermissions.filter((p) => checked.includes(p.code)).length}/{visiblePermissions.length} dipilih</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {Object.entries(groups).map(([group, items]) => (
                    <div key={group} className="rounded-lg border p-4">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{GROUP_LABELS[group] ?? group}</div>
                      <div className="space-y-3">
                        {items.map((p) => (
                          <label className="flex items-start gap-3 text-sm" key={p.code}>
                            <Checkbox className="mt-0.5" checked={checked.includes(p.code)} onChange={() => togglePermission(p.code)} />
                            <span><code className="text-xs bg-muted px-1 py-0.5 rounded">{p.code}</code><span className="block text-xs text-muted-foreground mt-0.5">{p.description}</span></span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan Hak Akses'}</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
