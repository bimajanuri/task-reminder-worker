import React, { useState } from "react";

interface PaginationProps {
  totalPages: number;
  initialPage?: number;
  onPageChange: (page: number) => void;
}

export const PaginationWithText = ({
  totalPages,
  initialPage = 1,
  onPageChange,
}: PaginationProps) => {
  const [currentPage, setCurrentPage] = useState(initialPage);

  // Sync internal state with prop
  React.useEffect(() => {
    setCurrentPage(initialPage);
  }, [initialPage]);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    onPageChange(page);
  };

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-slate-100">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">
            Halaman <span className="font-bold text-slate-900">{currentPage}</span> dari{" "}
            <span className="font-bold text-slate-900">{totalPages}</span>
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px gap-2" aria-label="Pagination">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center p-2 text-slate-400 hover:text-indigo-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-30"
            >
              <span className="sr-only">Previous</span>
              <i className="ph ph-caret-left text-lg"></i>
            </button>
            
            {/* Simple page numbers could go here, but sticking to "WithText" style */}
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center p-2 text-slate-400 hover:text-indigo-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-30"
            >
              <span className="sr-only">Next</span>
              <i className="ph ph-caret-right text-lg"></i>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};
