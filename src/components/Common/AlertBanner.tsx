import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

interface AlertBannerProps {
  type: 'error' | 'warning' | 'success' | 'info';
  title?: string;
  message: string | React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type,
  title,
  message,
  onClose,
  className = '',
}) => {
  const styles = {
    error: {
      bg: 'bg-rose-50 border-rose-200 text-rose-900',
      icon: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />,
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200 text-amber-900',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
    },
    success: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
    },
    info: {
      bg: 'bg-sky-50 border-sky-200 text-sky-900',
      icon: <Info className="w-5 h-5 text-sky-600 shrink-0" />,
    },
  }[type];

  return (
    <div className={`p-4 rounded-xl border flex items-start gap-3 ${styles.bg} ${className}`}>
      {styles.icon}
      <div className="flex-1 text-sm leading-normal">
        {title && <div className="font-semibold mb-0.5">{title}</div>}
        <div className="text-slate-700 whitespace-pre-line">{message}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
