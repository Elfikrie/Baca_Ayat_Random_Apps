# Baca Ayat

Web sederhana untuk berlatih membaca ayat Al-Qur'an pendek dengan mikrofon. Aplikasi menampilkan satu ayat acak, lalu Web Speech API mengenali bacaan pengguna dalam bahasa Arab (`ar-SA`). Teks bacaan dinormalisasi dan dibandingkan dengan ayat menggunakan kemiripan Levenshtein. Jika nilai kemiripan memenuhi ambang, skor bertambah dan sistem otomatis menampilkan ayat lain. Pengguna tidak memiliki tombol untuk mengganti atau melewati ayat.

## Kompatibilitas

Web Speech API paling stabil di Google Chrome dan Microsoft Edge. Browser akan meminta izin mikrofon saat tombol **Mulai Membaca** ditekan. Fitur mikrofon umumnya membutuhkan HTTPS atau `localhost`; karena itu jangan membuka `index.html` langsung dengan klik dua kali.

## Menjalankan aplikasi

1. Buka terminal di folder proyek ini.
2. Jalankan `python -m http.server 8000`.
3. Buka `http://localhost:8000` di Chrome atau Edge.

Alternatifnya, buka folder ini melalui VS Code lalu jalankan ekstensi **Live Server**.

## Struktur

```
Baca-Ayat/
├── index.html  # struktur halaman
├── style.css   # tampilan responsif
├── script.js   # mikrofon, API, dan pencocokan
├── ayat.json   # ayat pendek cadangan
└── README.md
```

## Logika pencocokan

Sebelum dibandingkan, `normalizeArabic()` menghapus harakat dan tanda baca, menyamakan variasi alif, ya, serta ta marbuta. Kemudian algoritma Levenshtein menghitung perbedaan karakter minimum; hasilnya diubah menjadi persentase kemiripan. Nilai minimal kelulusan diatur oleh konstanta `SIMILARITY_THRESHOLD` pada awal `script.js`, saat ini `80`; naikkan nilainya (misalnya `90`) agar lebih ketat atau turunkan (misalnya `70`) agar lebih toleran.

Data mula-mula dibaca dari `ayat.json`, lalu aplikasi berusaha mengambil ayat pendek secara acak dari AlQuran Cloud. Jika API atau koneksi gagal, aplikasi tetap memakai data lokal tanpa mengubah teks ayat.

## Troubleshooting

- **Mikrofon tidak terdeteksi:** pastikan perangkat terhubung, pilih mikrofon yang benar di pengaturan sistem, lalu izinkan akses mikrofon pada ikon gembok di browser.
- **Hasil pengenalan kurang akurat:** gunakan Chrome/Edge, kurangi kebisingan, pastikan bahasa pengenalan Arab tersedia, dan baca perlahan dengan pelafalan jelas.
- **Pesan `network` saat membaca:** ini berarti browser tidak dapat menghubungi layanan pengenalan suara Web Speech API, bukan API ayat. Pastikan internet aktif, buka aplikasi melalui `localhost`/HTTPS, lalu periksa VPN, proxy, firewall, atau jaringan kantor/sekolah yang mungkin memblokir layanan Google.
- **API gagal dimuat:** periksa koneksi internet; aplikasi otomatis beralih ke `ayat.json` sebagai cadangan.
- **Muncul pesan data tidak dapat dimuat:** jalankan lewat `python -m http.server 8000` atau Live Server, bukan dari berkas lokal (`file://`).

## Pengembangan berikutnya

- Mode hafalan yang menyembunyikan sebagian atau seluruh teks ayat.
- Pilihan surah dan tingkat kesulitan ayat.
- Penilaian tajwid dengan layanan pemrosesan suara khusus.
- Riwayat bacaan dan statistik latihan harian.
