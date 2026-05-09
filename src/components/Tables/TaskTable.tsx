import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from "./TableComponents";
import { PaginationWithText } from "./Pagination";

interface Task {
  id: number;
  name: string;
  phone_number: string;
  title: string;
  description: string;
  deadline: string;
  status: string;
}

export default function TaskTable() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, dateFilter]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/tasks?status=${statusFilter}&page=${currentPage}`;
      if (dateFilter) url += `&date=${dateFilter}`;

      const res = await fetch(url);
      const data = await res.json();
      
      // Assuming API might return { tasks: [], totalPages: 10 } or just []
      if (Array.isArray(data)) {
        setTasks(data);
        // If API doesn't support pagination yet, we might need to handle it client-side
        // or update the API. For now, let's assume it returns the array.
        setTotalPages(1); 
      } else {
        setTasks(data.tasks || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFilter, currentPage]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Listen for custom events to refresh table (e.g. after adding/editing)
  useEffect(() => {
    const handleRefresh = () => fetchTasks();
    window.addEventListener("refreshTasks", handleRefresh);
    return () => window.removeEventListener("refreshTasks", handleRefresh);
  }, [fetchTasks]);

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    return new Date(dateString).toLocaleDateString("id-ID", options);
  };

  const getStatusBadge = (status: string) => {
    let colors = "";
    let icon = "";
    switch (status) {
      case "Pending":
        colors = "bg-amber-50 text-amber-600 border-amber-200/60";
        icon = "ph-clock-countdown";
        break;
      case "Send 1st":
        colors = "bg-sky-50 text-sky-600 border-sky-200/60";
        icon = "ph-paper-plane-tilt";
        break;
      case "Send 2nd":
        colors = "bg-indigo-50 text-indigo-600 border-indigo-200/60";
        icon = "ph-paper-plane-right";
        break;
      case "Send":
        colors = "bg-purple-50 text-purple-600 border-purple-200/60";
        icon = "ph-paper-plane-right";
        break;
      case "Finished":
        colors = "bg-emerald-50 text-emerald-600 border-emerald-200/60";
        icon = "ph-check-circle";
        break;
      case "Closed":
        colors = "bg-rose-50 text-rose-600 border-rose-200/60";
        icon = "ph-x-circle";
        break;
      default:
        colors = "bg-slate-50 text-slate-600 border-slate-200/60";
        icon = "ph-circle";
        break;
    }
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${colors}`}>
        <i className={`ph-fill ${icon}`}></i> {status}
      </span>
    );
  };

  const handleManualRemind = async (id: number) => {
    if (confirm('Kirim reminder manual sekarang?')) {
      await fetch(`/api/tasks/${id}/remind`, { method: "POST" });
      fetchTasks();
    }
  };

  const handleDeleteTask = async (id: number) => {
    if (confirm('Apakah Anda yakin ingin menghapus task ini?')) {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      fetchTasks();
    }
  };

  const handleEditTask = (id: number) => {
    // Call the global openModal function if available
    if ((window as any).openModal) {
      (window as any).openModal('edit', id);
    }
  };

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="bg-white/60 backdrop-blur-md p-5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white flex flex-col md:flex-row gap-5 items-end transition-all">
        <div className="flex-1 w-full">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Filter Tanggal
          </label>
          <div className="relative">
            <i className="ph ph-calendar text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 text-lg"></i>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full bg-white/80 border-slate-200 text-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm pl-11 pr-4 py-2.5 transition-all outline-none"
            />
          </div>
        </div>
        <div className="flex-1 w-full">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Filter Status
          </label>
          <div className="relative">
            <i className="ph ph-funnel text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 text-lg"></i>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-white/80 border-slate-200 text-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm pl-11 pr-4 py-2.5 transition-all outline-none appearance-none"
            >
              <option value="All">Semua Aktif (Kecuali Selesai/Ditutup)</option>
              <option value="Pending">Pending</option>
              <option value="Send 1st">Send 1st</option>
              <option value="Send 2nd">Send 2nd</option>
              <option value="Send">Send (Manual)</option>
            </select>
            <i className="ph ph-caret-down text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"></i>
          </div>
        </div>
        <button
          onClick={() => fetchTasks()}
          className="bg-white hover:bg-slate-50 text-slate-700 px-6 py-2.5 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 border border-slate-200 shadow-sm w-full md:w-auto justify-center hover:border-slate-300"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell isHeader>Nama & Pekerjaan</TableCell>
              <TableCell isHeader>Kontak WA</TableCell>
              <TableCell isHeader>Tenggat Waktu</TableCell>
              <TableCell isHeader>Status</TableCell>
              <TableCell isHeader className="text-right">Aksi</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell className="text-center py-16" colSpan={5}>
                  <div className="flex justify-center items-center gap-2">
                    <i className="ph ph-spinner ph-spin text-3xl text-indigo-500"></i>
                    <span className="font-medium text-slate-500">Memuat data...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : tasks.length === 0 ? (
              <TableRow>
                <TableCell className="text-center py-16" colSpan={5}>
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 mb-4 text-slate-300">
                    <i className="ph ph-folder-open text-3xl"></i>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Tidak ada task ditemukan</h3>
                  <p className="text-sm text-slate-500">Coba ubah filter atau tambahkan task baru.</p>
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0 mt-0.5">
                        {task.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{task.name}</span>
                        <span className="text-sm font-medium text-indigo-600 mt-0.5">{task.title}</span>
                        <span className="text-xs text-slate-500 mt-1 line-clamp-1">{task.description || "Tidak ada deskripsi"}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 bg-slate-50 w-max px-3 py-1.5 rounded-lg border border-slate-100">
                      <i className="ph-fill ph-whatsapp-logo text-emerald-500 text-lg"></i>
                      <span className="font-medium text-slate-600">{task.phone_number}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium text-slate-600">
                      <i className="ph-fill ph-calendar-blank text-slate-400 text-lg"></i>
                      {formatDate(task.deadline)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(task.status)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button onClick={() => handleManualRemind(task.id)} title="Kirim Reminder Manual" className="p-2 text-sky-600 hover:bg-sky-50 rounded-xl transition-all hover:scale-105">
                        <i className="ph-fill ph-paper-plane-right text-xl"></i>
                      </button>
                      <button onClick={() => handleEditTask(task.id)} title="Edit" className="p-2 text-amber-500 hover:bg-amber-50 rounded-xl transition-all hover:scale-105">
                        <i className="ph-fill ph-pencil-simple text-xl"></i>
                      </button>
                      <button onClick={() => handleDeleteTask(task.id)} title="Hapus" className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all hover:scale-105">
                        <i className="ph-fill ph-trash text-xl"></i>
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        
        {totalPages > 1 && (
          <PaginationWithText 
            totalPages={totalPages} 
            initialPage={currentPage} 
            onPageChange={(page) => setCurrentPage(page)} 
          />
        )}
      </div>
    </div>
  );
}
