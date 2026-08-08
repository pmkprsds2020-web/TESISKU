// TeenMind Research - Instrumen Penelitian (SESUAI LAMPIRAN BORANG PENELITIAN)
// Berisi seluruh kuesioner sesuai borang tesis yang diunggah.

export type LikertOption = {
  value: number
  label: string
  emoji: string
  color: string
  description?: string
}

// ============================================================
// DEMOGRAFI (Lampiran 1: Data Demografi dan Informasi Umum)
// Termasuk Bagian I-B: Riwayat Kesehatan
// ============================================================
export type DemographicField =
  | { key: string; type: "text" | "number"; label: string; placeholder?: string; icon: string }
  | { key: string; type: "select"; label: string; icon: string; options: { value: string; label: string }[] }

export const DEMOGRAPHIC_FIELDS: DemographicField[] = [
  { key: "initial", type: "text", label: "Nama (inisial)", placeholder: "Mis. A", icon: "🔤" },
  { key: "age", type: "number", label: "Usia", placeholder: "12-16", icon: "🎂" },
  {
    key: "gender",
    type: "select",
    label: "Jenis kelamin",
    icon: "🧑",
    options: [
      { value: "laki-laki", label: "Laki-laki" },
      { value: "perempuan", label: "Perempuan" },
    ],
  },
  {
    key: "classGrade",
    type: "select",
    label: "Kelas / Tingkat pendidikan",
    icon: "📚",
    options: [
      { value: "SMP Kelas 7", label: "SMP Kelas 7" },
      { value: "SMP Kelas 8", label: "SMP Kelas 8" },
      { value: "SMP Kelas 9", label: "SMP Kelas 9" },
      { value: "SMA Kelas 10", label: "SMA Kelas 10" },
      { value: "SMA Kelas 11", label: "SMA Kelas 11" },
      { value: "SMA Kelas 12", label: "SMA Kelas 12" },
      { value: "SMK Kelas 10", label: "SMK Kelas 10" },
      { value: "SMK Kelas 11", label: "SMK Kelas 11" },
      { value: "SMK Kelas 12", label: "SMK Kelas 12" },
    ],
  },
  { key: "school", type: "text", label: "Nama sekolah", placeholder: "Nama sekolah", icon: "🏫" },
  {
    key: "parentIncome",
    type: "select",
    label: "Pendapatan keluarga per bulan (perkiraan)",
    icon: "💰",
    options: [
      { value: "<1.5jt", label: "< Rp 1.500.000" },
      { value: "1.5-3jt", label: "Rp 1.500.000 – Rp 3.000.000" },
      { value: "3-5jt", label: "Rp 3.000.001 – Rp 5.000.000" },
      { value: ">5jt", label: "> Rp 5.000.000" },
    ],
  },
  {
    key: "fatherEducation",
    type: "select",
    label: "Pendidikan terakhir ayah",
    icon: "👨‍🎓",
    options: [
      { value: "SD", label: "SD" },
      { value: "SMP", label: "SMP" },
      { value: "SMA", label: "SMA" },
      { value: "D3/S1", label: "D3 / S1" },
      { value: "S2/S3", label: "S2 / S3" },
    ],
  },
  {
    key: "motherEducation",
    type: "select",
    label: "Pendidikan terakhir ibu",
    icon: "👩‍🎓",
    options: [
      { value: "SD", label: "SD" },
      { value: "SMP", label: "SMP" },
      { value: "SMA", label: "SMA" },
      { value: "D3/S1", label: "D3 / S1" },
      { value: "S2/S3", label: "S2 / S3" },
    ],
  },
  {
    key: "familyComposition",
    type: "select",
    label: "Komposisi keluarga saat ini",
    icon: "👨‍👩‍👧‍👦",
    options: [
      { value: "utuh", label: "Tinggal bersama kedua orang tua (utuh)" },
      { value: "cerai", label: "Orang tua bercerai / pisah" },
      { value: "meninggal", label: "Salah satu orang tua meninggal" },
      { value: "wali", label: "Tinggal bersama wali / keluarga lain" },
    ],
  },
  // Bagian I-B: Riwayat Kesehatan
  {
    key: "chronicIllness",
    type: "select",
    label: "Apakah kamu saat ini menderita penyakit kronis (penyakit yang sudah berlangsung ≥3 bulan dan didiagnosis oleh dokter)? Contoh: asma, diabetes, epilepsi, penyakit jantung, dll.",
    icon: "🩺",
    options: [
      { value: "ya", label: "Ya, sebutkan" },
      { value: "tidak", label: "Tidak" },
    ],
  },
  {
    key: "chronicTreatment",
    type: "select",
    label: "Jika Ya, apakah penyakit tersebut sudah mendapat pengobatan rutin dari dokter?",
    icon: "💊",
    options: [
      { value: "rutin", label: "Ya, rutin berobat" },
      { value: "tidak-rutin", label: "Ya, tetapi tidak rutin" },
      { value: "belum", label: "Belum berobat" },
      { value: "tidak-berlaku", label: "Tidak berlaku (tidak ada penyakit kronis)" },
    ],
  },
  {
    key: "mentalHistory",
    type: "select",
    label: "Apakah kamu pernah didiagnosis atau mendapat penanganan dari dokter/psikolog karena depresi atau gangguan mental lainnya sebelum penelitian ini?",
    icon: "🧠",
    options: [
      { value: "depresi", label: "Ya, pernah didiagnosis depresi" },
      { value: "lainnya", label: "Ya, gangguan mental lain" },
      { value: "tidak", label: "Tidak pernah" },
    ],
  },
  {
    key: "mentalTreatment",
    type: "select",
    label: "Jika pernah, apakah saat ini masih dalam pengobatan atau terapi?",
    icon: "🏥",
    options: [
      { value: "masih", label: "Ya, masih dalam pengobatan" },
      { value: "selesai", label: "Sudah selesai pengobatan" },
      { value: "tidak-berlaku", label: "Tidak berlaku" },
    ],
  },
]

