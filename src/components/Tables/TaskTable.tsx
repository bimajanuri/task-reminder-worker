import React, { useState, useEffect } from 'react';
import TableComponents from './TableComponents';
import Pagination from './Pagination';

// Kita pastikan semua icon Phosphor di-load dengan benar jika digunakan
// Asumsi: Anda memuat Phosphor icons via CDN di Layout.astro

interface Task {
  id: number;
  name: string;
  title: string;
  description: string;
  deadline: string;
  phone_number: string;
  status: string;
}

export default function TaskTable() {
  // 1. TAMBAHAN PENTING UNTUK MENCEGAH SSR ERROR DI CLOUDFLARE WORKER
  const [isMounted, setIsMounted] = useState(false);

  // State lainnya
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // 2. useEffect pertama untuk menandai komponen sudah 'mounted' di client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch data
  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/tasks?status=${statusFilter}`;
      if (dateFilter) url += `&date=${dateFilter}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Gagal mengambil data dari server');
      const data = await res.json();
      setTasks(data);
      setCurrentPage(1); // Reset halaman jika filter berubah
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  // Fetch saat pertama kali ATAU ketika filter berubah (jika ingin otomatis)
  // Atau Anda bisa menggunakan tombol 'Terapkan' untuk men-trigger fetchTasks manual
  useEffect(() => {
    if (isMounted) {
      fetchTasks();
    }
  }, [isMounted, statusFilter, dateFilter]); // Akan otomatis fetch jika statusFilter/dateFilter berubah


  // --- Aksi Tabel ---
  const handleManualRemind = async (id: number) => {
    if (window.confirm('Kirim reminder manual sekarang? (Pesan WA akan dikirim dan status berubah menjadi "Send")')) {
      try {
        await fetch(`/api/tasks/${id}/remind`, { method: 'POST' });
        fetchTasks(); // Refresh data
      } catch (err) {
        alert('Gagal mengirim manual reminder');
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus task ini? Data tidak dapat dikembalikan.')) {
      try {
        await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        fetchTasks(); // Refresh data
      } catch (err) {
        alert('Gagal menghapus task');
      }
    }
  };

  const handleEdit = (id: number) => {
    // Karena modal Anda sebelumnya dikelola via Vanilla JS di index.astro,
    // Kita panggil fungsi Vanilla JS tersebut untuk saat ini
    if (typeof window !== 'undefined' && (window as any).openModal) {
      (window as any).openModal('edit', id);
    } else {
      alert(`Edit task ${id} diklik! Anda perlu memindahkan logika Modal ke dalam React atau mengekspos window.openModal`);
    }
  };


  // --- Logika Pagination ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = tasks.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(tasks.length / itemsPerPage);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  // 3. JIKA BELUM MOUNTED (Masih di Server / SSR), KEMBALIKAN NULL ATAU SKELETON
  if (!isMounted) {
    return <div className="p-8 text-center text-slate-500">Memuat Antarmuka...</div>;
  }

  return (
    <>
      {/* Filters (Glassmorphism Card) */}
      <div className="bg-white/60 backdrop-blur-md p-5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white mb-8 flex flex-col md:flex-row gap-5 items-end transition-all">
        <div className="flex-1 w-full">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Filter Tanggal</label>
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
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Filter Status</label>
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
          onClick={fetchTasks}
          className="bg-white hover:bg-slate-50 text-slate-700 px-6 py-2.5 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 border border-slate-200 shadow-sm w-full md:w-auto justify-center hover:border-slate-300"
        >
          Terapkan (Reload)
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-grow">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/50">
              <tr>
                <th scope="col" className="px-6 py-5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Nama & Pekerjaan</th>
                <th scope="col" className="px-6 py-5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Kontak WA</th>
                <th scope="col" className="px-6 py-5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tenggat Waktu</th>
                <th scope="col" className="px-6 py-5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex justify-center items-center gap-2">
                      <i className="ph ph-spinner ph-spin text-2xl text-indigo-600"></i> Memuat data...
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-rose-500 font-medium">{error}</td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 mb-4 text-slate-300">
                      <i className="ph ph-folder-open text-3xl"></i>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mb-1">Tidak ada task ditemukan</h3>
                    <p className="text-sm text-slate-500">Coba ubah filter atau tambahkan task baru.</p>
                  </td>
                </tr>
              ) : (
                currentItems.map((task) => (
                  <TableComponents
                    key={task.id}
                    task={task}
                    onRemind={handleManualRemind}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Section (Hanya tampil jika tidak loading dan ada data) */}
        {!loading && !error && tasks.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              totalItems={tasks.length}
              indexOfFirstItem={indexOfFirstItem}
              indexOfLastItem={Math.min(indexOfLastItem, tasks.length)}
            />
          </div>
        )}
      </div>
    </>
  );
}