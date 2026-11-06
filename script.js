// Ambang kelulusan. Naikkan untuk penilaian lebih ketat, turunkan agar lebih longgar.
const SIMILARITY_THRESHOLD = 80;
const API_URL = "https://api.alquran.cloud/v1/ayah/random/quran-uthmani";

const elements = {
  ayahText: document.querySelector("#ayahText"),
  surahInfo: document.querySelector("#surahInfo"),
  dataSource: document.querySelector("#dataSource"),
  startButton: document.querySelector("#startButton"),
  micStatus: document.querySelector("#micStatus"),
  micStatusText: document.querySelector("#micStatusText"),
  transcript: document.querySelector("#transcript"),
  feedback: document.querySelector("#feedback"),
  similarityInfo: document.querySelector("#similarityInfo"),
  score: document.querySelector("#score")
};

let currentAyah;
let fallbackAyat = [];
let score = 0;
let recognition;
let isListening = false;
let isAdvancing = false;

// Menghapus variasi tulisan yang tidak perlu dibandingkan, tanpa mengubah teks yang ditampilkan.
function normalizeArabic(text = "") {
  return text
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "") // harakat dan tanda Al-Qur'an
    .replace(/ـ/g, "") // tatweel/pemanjang huruf
    .replace(/[إأآٱ]/g, "ا") // bentuk alif
    .replace(/ى/g, "ي") // alif maqsurah
    .replace(/ة/g, "ه") // ta marbuta
    .replace(/[\u200C\u200D]/g, "")
    .replace(/[^\u0621-\u063A\u0641-\u064A\s]/g, "") // buang tanda baca
    .replace(/\s+/g, " ")
    .trim();
}

// Levenshtein menghitung jumlah perubahan huruf minimum dari satu teks ke teks lain.
function levenshteinDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length];
}

function similarityPercent(reference, spoken) {
  const target = normalizeArabic(reference);
  const result = normalizeArabic(spoken);
  if (!target || !result) return 0;
  const longest = Math.max(target.length, result.length);
  return Math.round((1 - levenshteinDistance(target, result) / longest) * 100);
}

function wordCount(text) {
  return normalizeArabic(text).split(" ").filter(Boolean).length;
}

function showFeedback(message, type = "") {
  elements.feedback.textContent = message;
  elements.feedback.className = `feedback ${type}`;
}

function renderAyah(ayah) {
  currentAyah = ayah;
  elements.ayahText.textContent = ayah.text;
  elements.surahInfo.textContent = `${ayah.surahArabic || ayah.surah} — ${ayah.surah}, ayat ${ayah.number}`;
  elements.dataSource.textContent = ayah.source === "API" ? "Sumber: AlQuran Cloud (Quran Uthmani)" : "Sumber cadangan: data ayat lokal";
  elements.transcript.textContent = "Belum ada bacaan.";
  elements.similarityInfo.textContent = "";
  showFeedback("Silakan mulai membaca.");
}

function randomFallback(excludeText = "") {
  const choices = fallbackAyat.filter((ayah) => ayah.text !== excludeText);
  return choices[Math.floor(Math.random() * choices.length)] || fallbackAyat[0];
}

async function loadFallbackAyat() {
  const response = await fetch("ayat.json");
  if (!response.ok) throw new Error("Data cadangan tidak dapat dimuat.");
  fallbackAyat = await response.json();
  fallbackAyat = fallbackAyat.map((ayah) => ({ ...ayah, source: "lokal" }));
}

// API diulang beberapa kali karena ayat acaknya bisa lebih panjang dari batas 10 kata.
async function getShortAyahFromApi() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await fetch(API_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("API tidak merespons.");
    const payload = await response.json();
    const data = payload.data;
    if (data && wordCount(data.text) <= 10 && data.text !== currentAyah?.text) {
      return {
        text: data.text,
        surah: data.surah.englishName,
        surahArabic: data.surah.name,
        number: data.numberInSurah,
        source: "API"
      };
    }
  }
  throw new Error("Belum mendapat ayat pendek dari API.");
}

