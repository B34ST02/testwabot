# 🤖 WhatsApp AI Bot - Termux Edition

Bot WhatsApp dengan AI (Gemini / GPT) yang bisa jalan di Termux. Satu file, simpel, langsung pakai.

## 🛠️ Fitur

- 🤖 **Gemini 2.0 Flash** atau **OpenAI GPT**
- 💬 Chat history (inget konteks)
- 👥 Bisa di private chat & group
- 🧹 Clear history per chat
- 📱 QR Code di terminal
- 🔄 Auto-reconnect
- ⚡ Auto-reply di private, prefix-only di group

## 📦 Install di Termux

```bash
# 1. Update Termux
pkg update -y && pkg upgrade -y

# 2. Install Node.js
pkg install nodejs -y

# 3. Clone bot-nya
git clone https://github.com/user/wabot-termux.git
cd wabot-termux

# 4. Install dependencies
npm install

# 5. Setup .env
cp .env.example .env
nano .env
```

**Isi `.env` (pilih salah satu):**

```env
# Untuk Gemini (GRATIS - rekomendasi)
AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...  ← dapatkan dari https://aistudio.google.com

# Atau untuk OpenAI
# AI_PROVIDER=openai
# OPENAI_API_KEY=sk-...
```

## 🚀 Jalanin

```bash
npm start
# Scan QR Code yang muncul di terminal
# Bot siap! Kirim !menu buat liat perintah
```

## 📝 Perintah (Prefix `!`)

| Perintah | Fungsi |
|---|---|
| `!menu` | Tampilkan menu |
| `!ask <teks>` | Tanya AI |
| `!chat <teks>` | Ngobrol dengan history |
| `!clear` | Hapus history |
| `!info` | Info bot |

**Di private chat:** cukup kirim pesan biasa, gak perlu prefix.

## 🔑 Dapetin Gemini API Key (GRATIS)

1. Buka [aistudio.google.com](https://aistudio.google.com/app/apikey)
2. Login Google
3. Klik "Create API Key"
4. Copy key-nya ke `.env`

**Gratis 1.500 request/hari.** Cukup buat bot personal.

## 📂 Struktur

```
wabot-termux/
├── index.js          ← Bot utama
├── package.json
├── .env.example
├── .gitignore
├── README.md
└── auth_info/        ← Session WhatsApp (auto-generated)
```
