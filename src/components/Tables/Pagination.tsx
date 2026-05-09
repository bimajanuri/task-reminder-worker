import React from 'react';

interface Props {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  indexOfFirstItem: number;
  indexOfLastItem: number;
}

export default function Pagination({ currentPage, totalPages, onPageChange, totalItems, indexOfFirstItem, indexOfLastItem }: Props) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="text-sm text-slate-500 text-center sm:text-left">
        Menampilkan <span className="font-medium text-slate-900">{totalItems === 0 ? 0 : indexOfFirstItem + 1}</span> hingga <span className="font-medium text-slate-900">{indexOfLastItem}</span> dari <span className="font-medium text-slate-900">{totalItems}</span> task
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          <i className="ph ph-caret-left text-lg"></i>
        </button>
        <span className="text-sm font-medium text-slate-700 px-4 py-1.5 bg-white border border-slate-200 rounded-lg">
          {currentPage} / {totalPages === 0 ? 1 : totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          <i className="ph ph-caret-right text-lg"></i>
        </button>
      </div>
    </div>
  );
}