// ============================================================
// CESD-R (Lampiran 2: Skala Depresi)
// 20 item, skala 0-3, cut-off ≥16 = depresi
// Item 18 = sentinel (pikiran menyakiti diri sendiri)
// ============================================================
export const CESDR_OPTIONS: LikertOption[] = [
  { value: 0, label: "Tidak Pernah", emoji: "🔵", color: "from-sky-100 to-sky-50 border-sky-300 data-[selected=true]:border-sky-500 data-[selected=true]:bg-sky-100", description: "0 hari" },
  { value: 1, label: "Kadang-kadang / Jarang", emoji: "🟢", color: "from-emerald-100 to-emerald-50 border-emerald-300 data-[selected=true]:border-emerald-500 data-[selected=true]:bg-emerald-100", description: "1-2 hari" },
  { value: 2, label: "Cukup Sering", emoji: "🟡", color: "from-amber-100 to-amber-50 border-amber-300 data-[selected=true]:border-amber-500 data-[selected=true]:bg-amber-100", description: "3-4 hari" },
  { value: 3, label: "Hampir Setiap Hari", emoji: "🔴", color: "from-rose-100 to-rose-50 border-rose-300 data-[selected=true]:border-rose-500 data-[selected=true]:bg-rose-100", description: "5-7 hari" },
]

