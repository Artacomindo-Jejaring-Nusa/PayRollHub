import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  const modalNode = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={cn(
          'w-full bg-surface-panel rounded-2xl shadow-2xl border border-border-subtle overflow-hidden flex flex-col max-h-[90vh] my-auto transition-all transform animate-in zoom-in-95 duration-150',
          maxWidths[maxWidth]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-border-row shrink-0 bg-surface-panel">
          <div>
            <h3 className="font-title-card text-title-card text-text-primary">{title}</h3>
            {description && (
              <p className="font-caption-regular text-caption-regular text-text-muted mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-container transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-surface-panel">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
};
