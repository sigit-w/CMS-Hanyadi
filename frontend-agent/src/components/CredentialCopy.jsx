import { useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export default function CredentialCopy({ name, username, secret, label = 'PIN/password' }) {
  const [copied, setCopied] = useState(false);
  const text = `Nama: ${name || '-'}\nusername: ${username || '-'}\n${label}: ${secret || '-'}`;

  async function handleCopy(event) {
    event.stopPropagation();
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else fallbackCopy(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="font-mono text-xs leading-tight">
        <div>username: {username || '-'}</div>
        <div>{label}: {secret || '-'}</div>
      </div>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0"
        aria-label="Salin kredensial" title="Salin nama & kredensial"
        onClick={handleCopy} onKeyDown={(event) => event.stopPropagation()}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
      {copied && <span className="text-[10px] text-muted-foreground">Tersalin</span>}
    </div>
  );
}