export const CESDR_ITEMS: { id: number; text: string; subscale: string }[] = [
  { id: 1, text: "Saya merasa sedih atau murung.", subscale: "Dysphoria" },
  { id: 2, text: "Saya merasa tidak ada harapan untuk masa depan.", subscale: "Dysphoria" },
  { id: 3, text: "Saya tidak merasa bahagia atau menikmati hal-hal yang biasanya aku sukai.", subscale: "Anhedonia" },
  { id: 4, text: "Saya merasa hidup saya tidak berarti.", subscale: "Anhedonia" },
  { id: 5, text: "Nafsu makan saya berkurang, meskipun saya tidak sengaja diet.", subscale: "Appetite" },
  { id: 6, text: "Saya makan lebih banyak dari biasanya.", subscale: "Appetite" },
  { id: 7, text: "Saya sulit tidur atau tidur saya terganggu.", subscale: "Sleep" },
  { id: 8, text: "Saya tidur lebih banyak dari biasanya (mengantuk berlebihan).", subscale: "Sleep" },
  { id: 9, text: "Saya sulit berkonsentrasi atau berpikir jernih.", subscale: "Thinking" },
  { id: 10, text: "Saya membuat keputusan dengan sangat lambat.", subscale: "Thinking" },
  { id: 11, text: "Saya merasa diri saya buruk, tidak berharga, atau bersalah.", subscale: "Guilt" },
  { id: 12, text: "Saya merasa orang-orang tidak menyukai saya.", subscale: "Guilt" },
  { id: 13, text: "Saya merasa lelah atau tidak punya energi.", subscale: "Fatigue" },
  { id: 14, text: "Segala sesuatu terasa berat dan membutuhkan usaha keras.", subscale: "Fatigue" },
  { id: 15, text: "Saya berbicara atau bergerak lebih lambat dari biasanya.", subscale: "Agitation" },
  { id: 16, text: "Saya merasa gelisah dan tidak bisa diam.", subscale: "Agitation" },
  { id: 17, text: "Saya berpikir tentang kematian.", subscale: "Suicidal" },
  { id: 18, text: "Saya berpikir untuk menyakiti diri sendiri.", subscale: "Suicidal" },
  { id: 19, text: "Saya merasa kesepian.", subscale: "Dysphoria" },
  { id: 20, text: "Saya merasa tidak dicintai.", subscale: "Guilt" },
]

export const CESDR_HIGH_RISK_ITEM = 18
export const CESDR_HIGH_RISK_THRESHOLD = 2 // Cukup Sering atau Hampir Setiap Hari

// ============================================================
// PSQI (Lampiran 3: Kualitas Tidur)
// Versi diperluas mendekati struktur resmi 19-item PSQI (Buysse et al. 1989):
// C1 kualitas subjektif, C2 latensi (durasi + item 5a), C3 durasi tidur,
// C4 efisiensi tidur, C5 gangguan tidur (rata-rata sub-item 5b-5j), C6 obat
// tidur, C7 disfungsi siang hari (2 sub-item). Cut-off global >5 = buruk.
//
// CATATAN KOMPATIBILITAS: item gabungan lama "sleepDisturbance" (1 item)
// TIDAK lagi ditampilkan di kuesioner baru — digantikan 10 sub-item granular
// (5a-5j) di bawah. scorePsqi() di src/lib/scoring.ts tetap bisa membaca data
// responden LAMA yang hanya punya "sleepDisturbance" (fallback ke formula
// adaptasi sebelumnya) maupun data BARU yang punya sub-item 5a-5j (formula
// mendekati resmi). Item "daySleepiness" (Q8) dipertahankan idnya supaya
// data lama tetap terbaca, dan "daytimeEnthusiasm" (Q9) ditambahkan sebagai
// sub-item kedua C7 sesuai struktur resmi.
// ============================================================
export type PsqiQuestion =
  | { id: string; type: "time"; label: string; icon: string }
  | { id: string; type: "number"; label: string; icon: string; unit: string; min: number; max: number }
  | { id: string; type: "likert"; label: string; icon: string; options: { value: number; label: string }[] }

const PSQI_FREQUENCY_OPTIONS = [
  { value: 0, label: "Tidak pernah (dalam 1 bulan terakhir)" },
  { value: 1, label: "Kurang dari sekali seminggu" },
  { value: 2, label: "Sekali atau dua kali seminggu" },
  { value: 3, label: "Tiga kali atau lebih seminggu" },
]

