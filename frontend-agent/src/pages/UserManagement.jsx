import { useEffect, useState } from 'react';
import { assignRole, createUser, getRoles, getUsers, revokeRole, updateUserPassword } from '../api.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { SelectNative } from '@/components/ui/select-native';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const EMPTY_FORM = { username: '', display_name: '', email: '', password: '', roles: [] };
const EMPTY_PASSWORD_FORM = { password: '', confirm: '' };
const CMS_ROLES = (roles) => roles.filter((role) => role.is_active && role.code !== 'peserta');

export default function UserManagement({ can = () => false }) {
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [passwordUserId, setPasswordUserId] = useState('');
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
  const [selected, setSelected] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    const [roleData, userData] = await Promise.all([getRoles(), getUsers()]);
    setRoles(roleData.roles); setUsers(userData.users);
  }
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  const toggleRole = (code) => setForm((p) => ({ ...p, roles: p.roles.includes(code) ? p.roles.filter((r) => r !== code) : [...p.roles, code] }));

  async function run(action, message) {
    setError(''); setNotice('');
    try { await action(); await load(); setNotice(message); } catch (e) { setError(e.message); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (form.roles.length === 0) { setError('Pilih minimal satu role'); return; }
    const username = form.username;
    await run(async () => { await createUser(form); setForm(EMPTY_FORM); }, `Pengguna ${username} berhasil dibuat`);
  }

  async function handlePasswordChange(e) {
    e.preventDefault(); setError(''); setNotice('');
    if (!passwordUserId) { setError('Pilih pengguna terlebih dahulu'); return; }
    if (passwordForm.password !== passwordForm.confirm) { setError('Konfirmasi password tidak cocok'); return; }
    try {
      const data = await updateUserPassword(passwordUserId, passwordForm.password, passwordForm.confirm);
      setPasswordForm(EMPTY_PASSWORD_FORM); await load();
      setNotice(`Password ${data.user.username} diperbarui. Sesi lama dicabut.`);
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Buat User</h1>
        <p className="text-sm text-muted-foreground">
          Kelola akun CMS dan penugasan role. Siswa tryout dibuat terpisah lewat menu Kelola Siswa.
        </p>
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Buat User Baru</CardTitle><CardDescription>Isi detail akun dan pilih role awal.</CardDescription></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Username</Label><Input required pattern="[a-z0-9_.-]{3,32}" value={form.username} placeholder="contoh: auditor1" onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} /></div>
                <div className="space-y-2"><Label>Nama tampilan</Label><Input required value={form.display_name} placeholder="Nama lengkap" onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Email (opsional)</Label><Input type="email" value={form.email} placeholder="nama@domain" onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Password (min. 12 karakter)</Label><Input required type="password" minLength="12" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Role pengguna</Label>
                <div className="flex flex-wrap gap-3 rounded-md border p-3">
                  {CMS_ROLES(roles).map((role) => (
                    <label className="flex items-center gap-2 text-sm" key={role.id}>
                      <Checkbox checked={form.roles.includes(role.code)} onChange={() => toggleRole(role.code)} />{role.code}
                    </label>
                  ))}
                </div>
              </div>
              <Button type="submit">Buat User</Button>
            </form>
          </CardContent>
        </Card>

        {can('users.password.write') && (
        <Card>
          <CardHeader><CardTitle>Ubah Password</CardTitle><CardDescription>Reset password dan cabut sesi lama pengguna.</CardDescription></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handlePasswordChange}>
              <div className="space-y-2"><Label>Pengguna</Label>
                <SelectNative value={passwordUserId} onChange={(e) => setPasswordUserId(e.target.value)}>
                  <option value="">Pilih pengguna…</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.username} — {u.display_name}</option>)}
                </SelectNative></div>
              <div className="space-y-2"><Label>Password baru</Label><Input required type="password" minLength="12" autoComplete="new-password" value={passwordForm.password} onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })} /></div>
              <div className="space-y-2"><Label>Konfirmasi password</Label><Input required type="password" minLength="12" autoComplete="new-password" value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} /></div>
              <Button type="submit" disabled={!passwordUserId}>Ubah Password</Button>
            </form>
          </CardContent>
        </Card>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Daftar User & Penugasan Role</CardTitle><CardDescription>Klik chip role untuk mencabut, atau pilih role untuk ditambahkan.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Role & Aksi</TableHead></TableRow></TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell><div className="font-medium">{user.username}</div><div className="text-xs text-muted-foreground">{user.display_name}</div></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      {(user.roles ?? []).map((code) => {
                        const role = roles.find((r) => r.code === code);
                        return <Button key={code} type="button" variant="secondary" size="sm" className="h-7 text-xs" title="Klik untuk mencabut role"
                          onClick={() => role && run(() => revokeRole(user.id, role.id), `${code} dicabut dari ${user.username}`)}>{code} ×</Button>;
                      })}
                      <SelectNative className="h-8 w-40" value={selected[user.id] ?? ''} onChange={(e) => setSelected({ ...selected, [user.id]: e.target.value })}>
                        <option value="">Pilih role…</option>
                         {CMS_ROLES(roles).map((r) => <option key={r.id} value={r.code}>{r.code}</option>)}
                      </SelectNative>
                      <Button type="button" size="sm" className="h-8" disabled={!selected[user.id]}
                        onClick={() => run(() => assignRole(user.id, selected[user.id]), `${selected[user.id]} diberikan kepada ${user.username}`)}>Berikan</Button>
                      {can('users.password.write') && <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => { setPasswordUserId(String(user.id)); setPasswordForm(EMPTY_PASSWORD_FORM); }}>Ubah Password</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
