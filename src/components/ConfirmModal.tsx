import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = true,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--bg)] border-2 border-[var(--ink)] shadow-brutal w-full max-w-md p-6 rounded relative">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4 mb-4">
          <div className={`p-2.5 rounded border border-[var(--ink)] ${isDestructive ? 'bg-[var(--r)] text-white' : 'bg-[var(--a)] text-[#16130F]'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-serif text-2xl text-[var(--ink)] leading-tight">{title}</h3>
            <p className="font-sans text-sm text-[var(--mut)] mt-1.5 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--line)]">
          <button
            onClick={onCancel}
            className="btn o sm !text-xs cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`btn sm !text-xs cursor-pointer ${isDestructive ? 'danger' : ''}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

