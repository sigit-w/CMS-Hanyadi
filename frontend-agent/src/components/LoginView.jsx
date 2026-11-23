import { useState } from 'react';
import { login } from '../api.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

export default function LoginView({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await login(username, password);
      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-lg font-bold">BS</div>
          <h1 className="text-2xl font-semibold tracking-tight">CMS Bank Soal</h1>
          <p className="text-sm text-muted-foreground">Masuk untuk mengelola soal, tryout, dan pengguna.</p>
        </div>
        <Card>
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">Login</CardTitle>
            <CardDescription>Gunakan akun yang diberikan administrator.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && <Alert variant="destructive">{error}</Alert>}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" required autoComplete="username" placeholder="username" value={username}
                  onChange={(event) => setUsername(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" required type="password" autoComplete="current-password" value={password}
                  onChange={(event) => setPassword(event.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
