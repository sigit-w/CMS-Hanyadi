import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function Combobox({ id, value, onChange, options = [], placeholder = 'Cari...', className }) {
  const [query, setQuery] = useState(value ?? '');
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    setQuery(value ?? '');
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const filtered = useMemo(() => {
    const selectedLabel = options.find((option) => option.value === value)?.label;
    const activeQuery = selectedLabel && query === selectedLabel ? '' : query;
    const needle = String(activeQuery ?? '').trim().toLowerCase();
    return options
      .filter((option) => !needle || option.label.toLowerCase().includes(needle))
      .slice(0, 100);
  }, [options, query, value]);

  function choose(option) {
    setQuery(option.label);
    setOpen(false);
    onChange(option.value);
  }

  const listId = id ? `${id}-options` : undefined;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listId}
        className="pr-9"
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            return;
          }
          if (event.key === 'Enter' && open && filtered.length > 0) {
            event.preventDefault();
            choose(filtered[0]);
          }
        }}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      {open && filtered.length > 0 && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {filtered.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={cn(
                'flex w-full cursor-pointer items-center rounded px-3 py-2 text-left text-sm',
                option.value === value
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground'
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
