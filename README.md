Berikut adalah pembaruan lengkap untuk file `README.md` yang mencakup arsitektur baru (Hono + Astro + Queues) dan daftar lengkap API beserta cara memanggilnya menggunakan `curl`.

Anda dapat menyalin seluruh blok kode di bawah ini:

```markdown
# 🚀 Task Reminder Worker (WhatsApp Integrated)

Aplikasi manajemen tugas otomatis yang mengirimkan pengingat melalui WhatsApp menggunakan **Astro** (Dashboard), **Hono** (API), **Cloudflare D1** (Database), dan **Cloudflare Queues** (Sistem Antrean Pesan).

## ✨ Fitur Utama
- **Unified Worker**: Frontend Astro dan Backend Hono dalam satu Cloudflare Worker.
- **WhatsApp Integration**: Integrasi dengan [WAHA (WhatsApp HTTP API)](https://waha.dev/).
- **Automated Reminders**: Pengiriman otomatis H-24 jam, Jam 7 Pagi Hari-H, dan H-1 jam.
- **Reliable Messaging**: Menggunakan Cloudflare Queues untuk menangani pengiriman pesan yang gagal (auto-retry).
- **Auto-Cleanup**: Secara otomatis mengubah status tugas yang terlewat menjadi "Finished".

---

## 🛠️ Persyaratan
- Node.js & npm
- Akun Cloudflare
- Instansi WAHA yang sudah berjalan
- D1 Database dan Cloudflare Queue yang sudah dibuat

---

## ⚙️ Konfigurasi (wrangler.toml)

Pastikan `wrangler.toml` Anda memiliki konfigurasi berikut:

```toml
name = "task-reminder-worker"
main = "src/index.ts"
compatibility_date = "2024-04-01"

[vars]
WAHA_URL = "[https://waha-anda.com](https://waha-anda.com)"
WAHA_API_KEY = "key-anda"

[[d1_databases]]
binding = "DB"
database_name = "task_reminder_db"
database_id = "your-d1-id"

[[queues.producers]]
queue = "task-reminder-queue"
binding = "REMINDER_QUEUE"

[[queues.consumers]]
queue = "task-reminder-queue"
max_batch_size = 5
max_retries = 3

[triggers]
crons = ["* * * * *"]

```

---

## 📡 Dokumentasi API

Semua endpoint API kini menggunakan prefix `/api`.

### 1. Manajemen WhatsApp (WAHA)

| Method | Endpoint | Deskripsi |
| --- | --- | --- |
| `GET` | `/api/wa-status` | Cek status koneksi session WhatsApp |
| `POST` | `/api/wa-login` | Memulai (start) session WhatsApp |
| `GET` | `/api/wa-qr` | Mengambil gambar QR Code untuk scan |
| `DELETE` | `/api/wa-logout` | Menghentikan (stop) session WhatsApp |

**Contoh Cek Status:**

```bash
curl [https://domain-anda.com/api/wa-status](https://domain-anda.com/api/wa-status)

```

---

### 2. Manajemen Tugas (Tasks)

| Method | Endpoint | Deskripsi |
| --- | --- | --- |
| `GET` | `/api/tasks` | List semua tugas yang ada |
| `POST` | `/api/tasks` | Membuat tugas baru |
| `DELETE` | `/api/tasks/:id` | Menghapus tugas berdasarkan ID |
| `POST` | `/api/tasks/:id/test-send` | Kirim pesan uji coba manual ke nomor WA |

**Contoh Simpan Tugas Baru:**

```bash
curl -X POST [https://domain-anda.com/api/tasks](https://domain-anda.com/api/tasks) \
-H "Content-Type: application/json" \
-d '{
  "name": "Budi",
  "phone_number": "628123456789",
  "title": "Bayar Listrik",
  "description": "Tagihan bulan Mei",
  "deadline": "2026-05-10T10:00"
}'

```

**Contoh Kirim Pesan Tes (Manual):**

```bash
curl -X POST [https://domain-anda.com/api/tasks/3/test-send](https://domain-anda.com/api/tasks/3/test-send)

```

---

## 🚀 Cara Menjalankan

### Pengembangan Lokal

1. Install dependensi:
```bash
npm install --legacy-peer-deps

```


2. Jalankan Astro & Wrangler:
```bash
npm run dev

```



### Deployment

Penting: Build Astro harus dilakukan sebelum deploy agar `dist` tersedia untuk Worker.

```bash
# 1. Build Frontend
npx astro build

# 2. Deploy ke Cloudflare
npx wrangler deploy

```

---

## 🗄️ Skema Database (D1)

Jika menginisialisasi database baru, jalankan:

```sql
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    deadline DATETIME NOT NULL,
    phone_number TEXT NOT NULL,
    status TEXT DEFAULT 'pending'
);

CREATE TABLE reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    type TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

```

```

### Penjelasan Perubahan Penting:
1.  **Prefix `/api`**: Saya menambahkan informasi bahwa semua panggil curl harus menyertakan `/api/` karena kita menggunakan `.basePath('/api')` di Hono.
2.  **Struktur Gabungan**: README menjelaskan bahwa project ini adalah satu kesatuan (Astro + Hono).
3.  **Endpoint Baru**: Menyertakan `/test-send` yang sebelumnya diperbaiki.
4.  **Langkah Build**: Menjelaskan urutan `npx astro build` sebelum `wrangler deploy` untuk menghindari error *file not found*.

```