import { cn, getInitials } from '@/lib/utils';
import { X, Loader2 } from 'lucide-react';

// ─── BUTTON ──────────────────────────────────────────────────────────────────
export function Button({ variant = 'default', size = 'md', className, loading, children, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';
  const variants = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-border bg-background hover:bg-muted',
    ghost: 'hover:bg-muted',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    success: 'bg-green-600 text-white hover:bg-green-700',
  };
  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-4 text-sm',
    lg: 'h-10 px-6 text-sm',
    icon: 'h-8 w-8',
  };
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
}

// ─── INPUT ───────────────────────────────────────────────────────────────────
export function Input({ label, error, className, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <input
        className={cn(
          'flex h-9 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-destructive',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── TEXTAREA ────────────────────────────────────────────────────────────────
export function Textarea({ label, error, className, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium">{label}</label>}
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 resize-none',
          error && 'border-destructive',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── SELECT ──────────────────────────────────────────────────────────────────
export function Select({ label, error, options = [], className, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium">{label}</label>}
      <select
        className={cn(
          'flex h-9 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
          className
        )}
        {...props}
      >
        {options.map(({ value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── BADGE ───────────────────────────────────────────────────────────────────
export function Badge({ children, className, variant = 'default' }) {
  const variants = {
    default: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary text-secondary-foreground',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    outline: 'border border-border',
  };
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  );
}

// ─── CARD ─────────────────────────────────────────────────────────────────────
export function Card({ children, className, ...props }) {
  return (
    <div className={cn('bg-background border border-border rounded-xl', className)} {...props}>
      {children}
    </div>
  );
}

// ─── MODAL ───────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, className }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={cn('relative bg-background rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto', className)}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

// ─── AVATAR ──────────────────────────────────────────────────────────────────
export function Avatar({ name, src, size = 'sm', className }) {
  const sizes = { xs: 'w-6 h-6 text-[10px]', sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
  return (
    <div className={cn('rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary shrink-0', sizes[size], className)}>
      {src ? <img src={src} alt={name} className="w-full h-full rounded-full object-cover" /> : getInitials(name)}
    </div>
  );
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── SPINNER ─────────────────────────────────────────────────────────────────
export function Spinner({ className }) {
  return <Loader2 className={cn('w-5 h-5 animate-spin text-muted-foreground', className)} />;
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon: Icon, trend, color = 'primary' }) {
  const colors = {
    primary: 'bg-primary/10 text-primary',
    green: 'bg-green-100 text-green-600',
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
    blue: 'bg-blue-100 text-blue-600',
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          {trend !== undefined && trend !== null && (
            <p className={cn('text-xs font-medium mt-1', parseFloat(trend) >= 0 ? 'text-green-600' : 'text-red-500')}>
              {parseFloat(trend) >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last month
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', colors[color])}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
    </Card>
  );
}