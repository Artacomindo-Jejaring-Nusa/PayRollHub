import React from 'react';
import { Button } from '../ui/Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PayrollPaginationMeta } from '../../types/payroll';

export interface PaginationProps {
  meta: PayrollPaginationMeta;
  onPageChange: (page: number) => void;
  perPage?: number;
  onPerPageChange?: (perPage: number) => void;
  isLoading?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  meta,
  onPageChange,
  perPage = 10,
  onPerPageChange,
  isLoading,
}) => {
  const { current_page, last_page, total, from, to } = meta;

  if (total === 0) return null;

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-4 py-3 bg-surface-panel border-t border-border-subtle rounded-b-xl">
      {/* Information & Per Page Selector */}
      <div className="flex flex-wrap items-center gap-3 text-caption-regular text-text-muted">
        <div>
          Menampilkan{' '}
          <span className="font-semibold text-text-primary">{from ?? 0}</span> -{' '}
          <span className="font-semibold text-text-primary">{to ?? 0}</span> dari{' '}
          <span className="font-semibold text-text-primary">{total}</span> data
        </div>

        {onPerPageChange && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-border-row">
            <span className="text-[12px] text-text-muted">Baris:</span>
            <select
              value={perPage}
              onChange={(e) => onPerPageChange(Number(e.target.value))}
              disabled={isLoading}
              className="h-7 px-2 py-0.5 bg-surface-container rounded border border-border-subtle text-[12px] font-medium text-text-primary outline-none focus:ring-1 focus:ring-primary cursor-pointer disabled:opacity-50"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center gap-1.5 sm:pr-20">
        <Button
          variant="outline"
          size="sm"
          disabled={current_page <= 1 || isLoading}
          onClick={() => onPageChange(current_page - 1)}
          leftIcon={<ChevronLeft className="w-4 h-4" />}
        >
          Sebelumnya
        </Button>

        <div className="flex items-center px-2.5 text-caption-medium text-text-primary font-medium text-[12px]">
          Hal {current_page} / {last_page || 1}
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={current_page >= last_page || isLoading}
          onClick={() => onPageChange(current_page + 1)}
          rightIcon={<ChevronRight className="w-4 h-4" />}
        >
          Selanjutnya
        </Button>
      </div>
    </div>
  );
};
