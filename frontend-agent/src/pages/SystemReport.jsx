import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SystemReport() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Laporan Kondisi Sistem</h1>
        <p className="text-sm text-muted-foreground">
          Presentasi inventarisasi server, database, peran agen, domain, CMS, dan halaman pengguna.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Presentasi Sistem</CardTitle>
            <CardDescription>Dokumen laporan-sistem tersemat.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">27 slide</Badge>
            <a className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))} href="/laporan-sistem/index.html" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Buka di tab baru</a>
          </div>
        </CardHeader>
        <CardContent>
          <iframe className="h-[min(72vh,900px)] min-h-[560px] w-full rounded-lg border bg-slate-950" src="/laporan-sistem/index.html"
            title="Laporan Kondisi Sistem" />
          <p className="mt-3 text-xs text-muted-foreground">
            Gunakan tombol di bawah presentasi atau tombol ← → untuk berpindah slide.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