// Sub-item C5 (gangguan tidur) resmi 5a-5j. 5a dipakai untuk C2 (bersama
// durasi latensi), 5b-5j (9 item) dipakai untuk C5.
export const PSQI_DISTURBANCE_ITEMS: { id: string; text: string; icon: string }[] = [
  { id: "dist5a", text: "Tidak bisa tertidur dalam waktu 30 menit setelah berbaring", icon: "⏱️" },
  { id: "dist5b", text: "Terbangun di tengah malam atau dini hari", icon: "🌃" },
  { id: "dist5c", text: "Harus bangun untuk ke kamar mandi", icon: "🚻" },
  { id: "dist5d", text: "Tidak bisa bernapas dengan nyaman", icon: "😮‍💨" },
  { id: "dist5e", text: "Batuk atau mendengkur keras", icon: "😤" },
  { id: "dist5f", text: "Merasa kedinginan", icon: "🥶" },
  { id: "dist5g", text: "Merasa kepanasan", icon: "🥵" },
  { id: "dist5h", text: "Mengalami mimpi buruk", icon: "😰" },
  { id: "dist5i", text: "Merasa nyeri (sakit badan)", icon: "🤕" },
  { id: "dist5j", text: "Alasan lain yang mengganggu tidurmu", icon: "❓" },
]
/** id item 5a (masuk komponen C2), untuk dirujuk oleh scorePsqi(). */
export const PSQI_ITEM_5A_ID = "dist5a"
/** id item 5b-5j (9 item, masuk komponen C5), untuk dirujuk oleh scorePsqi(). */
export const PSQI_C5_SUBITEM_IDS = PSQI_DISTURBANCE_ITEMS.slice(1).map((d) => d.id)

export const PSQI_QUESTIONS: PsqiQuestion[] = [
  { id: "bedtime", type: "time", label: "Biasanya, jam berapa kamu mulai tidur di malam hari? (hari sekolah)", icon: "🌙" },
  { id: "sleepLatency", type: "number", label: "Biasanya, berapa menit yang kamu butuhkan untuk bisa tertidur setelah berbaring?", icon: "⏳", unit: "menit", min: 0, max: 180 },
  { id: "waketime", type: "time", label: "Biasanya, jam berapa kamu bangun di pagi hari? (hari sekolah)", icon: "☀️" },
  { id: "actualSleep", type: "number", label: "Berapa jam total kamu benar-benar tidur setiap malam? (bukan waktu berbaring)", icon: "😴", unit: "jam", min: 0, max: 12 },
  ...PSQI_DISTURBANCE_ITEMS.map((d) => ({
    id: d.id,
    type: "likert" as const,
    label: `Dalam 1 bulan terakhir, seberapa sering tidurmu terganggu karena: ${d.text.toLowerCase()}?`,
    icon: d.icon,
    options: PSQI_FREQUENCY_OPTIONS,
  })),
  {
    id: "sleepQuality",
    type: "likert",
    label: "Bagaimana kamu menilai kualitas tidurmu secara keseluruhan?",
    icon: "✨",
    options: [
      { value: 0, label: "Sangat baik" },
      { value: 1, label: "Cukup baik" },
      { value: 2, label: "Cukup buruk" },
      { value: 3, label: "Sangat buruk" },
    ],
  },
  {
    id: "sleepMedication",
    type: "likert",
    label: "Dalam 1 bulan terakhir, seberapa sering kamu minum obat (dari dokter maupun dibeli sendiri) untuk membantu tidur?",
    icon: "💊",
    options: PSQI_FREQUENCY_OPTIONS,
  },
  {
    id: "daySleepiness",
    type: "likert",
    label: "Seberapa sering kamu merasa mengantuk saat mengikuti pelajaran, makan, atau beraktivitas sosial?",
    icon: "🥱",
    options: PSQI_FREQUENCY_OPTIONS,
  },
  {
    id: "daytimeEnthusiasm",
    type: "likert",
    label: "Seberapa sering kamu merasa kurang bersemangat untuk menyelesaikan tugas atau kegiatan sehari-hari?",
    icon: "🔋",
    options: PSQI_FREQUENCY_OPTIONS,
  },
]

// ============================================================
// Screen Time dan Media Sosial (Lampiran 4)
// 6 pertanyaan, cut-off tinggi: >3 jam/hari
// ============================================================
export type ScreenTimeQuestion = {
  id: string
  type: "duration" | "platform" | "frequency"
  label: string
  icon: string
  options: { value: number; label: string }[]
}

