// Import library yang dibutuhkan
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');

// Konfigurasi koneksi ke database
const pool = new Pool({
    // Mengambil koneksi dari DATABASE_URL yang ada di Replit/Render
    connectionString: process.env.DATABASE_URL,
    // Baris ini diperlukan untuk koneksi ke database di platform cloud
    ssl: {
        rejectUnauthorized: false
    }
});

// Inisialisasi aplikasi express
const app = express();
const port = 3000;

// Middleware
app.use(cors()); // Mengizinkan koneksi dari domain lain (frontend)
app.use(express.json()); // Membaca JSON dari body request

// Middleware untuk logging setiap request yang masuk
app.use((req, res, next) => {
    console.log(`Request diterima: ${req.method} ${req.path}`);
    next();
});


// ===============================================
// == ENDPOINTS UNTUK OTENTIKASI PENGGUNA (USERS) ==
// ===============================================

// Endpoint untuk Registrasi Pengguna Baru
app.post('/api/users/register', async (req, res) => {
    try {
        const { nama, email, password } = req.body;
        if (!nama || !email || !password) {
            return res.status(400).json({ message: 'Nama, email, dan password harus diisi' });
        }
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);
        const newUser = await pool.query(
            "INSERT INTO Users (nama, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id, nama, email",
            [nama, email, password_hash]
        );
        res.status(201).json({
            message: 'Pengguna berhasil terdaftar',
            user: newUser.rows[0]
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
});

// Endpoint untuk Login Pengguna
app.post('/api/users/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const userResult = await pool.query("SELECT * FROM Users WHERE email = $1", [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Email atau password salah' });
        }
        const user = userResult.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Email atau password salah' });
        }
        res.status(200).json({
            message: 'Login berhasil',
            user: {
                user_id: user.user_id,
                nama: user.nama,
                email: user.email
            }
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
});


// =========================================
// == ENDPOINTS UNTUK PRODUK DAN KATALOG  ==
// =========================================

