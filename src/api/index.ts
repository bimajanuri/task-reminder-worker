import { Hono } from 'hono';

type Bindings = {
    DB: D1Database;
    WAHA_URL: string;
    WAHA_API_KEY: string; // Menambahkan typing untuk API Key
};

const api = new Hono<{ Bindings: Bindings }>();

// GET tasks (dengan filter & pagination)
api.get('/tasks', async (c) => {
    const statusFilter = c.req.query('status');
    const dateFilter = c.req.query('date');
    const page = parseInt(c.req.query('page') || '1');
    const limit = 10;
    const offset = (page - 1) * limit;

    let whereClause = " WHERE status NOT IN ('Finished', 'Closed')";
    const params: any[] = [];

    if (statusFilter && statusFilter !== 'All') {
        whereClause = " WHERE status = ?";
        params.push(statusFilter);
    }

    if (dateFilter) {
        whereClause += " AND date(deadline) = date(?)";
        params.push(dateFilter);
    }

    // Count total tasks for pagination
    const countQuery = `SELECT COUNT(*) as total FROM tasks ${whereClause}`;
    const countResult: any = await c.env.DB.prepare(countQuery).bind(...params).first();
    const total = countResult.total;
    const totalPages = Math.ceil(total / limit);

    // Get paginated tasks
    const tasksQuery = `SELECT * FROM tasks ${whereClause} ORDER BY deadline ASC LIMIT ? OFFSET ?`;
    const { results } = await c.env.DB.prepare(tasksQuery).bind(...params, limit, offset).all();

    return c.json({
        tasks: results,
        totalPages,
        currentPage: page,
        totalTasks: total
    });
});

// GET single task
api.get('/tasks/:id', async (c) => {
    const id = c.req.param('id');
    const task = await c.env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
    if (!task) return c.json({ error: 'Task not found' }, 404);
    return c.json(task);
});

// CREATE task
api.post('/tasks', async (c) => {
    const body = await c.req.json();
    const { name, title, description, deadline, phone_number } = body;

    await c.env.DB.prepare(
        "INSERT INTO tasks (name, title, description, deadline, phone_number, status) VALUES (?, ?, ?, ?, ?, 'Pending')"
    ).bind(name, title, description, deadline, phone_number).run();

    return c.json({ success: true, message: 'Task added' });
});

// UPDATE task (Termasuk ubah status manual)
api.put('/tasks/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { name, title, description, deadline, phone_number, status } = body;

    await c.env.DB.prepare(
        "UPDATE tasks SET name = ?, title = ?, description = ?, deadline = ?, phone_number = ?, status = ? WHERE id = ?"
    ).bind(name, title, description, deadline, phone_number, status, id).run();

    return c.json({ success: true, message: 'Task updated' });
});

// DELETE task
api.delete('/tasks/:id', async (c) => {
    const id = c.req.param('id');
    await c.env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(id).run();
    return c.json({ success: true, message: 'Task deleted' });
});

// MANUAL REMINDER (Ubah status ke 'Send' & Kirim WA via WAHA)
api.post('/tasks/:id/remind', async (c) => {
    const id = c.req.param('id');

    // 1. Ambil data task
    const task: any = await c.env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();

    if (!task) {
        return c.json({ success: false, message: 'Task tidak ditemukan' }, 404);
    }

    // 2. Format nomor HP (WAHA butuh format 628... @c.us)
    let phoneNumber = task.phone_number.trim();
    if (phoneNumber.startsWith('0')) {
        phoneNumber = '62' + phoneNumber.substring(1);
    }
    const chatId = `${phoneNumber}@c.us`;

    // 3. Format pesan WA (Manual Reminder)
    const textMessage = `Halo ${task.name},\n\n[Reminder Manual] Ini adalah pengingat untuk pekerjaan Anda:\n*${task.title}*\n\nTenggat Waktu: ${task.deadline}\nDeskripsi: ${task.description || '-'}\n\nTerima kasih.`;

    // 4. Kirim pesan menggunakan WAHA API
    try {
        const wahaUrl = c.env.WAHA_URL || 'http://localhost:3000';
        const apiKey = c.env.WAHA_API_KEY || ''; // Mengambil API Key dari environment variables

        const response = await fetch(`${wahaUrl}/api/sendText`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Api-Key': apiKey, // WAHA menggunakan format X-Api-Key
                'Authorization': `Bearer ${apiKey}` // Opsi fallback tambahan
            },
            body: JSON.stringify({
                chatId: chatId,
                text: textMessage,
                session: 'default' // Memastikan session menggunakan default
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("WAHA Error:", errorText);
            return c.json({ success: false, message: 'Gagal mengirim pesan WhatsApp via WAHA: ' + errorText }, 500);
        }

        // 5. Update status di DB
        await c.env.DB.prepare(
            "UPDATE tasks SET status = 'Send' WHERE id = ?"
        ).bind(id).run();

        return c.json({ success: true, message: 'Manual reminder terkirim via WhatsApp' });
    } catch (error: any) {
        console.error("Error memanggil WAHA:", error);
        return c.json({ success: false, message: 'Terjadi kesalahan saat menghubungi server WAHA: ' + error.message }, 500);
    }
});

export default api;