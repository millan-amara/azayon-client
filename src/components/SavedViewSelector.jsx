import { useState } from 'react';
import { Bookmark, BookmarkCheck, Plus, Trash2, X, Check } from 'lucide-react';
import { useSavedViews, useCreateSavedView, useDeleteSavedView } from '@/hooks/useData';
import { Button, Modal, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// Generic per-user saved-views control. Each page passes:
//   page          — 'pipeline' | 'contacts' | 'tasks' | 'documents'
//   currentFilters — the live filter object the user has applied right now
//   onApply       — callback that receives a saved view's filters and applies them
//   isActive      — optional (filtersA, filtersB) => boolean comparator so we can
//                   highlight the currently-applied view. Defaults to JSON equality.
export default function SavedViewSelector({ page, currentFilters, onApply, isActive }) {
  const [open, setOpen] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [name, setName] = useState('');

  const { data } = useSavedViews(page);
  const { mutateAsync: create, isPending: creating } = useCreateSavedView();
  const { mutate: del } = useDeleteSavedView();

  const views = data?.views || [];
  const eq = isActive || ((a, b) => JSON.stringify(a) === JSON.stringify(b));
  const activeView = views.find((v) => eq(v.filters, currentFilters));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name your view');
    await create({ page, name: name.trim(), filters: currentFilters });
    setName('');
    setShowSave(false);
  };

  return (
    <>
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          className={cn(activeView && 'border-primary text-primary')}
        >
          {activeView ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          <span className="hidden sm:inline">{activeView ? activeView.name : 'Views'}</span>
        </Button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-9 w-64 bg-background border border-border rounded-xl shadow-lg z-20 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Saved views</span>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                  aria-label="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {views.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4 px-4">No saved views yet</p>
              ) : (
                <div className="max-h-64 overflow-y-auto py-1">
                  {views.map((v) => {
                    const active = eq(v.filters, currentFilters);
                    return (
                      <div key={v._id} className="group flex items-center">
                        <button
                          onClick={() => { onApply(v.filters); setOpen(false); }}
                          className={cn(
                            'flex-1 flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-muted transition-colors',
                            active && 'text-primary font-medium'
                          )}
                        >
                          {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                          <span className={cn('truncate', !active && 'pl-5')}>{v.name}</span>
                        </button>
                        <button
                          onClick={() => del(v._id)}
                          className="p-2 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="border-t border-border">
                <button
                  onClick={() => { setOpen(false); setShowSave(true); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Save current filters as a view
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal open={showSave} onClose={() => setShowSave(false)} title="Save view">
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="View name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My open deals over 50K"
            autoFocus
            required
          />
          <p className="text-xs text-muted-foreground">
            We'll save your current filters under this name. Only you can see and use it.
          </p>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowSave(false)}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={creating}>Save view</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