// ### PERUBAHAN UTAMA DI SINI ###
// Endpoint untuk mengambil semua produk dengan filter
app.get('/api/produk', async (req, res) => {
    try {
        const { search, kategori, lokasi } = req.query;

        let baseQuery = `
            SELECT p.*, t.nama_toko, t.lokasi 
            FROM Produk p 
            JOIN Toko t ON p.toko_id = t.toko_id
        `;
        const params = [];
        const conditions = [];

        if (search) {
            params.push(`%${search}%`);
            conditions.push(`p.nama_produk ILIKE $${params.length}`);
        }
        if (kategori) {
            params.push(kategori);
            conditions.push(`p.kategori_id = $${params.length}`);
        }
        if (lokasi) {
            params.push(lokasi);
            conditions.push(`t.lokasi = $${params.length}`);
        }

        if (conditions.length > 0) {
            baseQuery += " WHERE " + conditions.join(" AND ");
        }

        baseQuery += " ORDER BY p.nama_produk";

        const semuaProduk = await pool.query(baseQuery, params);
        res.json(semuaProduk.rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
});

// Endpoint untuk mengambil SATU produk berdasarkan ID
app.get('/api/produk/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await pool.query("SELECT * FROM Produk WHERE produk_id = $1", [id]);
        if (product.rows.length === 0) {
            return res.status(404).json({ message: 'Produk tidak ditemukan' });
        }
        res.json(product.rows[0]);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
});

// Endpoint untuk MENAMBAH produk baru
app.post('/api/produk', async (req, res) => {
    const { toko_id, kategori_id, nama_produk, deskripsi, harga, satuan, stok, url_gambar } = req.body;
    try {
        const newProduct = await pool.query(
            `INSERT INTO Produk (toko_id, kategori_id, nama_produk, deskripsi, harga, satuan, stok, url_gambar) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [toko_id, kategori_id, nama_produk, deskripsi, harga, satuan, stok, url_gambar]
        );
        res.status(201).json(newProduct.rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Endpoint untuk MENGUBAH produk
app.put('/api/produk/:id', async (req, res) => {
    const { id } = req.params;
    const { nama_produk, deskripsi, harga, satuan, stok, url_gambar } = req.body;
    try {
        const updatedProduct = await pool.query(
            `UPDATE Produk SET nama_produk = $1, deskripsi = $2, harga = $3, satuan = $4, stok = $5, url_gambar = $6
             WHERE produk_id = $7 RETURNING *`,
            [nama_produk, deskripsi, harga, satuan, stok, url_gambar, id]
        );
        if (updatedProduct.rows.length === 0) {
            return res.status(404).json({ message: "Produk tidak ditemukan" });
        }
        res.json(updatedProduct.rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Endpoint untuk MENGHAPUS produk
app.delete('/api/produk/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const deletedProduct = await pool.query("DELETE FROM Produk WHERE produk_id = $1 RETURNING *", [id]);
        if (deletedProduct.rows.length === 0) {
            return res.status(404).json({ message: "Produk tidak ditemukan" });
        }
        res.json({ message: `Produk '${deletedProduct.rows[0].nama_produk}' berhasil dihapus.` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Endpoint untuk mengambil SEMUA kategori
app.get('/api/kategori', async (req, res) => {
    try {
        const semuaKategori = await pool.query("SELECT * FROM Kategori ORDER BY nama_kategori");
        res.json(semuaKategori.rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
});


// =========================================
// == ENDPOINTS UNTUK MANAJEMEN TOKO      ==
// =========================================

// Endpoint untuk MEMBUAT TOKO baru
app.post('/api/toko', async (req, res) => {
    const { user_id, nama_toko, deskripsi } = req.body;
    if (!user_id || !nama_toko) {
        return res.status(400).json({ message: 'Nama toko harus diisi.' });
    }
    try {
        const newToko = await pool.query(
            `INSERT INTO Toko (user_id, nama_toko, deskripsi, status_verifikasi) 
             VALUES ($1, $2, $3, 'terverifikasi') RETURNING *`,
            [user_id, nama_toko, deskripsi]
        );
        res.status(201).json(newToko.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Anda sudah memiliki toko.' });
        }
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// Endpoint untuk mengambil info TOKO berdasarkan USER_ID
app.get('/api/toko/by-user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const toko = await pool.query("SELECT * FROM Toko WHERE user_id = $1", [userId]);
        if (toko.rows.length === 0) {
            return res.status(404).json({ message: 'Toko untuk pengguna ini tidak ditemukan.' });
        }
        res.json(toko.rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Endpoint untuk mengambil semua PRODUK berdasarkan TOKO_ID
app.get('/api/toko/:tokoId/produk', async (req, res) => {
    try {
        const { tokoId } = req.params;
        const products = await pool.query("SELECT * FROM Produk WHERE toko_id = $1 ORDER BY produk_id DESC", [tokoId]);
        res.json(products.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// =========================================
// == ENDPOINTS UNTUK MANAJEMEN PESANAN   ==
// =========================================

// Endpoint untuk MEMBUAT PESANAN BARU (dengan pengurangan stok)
app.post('/api/pesanan', async (req, res) => {
    const { user_id, total_harga, alamat_pengiriman, items } = req.body;
    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'Keranjang tidak boleh kosong.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const pesananQuery = `INSERT INTO Pesanan (user_id, total_harga, alamat_pengiriman, status_pesanan) 
                              VALUES ($1, $2, $3, 'Baru') RETURNING pesanan_id`;
        const pesananResult = await client.query(pesananQuery, [user_id, total_harga, alamat_pengiriman]);
        const newPesananId = pesananResult.rows[0].pesanan_id;

        for (const item of items) {
            const produkResult = await client.query('SELECT harga, stok FROM Produk WHERE produk_id = $1 FOR UPDATE', [item.id]);
            const product = produkResult.rows[0];
            if (product.stok < item.quantity) {
                throw new Error(`Stok untuk produk tidak mencukupi.`);
            }
            await client.query('UPDATE Produk SET stok = stok - $1 WHERE produk_id = $2', [item.quantity, item.id]);
            const detailQuery = `INSERT INTO Detail_Pesanan (pesanan_id, produk_id, jumlah, harga_saat_pesan) 
                                 VALUES ($1, $2, $3, $4)`;
            await client.query(detailQuery, [newPesananId, item.id, item.quantity, product.harga]);
        }
        await client.query('COMMIT');
        res.status(201).json({ message: 'Pesanan berhasil dibuat.', pesanan_id: newPesananId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saat membuat pesanan:', error.message);
        res.status(500).json({ message: 'Gagal membuat pesanan: ' + error.message });
    } finally {
        client.release();
    }
});

// Endpoint untuk mengambil SEMUA PESANAN yang terkait dengan sebuah TOKO
app.get('/api/pesanan/toko/:tokoId', async (req, res) => {
    const { tokoId } = req.params;
    try {
        const query = `
            SELECT DISTINCT p.pesanan_id, p.tanggal_pesanan, p.total_harga, p.status_pesanan, u.nama AS nama_pembeli
            FROM Pesanan p
            JOIN Detail_Pesanan dp ON p.pesanan_id = dp.pesanan_id
            JOIN Produk pr ON dp.produk_id = pr.produk_id
            JOIN Users u ON p.user_id = u.user_id
            WHERE pr.toko_id = $1
            ORDER BY p.tanggal_pesanan DESC;
        `;
        const result = await pool.query(query, [tokoId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error mengambil pesanan toko:', error.message);
        res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
});

// Endpoint untuk MENGUBAH STATUS PESANAN
app.put('/api/pesanan/:pesananId/status', async (req, res) => {
    const { pesananId } = req.params;
    const { status } = req.body;
    if (!status) {
        return res.status(400).json({ message: 'Status tidak boleh kosong.' });
    }
    try {
        const updatedPesanan = await pool.query(
            "UPDATE Pesanan SET status_pesanan = $1 WHERE pesanan_id = $2 RETURNING *",
            [status, pesananId]
        );
        if (updatedPesanan.rows.length === 0) {
            return res.status(404).json({ message: "Pesanan tidak ditemukan." });
        }
        res.json(updatedPesanan.rows[0]);
    } catch (error) {
        console.error('Error mengubah status pesanan:', error.message);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});


// Menjalankan server
app.listen(port, () => {
    console.log(`Server PanganLink berjalan di http://localhost:${port}`);
});