async function loadNextAyah() {
  elements.startButton.disabled = true;
  elements.surahInfo.textContent = "Memilih ayat berikutnya…";
  try {
    renderAyah(await getShortAyahFromApi());
  } catch (error) {
    // Jika offline/API gagal, latihan tetap dapat berjalan memakai ayat tepercaya di ayat.json.
    renderAyah(randomFallback(currentAyah?.text));
    elements.dataSource.textContent += " (API sedang tidak tersedia)";
  } finally {
    isAdvancing = false;
    elements.startButton.disabled = !recognition;
  }
}

function setListening(active) {
  isListening = active;
  elements.micStatus.classList.toggle("listening", active);
  elements.micStatusText.textContent = active ? "Mikrofon aktif, sedang mendengarkan…" : "Mikrofon belum aktif";
  elements.startButton.disabled = active || !recognition || isAdvancing;
  elements.startButton.innerHTML = active ? "<span aria-hidden=\"true\">●</span> Sedang Mendengarkan" : "<span aria-hidden=\"true\">🎙</span> Mulai Membaca";
}

function evaluateReading(finalText) {
  const similarity = similarityPercent(currentAyah.text, finalText);
  elements.similarityInfo.textContent = `Kemiripan bacaan: ${similarity}% (target ${SIMILARITY_THRESHOLD}%)`;
  if (similarity >= SIMILARITY_THRESHOLD) {
    isAdvancing = true; // Mencegah penilaian kedua sebelum ayat baru tampil.
    score += 1;
    elements.score.textContent = score;
    showFeedback("Benar! MasyaAllah, menyiapkan ayat berikutnya…", "success");
    elements.startButton.disabled = true;
    window.setTimeout(loadNextAyah, 1400);
  } else {
    showFeedback("Coba lagi. Baca ayat yang sama dengan lebih pelan dan jelas.", "error");
  }
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showFeedback("Browser ini belum mendukung pengenalan suara. Gunakan Google Chrome atau Microsoft Edge.", "error");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "ar-SA";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => setListening(true);
  recognition.onend = () => { if (isListening) setListening(false); };
  recognition.onresult = (event) => {
    let liveText = "";
    let finalText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0].transcript;
      liveText += text;
      if (event.results[i].isFinal) finalText += text;
    }
    elements.transcript.textContent = liveText || "Mendengarkan…";
    if (finalText) evaluateReading(finalText);
  };
  recognition.onerror = (event) => {
    const messages = {
      "not-allowed": "Izin mikrofon ditolak. Izinkan mikrofon dari pengaturan browser.",
      "service-not-allowed": "Layanan pengenalan suara tidak diizinkan oleh browser.",
      "no-speech": "Suara tidak terdeteksi. Coba lagi dan baca lebih dekat ke mikrofon.",
      "audio-capture": "Mikrofon tidak ditemukan. Periksa perangkat mikrofon Anda.",
      // SpeechRecognition Chrome/Edge memakai layanan daring; ini bukan kegagalan API ayat.
      "network": "Layanan pengenalan suara tidak dapat dijangkau. Periksa internet, nonaktifkan VPN/proxy bila ada, lalu coba Chrome atau Edge melalui localhost/HTTPS."
    };
    showFeedback(messages[event.error] || `Terjadi masalah mikrofon: ${event.error}.`, "error");
  };

  elements.startButton.disabled = false;
}

elements.startButton.addEventListener("click", () => {
  if (!recognition || isListening || isAdvancing) return;
  elements.transcript.textContent = "Mendengarkan…";
  elements.similarityInfo.textContent = "";
  showFeedback("Silakan baca ayat yang ditampilkan.");
  try { recognition.start(); } catch { /* start dipanggil saat proses sebelumnya belum selesai */ }
});

async function initialize() {
  try {
    await loadFallbackAyat();
    renderAyah(randomFallback());
  } catch (error) {
    showFeedback("Data ayat tidak dapat dimuat. Jalankan aplikasi melalui server lokal.", "error");
    elements.ayahText.textContent = "Gagal memuat ayat";
  }
  setupSpeechRecognition();
}

initialize();
