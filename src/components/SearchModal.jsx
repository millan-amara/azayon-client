import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Briefcase, CheckSquare, X, Loader2 } from 'lucide-react';
import { useGlobalSearch } from '@/hooks/useData';
import { formatCurrency, dueDateLabel, cn } from '@/lib/utils';

// Tiny debounce hook
function useDebounced(value, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function SearchModal({ open, onClose }) {
  const [q, setQ] = useState('');
  const debouncedQ = useDebounced(q, 200);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);

  const { data, isFetching } = useGlobalSearch(debouncedQ);

  // Flatten results into a single list for keyboard navigation
  const items = useMemo(() => {
    if (!data) return [];
    return [
      ...(data.contacts || []).map((c) => ({
        type: 'contact',
        id: c._id,
        href: `/contacts/${c._id}`,
        title: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Contact',
        subtitle: [c.company, c.email].filter(Boolean).join(' · '),
      })),
      ...(data.deals || []).map((d) => ({
        type: 'deal',
        id: d._id,
        href: `/deals/${d._id}`,
        title: d.title,
        subtitle: [
          formatCurrency(d.value, d.currency),
          d.stageName,
          d.contact && [d.contact.firstName, d.contact.lastName].filter(Boolean).join(' '),
        ].filter(Boolean).join(' · '),
      })),
      ...(data.tasks || []).map((t) => ({
        type: 'task',
        id: t._id,
        href: '/tasks',
        title: t.title,
        subtitle: [
          t.priority,
          dueDateLabel(t.dueDate)?.label,
          t.contact && [t.contact.firstName, t.contact.lastName].filter(Boolean).join(' '),
        ].filter(Boolean).join(' · '),
      })),
    ];
  }, [data]);

  // Reset state when opening / closing
  useEffect(() => {
    if (open) {
      setQ('');
      setActiveIndex(0);
      // Autofocus after the dialog mounts
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Clamp activeIndex when items change
  useEffect(() => {
    if (activeIndex >= items.length) setActiveIndex(0);
  }, [items.length, activeIndex]);

  const go = (item) => {
    if (!item) return;
    navigate(item.href);
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(items[activeIndex]);
    }
  };

  if (!open) return null;

  const hasQuery = debouncedQ.trim().length >= 2;
  const showEmpty = hasQuery && !isFetching && items.length === 0;

  const groups = [
    { key: 'contact', label: 'Contacts', Icon: Users,     items: data?.contacts || [] },
    { key: 'deal',    label: 'Deals',    Icon: Briefcase, items: data?.deals || [] },
    { key: 'task',    label: 'Tasks',    Icon: CheckSquare, items: data?.tasks || [] },
  ];

  // Build a flat index map so we can highlight the right row across groups
  let flatIdx = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-xl bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
        onKeyDown={onKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search contacts, deals, tasks…"
            className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
            autoComplete="off"
          />
          {isFetching && hasQuery && (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          )}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {!hasQuery && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">Type to search across contacts, deals and tasks.</p>
              <p className="text-xs text-muted-foreground mt-2">
                Press <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-muted rounded border border-border">Esc</kbd> to close,{' '}
                <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-muted rounded border border-border">↑↓</kbd> to navigate,{' '}
                <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-muted rounded border border-border">Enter</kbd> to open.
              </p>
            </div>
          )}

          {showEmpty && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No matches for <span className="font-medium text-foreground">"{debouncedQ}"</span>
            </div>
          )}

          {hasQuery && items.length > 0 && groups.map((group) => {
            const { key, label, Icon, items: groupItems } = group;
            if (groupItems.length === 0) return null;
            return (
              <div key={key} className="py-1">
                <div className="px-4 pt-2 pb-1 flex items-center gap-1.5">
                  <Icon className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
                </div>
                {groupItems.map((raw) => {
                  const item =
                    key === 'contact'
                      ? items.find((i) => i.type === 'contact' && i.id === raw._id)
                      : key === 'deal'
                        ? items.find((i) => i.type === 'deal' && i.id === raw._id)
                        : items.find((i) => i.type === 'task' && i.id === raw._id);
                  if (!item) return null;
                  const idx = flatIdx++;
                  const active = idx === activeIndex;
                  return (
                    <button
                      key={`${key}-${item.id}`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => go(item)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        active ? 'bg-primary/10' : 'hover:bg-muted'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm truncate', active && 'text-primary font-medium')}>
                          {item.title}
                        </p>
                        {item.subtitle && (
                          <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