export const SCREEN_TIME_QUESTIONS: ScreenTimeQuestion[] = [
  {
    id: "weekdayScreen",
    type: "duration",
    label: "Rata-rata, berapa jam per hari kamu menggunakan HP/laptop/tablet untuk hiburan atau media sosial di HARI SEKOLAH? (tidak termasuk untuk belajar)",
    icon: "📱",
    options: [
      { value: 0, label: "< 1 jam/hari" },
      { value: 1, label: "1–2 jam/hari" },
      { value: 2, label: "2–3 jam/hari" },
      { value: 3, label: "3–5 jam/hari" },
      { value: 4, label: "> 5 jam/hari" },
    ],
  },
  {
    id: "weekendScreen",
    type: "duration",
    label: "Rata-rata, berapa jam per hari kamu menggunakan HP/laptop/tablet untuk hiburan di AKHIR PEKAN?",
    icon: "🎮",
    options: [
      { value: 0, label: "< 1 jam/hari" },
      { value: 1, label: "1–2 jam/hari" },
      { value: 2, label: "2–3 jam/hari" },
      { value: 3, label: "3–5 jam/hari" },
      { value: 4, label: "> 5 jam/hari" },
    ],
  },
  {
    id: "socialCompare",
    type: "frequency",
    label: "Seberapa sering kamu membandingkan dirimu dengan orang lain setelah melihat postingan di media sosial?",
    icon: "💭",
    options: [
      { value: 0, label: "Tidak pernah" },
      { value: 1, label: "Jarang" },
      { value: 2, label: "Kadang-kadang" },
      { value: 3, label: "Sering" },
      { value: 4, label: "Selalu" },
    ],
  },
  {
    id: "cyberbullying",
    type: "frequency",
    label: "Apakah kamu pernah mengalami cyberbullying (diolok-olok, dihina, atau diintimidasi secara online) dalam 3 bulan terakhir?",
    icon: "⚠️",
    options: [
      { value: 0, label: "Tidak pernah" },
      { value: 1, label: "Ya, pernah (1–2 kali)" },
      { value: 2, label: "Ya, sering (lebih dari 2 kali)" },
    ],
  },
  {
    id: "sleepDelay",
    type: "frequency",
    label: "Seberapa sering penggunaan HP/media sosial membuat kamu tidak bisa tidur tepat waktu?",
    icon: "🌙",
    options: [
      { value: 0, label: "Tidak pernah" },
      { value: 1, label: "Jarang (<1x/minggu)" },
      { value: 2, label: "Kadang (1–2x/minggu)" },
      { value: 3, label: "Sering (≥3x/minggu)" },
    ],
  },
  {
    id: "platforms",
    type: "platform",
    label: "Platform media sosial apa yang paling sering kamu gunakan? (boleh pilih lebih dari satu)",
    icon: "📲",
    options: [
      { value: 0, label: "Instagram" },
      { value: 1, label: "TikTok" },
      { value: 2, label: "YouTube" },
      { value: 3, label: "Twitter/X" },
      { value: 4, label: "WhatsApp" },
      { value: 5, label: "Facebook" },
    ],
  },
]

// ============================================================
// MOS-SSS (Lampiran 5: Dukungan Sosial)
// 10 item, skala Likert 1-5
// ============================================================
export const MOS_OPTIONS: LikertOption[] = [
  { value: 1, label: "Tidak Pernah", emoji: "😞", color: "from-rose-100 to-rose-50 border-rose-300 data-[selected=true]:border-rose-500 data-[selected=true]:bg-rose-100" },
  { value: 2, label: "Jarang", emoji: "🙁", color: "from-amber-100 to-amber-50 border-amber-300 data-[selected=true]:border-amber-500 data-[selected=true]:bg-amber-100" },
  { value: 3, label: "Kadang", emoji: "😐", color: "from-slate-100 to-slate-50 border-slate-300 data-[selected=true]:border-slate-500 data-[selected=true]:bg-slate-100" },
  { value: 4, label: "Sering", emoji: "🙂", color: "from-sky-100 to-sky-50 border-sky-300 data-[selected=true]:border-sky-500 data-[selected=true]:bg-sky-100" },
  { value: 5, label: "Selalu / Hampir Selalu", emoji: "😁", color: "from-emerald-100 to-emerald-50 border-emerald-300 data-[selected=true]:border-emerald-500 data-[selected=true]:bg-emerald-100" },
]

