import React from 'react';

interface Task {
  id: number;
  name: string;
  title: string;
  description: string;
  deadline: string;
  phone_number: string;
  status: string;
}

interface Props {
  task: Task;
  onRemind: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function TableComponents({ task, onRemind, onEdit, onDelete }: Props) {
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('id-ID', options);
  };

  const getStatusBadge = (status: string) => {
    let colors = '';
    let icon = '';
    switch (status) {
      case 'Pending':
        colors = 'bg-amber-50 text-amber-600 border-amber-200/60'; icon = 'ph-clock-countdown'; break;
      case 'Send 1st':
        colors = 'bg-sky-50 text-sky-600 border-sky-200/60'; icon = 'ph-paper-plane-tilt'; break;
      case 'Send 2nd':
        colors = 'bg-indigo-50 text-indigo-600 border-indigo-200/60'; icon = 'ph-paper-plane-right'; break;
      case 'Send':
        colors = 'bg-purple-50 text-purple-600 border-purple-200/60'; icon = 'ph-paper-plane-right'; break;
      case 'Finished':
        colors = 'bg-emerald-50 text-emerald-600 border-emerald-200/60'; icon = 'ph-check-circle'; break;
      case 'Closed':
        colors = 'bg-rose-50 text-rose-600 border-rose-200/60'; icon = 'ph-x-circle'; break;
      default:
        colors = 'bg-slate-50 text-slate-600 border-slate-200/60'; icon = 'ph-circle'; break;
    }
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${colors}`}>
        <i className={`ph-fill ${icon}`}></i> {status}
      </span>
    );
  };

  return (
    <tr className="hover:bg-slate-50/80 transition-colors group">
      <td className="px-6 py-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0 mt-0.5">
            {task.name ? task.name.charAt(0).toUpperCase() : '?'}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-900">{task.name}</span>
            <span className="text-sm font-medium text-indigo-600 mt-0.5">{task.title}</span>
            <span className="text-xs text-slate-500 mt-1 line-clamp-1">{task.description || 'Tidak ada deskripsi'}</span>
          </div>
        </div>
      </td>
      <td className="px-6 py-5 text-sm text-slate-600">
        <div className="flex items-center gap-2 bg-slate-50 w-max px-3 py-1.5 rounded-lg border border-slate-100">
          <i className="ph-fill ph-whatsapp-logo text-emerald-500 text-lg"></i>
          <span className="font-medium">{task.phone_number}</span>
        </div>
      </td>
      <td className="px-6 py-5 text-sm text-slate-600">
        <div className="flex items-center gap-2 font-medium">
          <i className="ph-fill ph-calendar-blank text-slate-400 text-lg"></i>
          {formatDate(task.deadline)}
        </div>
      </td>
      <td className="px-6 py-5">
        {getStatusBadge(task.status)}
      </td>
      <td className="px-6 py-5 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button onClick={() => onRemind(task.id)} title="Kirim Reminder Manual" className="p-2 text-sky-600 hover:bg-sky-50 rounded-xl transition-all hover:scale-105">
            <i className="ph-fill ph-paper-plane-right text-xl"></i>
          </button>
          <button onClick={() => onEdit(task.id)} title="Edit" className="p-2 text-amber-500 hover:bg-amber-50 rounded-xl transition-all hover:scale-105">
            <i className="ph-fill ph-pencil-simple text-xl"></i>
          </button>
          <button onClick={() => onDelete(task.id)} title="Hapus" className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all hover:scale-105">
            <i className="ph-fill ph-trash text-xl"></i>
          </button>
        </div>
      </td>
    </tr>
  );
}