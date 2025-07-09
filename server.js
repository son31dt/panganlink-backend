// Import library yang dibutuhkan
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    // Mengambil koneksi dari DATABASE_URL yang ada di Render
    connectionString: process.env.DATABASE_URL,
    // Baris ini diperlukan untuk koneksi ke database di platform seperti Render
    ssl: {
        rejectUnauthorized: false
    }
});

// Inisialisasi aplikasi express
const app = express();
const port = 3000; // Port tempat server akan berjalan

const cors = require('cors'); // Import library cors
app.use(cors()); // Terapkan sebagai middleware

// Middleware untuk membaca JSON dari request body
app.use(express.json());

// !! TAMBAHKAN KODE INI !!
// Middleware untuk logging setiap request yang masuk
app.use((req, res, next) => {
    console.log(`Request diterima: ${req.method} ${req.path}`);
    next(); // Lanjutkan ke proses selanjutnya
});
// !! BATAS AKHIR KODE TAMBAHAN !!

// === ENDPOINT API ANDA AKAN DITULIS DI SINI ===

// Contoh Endpoint: Registrasi Pengguna Baru
// Ini adalah implementasi dari salah satu kebutuhan fungsional Anda
app.post('/api/users/register', async (req, res) => {
    try {
        const { nama, email, password } = req.body;

        // Validasi sederhana
        if (!nama || !email || !password) {
            return res.status(400).json({ message: 'Nama, email, dan password harus diisi' });
        }

        // PERHATIAN: Dalam aplikasi nyata, password harus di-hash! [cite: 93]
        // Ini adalah implementasi sederhana untuk belajar.
        // --- PERUBAHAN DI SINI ---
        // Hash password sebelum disimpan
        const saltRounds = 10; // Standar industri
        const password_hash = await bcrypt.hash(password, saltRounds);
        // --- AKHIR PERUBAHAN ---

        const newUser = await pool.query(
            "INSERT INTO Users (nama, email, password_hash) VALUES ($1, $2, $3) RETURNING *",
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

        // 1. Cari pengguna berdasarkan email
        const userResult = await pool.query("SELECT * FROM Users WHERE email = $1", [email]);

        if (userResult.rows.length === 0) {
            // Jika email tidak ditemukan
            return res.status(401).json({ message: 'Email atau password salah' });
        }

        const user = userResult.rows[0];

        // 2. Bandingkan password yang diberikan dengan hash di database
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            // Jika password tidak cocok
            return res.status(401).json({ message: 'Email atau password salah' });
        }

        // 3. Jika berhasil, kirim respons sukses
        // (Di aplikasi nyata, di sini Anda akan membuat token JWT, tapi untuk sekarang ini sudah cukup)
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

// Endpoint untuk mengambil semua produk
app.get('/api/produk', async (req, res) => {
    try {
        const semuaProduk = await pool.query("SELECT * FROM Produk ORDER BY produk_id DESC");
        res.json(semuaProduk.rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
});

// Endpoint untuk mengambil SATU produk berdasarkan ID
app.get('/api/produk/:id', async (req, res) => {
    try {
        const { id } = req.params; // Mengambil ID dari parameter URL
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
    // Di aplikasi nyata, Anda harus memvalidasi bahwa user ini adalah pemilik toko
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
    // Validasi pemilik toko juga dibutuhkan di sini
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
    // Validasi pemilik toko juga dibutuhkan di sini
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

// Endpoint untuk MEMBUAT TOKO baru
app.post('/api/toko', async (req, res) => {
    const { user_id, nama_toko, deskripsi } = req.body;

    // Validasi sederhana
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
        // Error ini akan terjadi jika user sudah punya toko (karena user_id bersifat UNIQUE)
        console.error(error.message);
        if (error.code === '23505') { // Kode error untuk unique violation
            return res.status(409).json({ message: 'Anda sudah memiliki toko.' });
        }
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// Endpoint untuk MEMBUAT PESANAN BARU
app.post('/api/pesanan', async (req, res) => {
    const { user_id, total_harga, alamat_pengiriman, items } = req.body;

    // Pastikan ada item di keranjang
    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'Keranjang tidak boleh kosong.' });
    }

    const client = await pool.connect(); // Ambil koneksi dari pool

    try {
        // Mulai transaksi
        await client.query('BEGIN');

        // 1. Masukkan ke tabel Pesanan
        const pesananQuery = `INSERT INTO Pesanan (user_id, total_harga, alamat_pengiriman, status_pesanan) 
                              VALUES ($1, $2, $3, 'Baru') RETURNING pesanan_id`;
        const pesananResult = await client.query(pesananQuery, [user_id, total_harga, alamat_pengiriman]);
        const newPesananId = pesananResult.rows[0].pesanan_id;

        // 2. Loop dan masukkan setiap item ke tabel Detail_Pesanan
        for (const item of items) {
            // Ambil harga produk saat ini dari database untuk keamanan
            const produkResult = await client.query('SELECT harga FROM Produk WHERE produk_id = $1', [item.id]);
            const hargaSaatPesan = produkResult.rows[0].harga;

            const detailQuery = `INSERT INTO Detail_Pesanan (pesanan_id, produk_id, jumlah, harga_saat_pesan) 
                                 VALUES ($1, $2, $3, $4)`;
            await client.query(detailQuery, [newPesananId, item.id, item.quantity, hargaSaatPesan]);
        }

        // Jika semua berhasil, simpan transaksi
        await client.query('COMMIT');
        res.status(201).json({ message: 'Pesanan berhasil dibuat.', pesanan_id: newPesananId });

    } catch (error) {
        // Jika ada satu saja yang gagal, batalkan semua
        await client.query('ROLLBACK');
        console.error('Error saat membuat pesanan:', error);
        res.status(500).json({ message: 'Gagal membuat pesanan.' });
    } finally {
        // Selalu lepaskan koneksi
        client.release();
    }
});

// Endpoint untuk mengambil SEMUA PESANAN yang terkait dengan sebuah TOKO
app.get('/api/pesanan/toko/:tokoId', async (req, res) => {
    const { tokoId } = req.params;
    try {
        // Query ini menggabungkan beberapa tabel untuk menemukan semua pesanan
        // yang di dalamnya ada produk dari toko yang spesifik.
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

// Menjalankan server
app.listen(port, () => {
    console.log(`Server PanganLink berjalan di http://localhost:${port}`);
});