export const MOS_ITEMS: { id: number; text: string }[] = [
  { id: 1, text: "Ada seseorang yang memberikan perhatian dan mendengarkan keluhanku dengan penuh perhatian." },
  { id: 2, text: "Ada seseorang yang memberikan informasi atau saran yang membantuku menghadapi masalah." },
  { id: 3, text: "Ada seseorang yang membantuku ketika aku sakit dan perlu bantuan." },
  { id: 4, text: "Ada seseorang yang menunjukkan cinta dan perhatian kepadaku." },
  { id: 5, text: "Ada seseorang yang membantuku ketika aku sedang stres atau dalam masalah." },
  { id: 6, text: "Ada seseorang yang bersamaku ketika aku merasa sendirian atau sedih." },
  { id: 7, text: "Ada seseorang yang membantu menyelesaikan urusan sehari-hari jika aku tidak bisa melakukannya." },
  { id: 8, text: "Ada seseorang yang bisa aku ajak bersenang-senang atau melakukan kegiatan yang menyenangkan." },
  { id: 9, text: "Ada seseorang yang memahami masalahku dan menanggapinya dengan serius." },
  { id: 10, text: "Ada seseorang yang mencintai dan menerima aku apa adanya." },
]

// ============================================================
// GBS + School Climate (Lampiran 6: Lingkungan Sekolah)
// Bagian A: 4 item GBS (skala dikotomis/4 pilihan)
// Bagian B: 8 item School Climate (Likert 1-4)
// ============================================================

// GBS items (Bagian A) - skala 0-3 atau 0-2
export const GBS_ITEMS: { id: number; text: string; icon: string }[] = [
  { id: 1, text: "Apakah kamu pernah diintimidasi, digertak, atau diganggu secara fisik (dipukul, didorong, dsb.) oleh teman di sekolah dalam 3 bulan terakhir?", icon: "✊" },
  { id: 2, text: "Apakah kamu pernah diejek, dihina, atau dipanggil dengan nama yang menyakitkan di sekolah dalam 3 bulan terakhir?", icon: "🗯️" },
  { id: 3, text: "Apakah kamu pernah sengaja dikucilkan atau tidak diterima oleh kelompok teman di sekolah?", icon: "🚪" },
  { id: 4, text: "Apakah ada teman yang sengaja menyebarkan rumor atau gosip negatif tentangmu di sekolah?", icon: "💬" },
]

export const GBS_OPTIONS_1_2 = [
  { value: 0, label: "Tidak pernah", emoji: "🟢" },
  { value: 1, label: "1–2 kali", emoji: "🟡" },
  { value: 2, label: "3–5 kali", emoji: "🟠" },
  { value: 3, label: "Lebih dari 5 kali", emoji: "🔴" },
]

export const GBS_OPTIONS_3_4 = [
  { value: 0, label: "Tidak pernah", emoji: "🟢" },
  { value: 1, label: "Kadang-kadang", emoji: "🟡" },
  { value: 2, label: "Sering", emoji: "🟠" },
  { value: 3, label: "Hampir selalu", emoji: "🔴" },
]

// School Climate items (Bagian B) - Likert 1-4
export const CLIMATE_ITEMS: { id: number; text: string; icon: string }[] = [
  { id: 5, text: "Saya merasa aman di sekolah.", icon: "🛡️" },
  { id: 6, text: "Guru-guru di sekolahku peduli terhadap kondisi emosional siswanya.", icon: "❤️" },
  { id: 7, text: "Di sekolah, saya bisa mendapatkan bantuan jika saya mengalami masalah.", icon: "🤝" },
  { id: 8, text: "Saya merasa diterima dan dihargai oleh teman-teman di sekolah.", icon: "🫂" },
  { id: 9, text: "Tekanan belajar dan tugas di sekolah membuat saya sering merasa stres.", icon: "😖" },
  { id: 10, text: "Saya merasa tidak suka atau takut pergi ke sekolah.", icon: "😨" },
  { id: 11, text: "Guru-guruku mendengarkan dan menghormati pendapat murid.", icon: "👂" },
  { id: 12, text: "Saya merasa senang dan nyaman berada di lingkungan sekolah.", icon: "😊" },
]

