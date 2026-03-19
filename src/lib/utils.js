import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isToday, isTomorrow, isPast } from 'date-fns';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount, currency = 'KES') {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date, fmt = 'dd MMM yyyy') {
  if (!date) return '—';
  return format(new Date(date), fmt);
}

export function timeAgo(date) {
  if (!date) return '—';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function dueDateLabel(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isPast(d) && !isToday(d)) return { label: 'Overdue', color: 'text-red-500' };
  if (isToday(d)) return { label: 'Due today', color: 'text-amber-500' };
  if (isTomorrow(d)) return { label: 'Due tomorrow', color: 'text-amber-400' };
  return { label: `Due ${format(d, 'dd MMM')}`, color: 'text-muted-foreground' };
}

export function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getWhatsAppUrl(phone, message = '') {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  const encoded = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${cleaned}${encoded}`;
}

export function truncate(str, length = 50) {
  if (!str) return '';
  return str.length > length ? `${str.slice(0, length)}...` : str;
}

export const DEAL_STATUS_COLORS = {
  open: 'bg-blue-100 text-blue-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
};

export const CONTACT_STATUS_COLORS = {
  lead: 'bg-purple-100 text-purple-700',
  prospect: 'bg-blue-100 text-blue-700',
  customer: 'bg-green-100 text-green-700',
  churned: 'bg-red-100 text-red-700',
  other: 'bg-gray-100 text-gray-700',
};

export const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
};

export const TASK_TYPE_ICONS = {
  call: '📞',
  email: '✉️',
  meeting: '🤝',
  follow_up: '🔁',
  demo: '💻',
  other: '📌',
};