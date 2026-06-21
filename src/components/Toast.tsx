import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, X, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  text: string;
  type: ToastType;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 min-w-[280px] max-w-[400px]">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface ToastCardProps {
  key?: string;
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

function ToastCard({ toast, onDismiss }: ToastCardProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const config = {
    success: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      icon: <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />,
    },
    error: {
      bg: 'bg-red-50 border-red-200 text-red-800',
      icon: <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />,
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200 text-amber-800',
      icon: <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />,
    },
    info: {
      bg: 'bg-sky-50 border-sky-200 text-sky-800',
      icon: <Info className="h-5 w-5 text-sky-500 flex-shrink-0" />,
    },
  }[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
      className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg ${config.bg} transition-all duration-200`}
    >
      {config.icon}
      <div className="flex-1 text-sm font-medium pr-1 whitespace-pre-line leading-relaxed">
        {toast.text}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-0.5 rounded-lg hover:bg-black/5 text-gray-400 hover:text-gray-700 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