// Skala resmi pedoman instrumen: 1 = Sangat Setuju ... 4 = Sangat Tidak Setuju.
// (Sebelumnya skala ini terbalik — 1 = Sangat Tidak Setuju ... 4 = Sangat Setuju.
// Diperbaiki agar sesuai pedoman instrumen; lihat scoreClimateSchool() di scoring.ts
// untuk cara skor ini diagregasi, termasuk reverse-scoring item bermuatan negatif.)
export const CLIMATE_OPTIONS: LikertOption[] = [
  { value: 1, label: "Sangat Setuju", emoji: "😁", color: "from-emerald-100 to-emerald-50 border-emerald-300 data-[selected=true]:border-emerald-500 data-[selected=true]:bg-emerald-100" },
  { value: 2, label: "Setuju", emoji: "🙂", color: "from-sky-100 to-sky-50 border-sky-300 data-[selected=true]:border-sky-500 data-[selected=true]:bg-sky-100" },
  { value: 3, label: "Tidak Setuju", emoji: "🙁", color: "from-amber-100 to-amber-50 border-amber-300 data-[selected=true]:border-amber-500 data-[selected=true]:bg-amber-100" },
  { value: 4, label: "Sangat Tidak Setuju", emoji: "😞", color: "from-rose-100 to-rose-50 border-rose-300 data-[selected=true]:border-rose-500 data-[selected=true]:bg-rose-100" },
]

// Item Climate School yang bermuatan negatif (mis. "saya merasa stres", "saya
// takut ke sekolah"). Setuju pada item ini berarti lingkungan KURANG
// supportif, jadi arah skornya dibalik (reverse-scored) saat agregasi total
// supaya konsisten dengan item positif lainnya: semakin tinggi skor total =
// semakin kurang supportif. Lihat scoreClimateSchool() di scoring.ts.
export const CLIMATE_REVERSE_ITEM_IDS: number[] = [9, 10]

// Combined for the BullyingScreen (backward compat)
export const BULLYING_ITEMS = [...GBS_ITEMS, ...CLIMATE_ITEMS]
export const BULLYING_OPTIONS = GBS_OPTIONS_1_2 // used for GBS items 1-2

// ============================================================
// Praktik Ibadah Harian (Lampiran 10: Kuesioner Religiusitas)
// 8 item, skala 1-4 (Tidak Pernah, Jarang, Sering, Selalu)
// Cut-off: Religiusitas Baik ≥20, Kurang <20
// ============================================================
export const RELIGIOSITY_OPTIONS = [
  { value: 1, label: "Tidak Pernah", emoji: "🌙", description: "Tidak pernah melakukan dalam 1 minggu terakhir" },
  { value: 2, label: "Jarang", emoji: "⭐", description: "Melakukan 1–2 kali dalam 1 minggu terakhir" },
  { value: 3, label: "Sering", emoji: "🌟", description: "Melakukan 3–5 kali dalam 1 minggu terakhir" },
  { value: 4, label: "Selalu", emoji: "🕌", description: "Melakukan setiap hari dalam 1 minggu terakhir" },
]

export const RELIGIOSITY_ITEMS: { id: number; text: string; icon: string }[] = [
  { id: 1, text: "Dalam 1 minggu terakhir, saya melaksanakan shalat fardu (wajib) 5 waktu setiap harinya.", icon: "🕌" },
  { id: 2, text: "Dalam 1 minggu terakhir, saya melaksanakan shalat wajib meskipun sedang sibuk atau kurang sehat.", icon: "🤲" },
  { id: 3, text: "Dalam 1 minggu terakhir, saya melaksanakan shalat sunnah dhuha.", icon: "☀️" },
  { id: 4, text: "Dalam 1 minggu terakhir, saya melaksanakan shalat sunnah rawatib (sebelum/sesudah shalat wajib).", icon: "📿" },
  { id: 5, text: "Dalam 1 minggu terakhir, saya membaca Al-Qur'an setiap hari.", icon: "📖" },
  { id: 6, text: "Dalam 1 minggu terakhir, saya meluangkan waktu khusus untuk membaca Al-Qur'an meskipun hanya beberapa ayat.", icon: "✨" },
  { id: 7, text: "Dalam 1 minggu terakhir, saya berdzikir (mengingat Allah) setiap hari, misalnya membaca tasbih, tahmid, atau istighfar.", icon: "🌙" },
  { id: 8, text: "Dalam 1 minggu terakhir, saya berdzikir setelah selesai melaksanakan shalat wajib.", icon: "🌟" },
]

