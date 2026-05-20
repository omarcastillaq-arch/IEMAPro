export const formatVitalValue = (type: string, value: number, value2?: number | null): string => {
  switch (type) {
    case 'BLOOD_PRESSURE':
      return `${Math.round(value)}/${Math.round(value2 ?? 0)} mmHg`;
    case 'HEART_RATE':
      return `${Math.round(value)} bpm`;
    case 'GLUCOSE':
      return `${Math.round(value)} mg/dL`;
    default:
      return `${value}`;
  }
};

export const vitalTypeLabel = (type: string): string => {
  switch (type) {
    case 'BLOOD_PRESSURE': return 'Presión Arterial';
    case 'HEART_RATE': return 'Frecuencia Cardíaca';
    case 'GLUCOSE': return 'Glucosa';
    default: return type ?? '';
  }
};

export const vitalTypeIcon = (type: string): string => {
  switch (type) {
    case 'BLOOD_PRESSURE': return 'heart-pulse';
    case 'HEART_RATE': return 'pulse';
    case 'GLUCOSE': return 'water';
    default: return 'clipboard-pulse';
  }
};

export const vitalTypeColor = (type: string): string => {
  switch (type) {
    case 'BLOOD_PRESSURE': return '#EF4444';
    case 'HEART_RATE': return '#4F46E5';
    case 'GLUCOSE': return '#F59E0B';
    default: return '#06B6D4';
  }
};

export const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

export const formatDateTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
};

export const formatTimeAgo = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  try {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `Hace ${days}d`;
  } catch {
    return '';
  }
};

export const priorityLabel = (p: string): string => {
  switch (p) {
    case 'CRITICAL': return 'CRÍTICA';
    case 'WARNING': return 'ADVERTENCIA';
    case 'INFO': return 'INFO';
    default: return p ?? '';
  }
};

export const statusLabel = (s: string): string => {
  switch (s) {
    case 'active': return 'Activo';
    case 'paused': return 'Pausado';
    case 'completed': return 'Completado';
    case 'cancelled': return 'Cancelado';
    case 'NEW': return 'NUEVA';
    case 'ACKNOWLEDGED': return 'RECONOCIDA';
    case 'RESOLVED': return 'RESUELTA';
    default: return s ?? '';
  }
};

export const getInitials = (name: string | null | undefined): string => {
  if (!name) return '?';
  return name.split(' ').map(w => w?.[0] ?? '').join('').toUpperCase().slice(0, 2);
};
