import React from "react";

export const Table = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-slate-100">{children}</table>
  </div>
);

export const TableHeader = ({ children }: { children: React.ReactNode }) => (
  <thead className="bg-slate-50/50">{children}</thead>
);

export const TableBody = ({ children }: { children: React.ReactNode }) => (
  <tbody className="bg-white divide-y divide-slate-100">{children}</tbody>
);

export const TableRow = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <tr className={`hover:bg-slate-50/80 transition-colors group ${className}`}>{children}</tr>
);

export const TableCell = ({
  children,
  isHeader = false,
  className = "",
}: {
  children: React.ReactNode;
  isHeader?: boolean;
  className?: string;
}) => {
  if (isHeader) {
    return (
      <th
        scope="col"
        className={`px-6 py-5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider ${className}`}
      >
        {children}
      </th>
    );
  }
  return <td className={`px-6 py-5 ${className}`}>{children}</td>;
};