// ============================================================
// Tahapan (stages) untuk progress global
// ============================================================
export type StageId =
  | "consent"
  | "demographics"
  | "cesdr"
  | "psqi"
  | "screentime"
  | "mos"
  | "bullying"
  | "religiosity"

export const STAGES: { id: StageId; title: string; subtitle: string; icon: string; estimatedMinutes: number; color: string }[] = [
  { id: "consent", title: "Persetujuan", subtitle: "Lembar Assen", icon: "📋", estimatedMinutes: 2, color: "violet" },
  { id: "demographics", title: "Data Diri", subtitle: "Demografi & Kesehatan", icon: "👤", estimatedMinutes: 5, color: "sky" },
  { id: "cesdr", title: "Perasaanku", subtitle: "CESD-R (20)", icon: "💭", estimatedMinutes: 5, color: "rose" },
  { id: "psqi", title: "Tidurku", subtitle: "PSQI (7)", icon: "😴", estimatedMinutes: 4, color: "indigo" },
  { id: "screentime", title: "Gadget & Medsos", subtitle: "Screen Time (6)", icon: "📱", estimatedMinutes: 3, color: "emerald" },
  { id: "mos", title: "Dukungan", subtitle: "MOS-SSS (10)", icon: "🤝", estimatedMinutes: 4, color: "amber" },
  { id: "bullying", title: "Sekolahku", subtitle: "GBS + Iklim Sekolah (12)", icon: "🏫", estimatedMinutes: 4, color: "orange" },
  { id: "religiosity", title: "Ibadah", subtitle: "Religiusitas (8)", icon: "🕌", estimatedMinutes: 3, color: "teal" },
]

export const TOTAL_ESTIMATED_MINUTES = STAGES.reduce((a, s) => a + s.estimatedMinutes, 0)

// ============================================================
// Rentang skor total resmi per instrumen — SATU SUMBER KEBENARAN untuk
// nilai maksimum sumbu grafik, threshold highlight, dsb di seluruh
// dashboard admin. Sebelumnya nilai-nilai ini di-hardcode berulang di
// banyak file (admin-dashboard.tsx, compare-dialog.tsx, cohort-panel.tsx,
// cluster/route.ts) dan beberapa di antaranya SALAH (mis. MOS-SSS ditulis
// max 40 padahal 10 item x maks 5 = 50; Bullying ditulis max 24 dari saat
// GBS+Climate masih tercampur jadi satu skor, padahal GBS sendiri cuma
// 0-12; Religiusitas ditulis max 40 padahal 8 item x maks 4 = 32).
// Import dari sini di komponen dashboard/analisis alih-alih menulis angka
// literal baru, supaya tidak terulang lagi.
// ============================================================
export const SCORE_RANGES = {
  cesdr: { min: 0, max: 60, cutoff: 16, cutoffLabel: "Bermakna" },
  psqi: { min: 0, max: 21, cutoff: 5, cutoffLabel: "Buruk (>5)" },
  mos: { min: 10, max: 50, cutoff: 25, cutoffLabel: "Rendah (≤25)" },
  gbs: { min: 0, max: 12, cutoff: 5, cutoffLabel: "Sedang-berat (≥5)" },
  climate: { min: 8, max: 32, cutoff: 16, cutoffLabel: "Kurang supportif (>16)" },
  religiosity: { min: 8, max: 32, cutoff: 20, cutoffLabel: "Kurang (<20)" },
  screentime: { min: 0, max: 17, cutoff: null, cutoffLabel: "Deskriptif, bukan skala baku" },
} as const
