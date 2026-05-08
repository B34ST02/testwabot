require('dotenv').config();
const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  makeInMemoryStore,
} = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// ──────────────── CONFIG ────────────────
const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const BOT_PREFIX = process.env.BOT_PREFIX || '!';
const BOT_NAME = process.env.BOT_NAME || 'Bot AI';
const AI_MODEL = process.env.AI_MODEL || (AI_PROVIDER === 'gemini' ? 'gemini-2.0-flash' : 'gpt-3.5-turbo');
const MAX_HISTORY = parseInt(process.env.MAX_HISTORY || '20');

// ──────────────── AI CLIENTS ────────────────
let genAI, geminiModel, openai;

// Gemini
if (AI_PROVIDER === 'gemini' && GEMINI_KEY && GEMINI_KEY !== 'your_gemini_api_key_here') {
  genAI = new GoogleGenerativeAI(GEMINI_KEY);
  geminiModel = genAI.getGenerativeModel({ model: AI_MODEL });
}

// OpenAI
if (AI_PROVIDER === 'openai' && OPENAI_KEY && OPENAI_KEY !== 'your_openai_api_key_here') {
  openai = new OpenAI({ apiKey: OPENAI_KEY });
}

// ──────────────── CHAT HISTORY ────────────────
// Format: { [jid]: [{ role, content }] }
const chatHistory = {};
function addHistory(jid, role, content) {
  if (!chatHistory[jid]) chatHistory[jid] = [];
  chatHistory[jid].push({ role, content });
  // Keep only recent messages
  if (chatHistory[jid].length > MAX_HISTORY) {
    chatHistory[jid] = chatHistory[jid].slice(-MAX_HISTORY);
  }
}
function getHistory(jid) {
  return chatHistory[jid] || [];
}
function clearHistory(jid) {
  delete chatHistory[jid];
}

// ──────────────── AI RESPONSE ────────────────
async function askAI(question, jid) {
  if (AI_PROVIDER === 'gemini' && geminiModel) {
    return await askGemini(question, jid);
  }
  if (AI_PROVIDER === 'openai' && openai) {
    return await askOpenAI(question, jid);
  }
  return '❌ API key belum diisi. Buka file .env dan isi GEMINI_API_KEY atau OPENAI_API_KEY.';
}

async function askGemini(question, jid) {
  try {
    const history = getHistory(jid);
    // Build chat history
    const historyMessages = history.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const chat = geminiModel.startChat({ history: historyMessages });
    const result = await chat.sendMessage(question);
    const response = result.response.text();
    addHistory(jid, 'user', question);
    addHistory(jid, 'assistant', response);
    return response;
  } catch (e) {
    console.error('Gemini Error:', e.message);
    return `❌ Gemini Error: ${e.message}`;
  }
}

async function askOpenAI(question, jid) {
  try {
    const history = getHistory(jid);
    const messages = [
      { role: 'system', content: `Kamu adalah ${BOT_NAME}, asisten WhatsApp yang ramah, lucu, dan helpful. Jawab dengan bahasa Indonesia yang santai.` },
      ...history,
      { role: 'user', content: question },
    ];
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });
    const response = completion.choices[0].message.content;
    addHistory(jid, 'user', question);
    addHistory(jid, 'assistant', response);
    return response;
  } catch (e) {
    console.error('OpenAI Error:', e.message);
    return `❌ OpenAI Error: ${e.message}`;
  }
}

// ──────────────── COMMAND HANDLER ────────────────
async function handleCommand(sock, msg) {
  const jid = msg.key.remoteJid;
  if (!jid) return;

  const messageContent = msg.message?.conversation
    || msg.message?.extendedTextMessage?.text
    || '';
  if (!messageContent) return;

  const text = messageContent.trim();
  const isGroup = jid.endsWith('@g.us');
  const isPrivate = !isGroup;

  // ── PREFIX COMMANDS ──
  // !menu
  if (text === `${BOT_PREFIX}menu`) {
    const menu = `🤖 *${BOT_NAME} - Menu*\n\n`
      + `📝 *${BOT_PREFIX}ask* <pertanyaan> - Tanya AI\n`
      + `💬 *${BOT_PREFIX}chat* <pesan> - Ngobrol (dengan history)\n`
      + `🧹 *${BOT_PREFIX}clear* - Hapus history chat\n`
      + `🖼️ *${BOT_PREFIX}img* <deskripsi> - Generate gambar (GPT only)\n`
      + `ℹ️ *${BOT_PREFIX}info* - Info bot\n`
      + `\n📌 Kirim pesan tanpa prefix juga bakal dijawab!`;
    await sock.sendMessage(jid, { text: menu });
    return;
  }

  // !info
  if (text === `${BOT_PREFIX}info`) {
    const info = `🤖 *${BOT_NAME}*\n\n`
      + `🔄 Provider: ${AI_PROVIDER.toUpperCase()}\n`
      + `🧠 Model: ${AI_MODEL}\n`
      + `📝 Prefix: ${BOT_PREFIX}\n`
      + `📊 Chat history: ${MAX_HISTORY} percakapan`;
    await sock.sendMessage(jid, { text: info });
    return;
  }

  // !clear
  if (text === `${BOT_PREFIX}clear`) {
    clearHistory(jid);
    await sock.sendMessage(jid, { text: '✅ History chat dihapus.' });
    return;
  }

  // ── AI REPLY ──
  let question = '';

  // Prefix commands
  if (text.startsWith(`${BOT_PREFIX}ask `)) {
    question = text.replace(`${BOT_PREFIX}ask `, '').trim();
  } else if (text.startsWith(`${BOT_PREFIX}chat `)) {
    question = text.replace(`${BOT_PREFIX}chat `, '').trim();
  } else if (text.startsWith(`${BOT_PREFIX}img `)) {
    // Placeholder for image gen
    return await sock.sendMessage(jid, { text: '🖼️ Fitur generate gambar belum tersedia di Termux. Coming soon!' });
  } else {
    // Auto-reply: every message is a question (only in private chat or if mentioned in group)
    if (isPrivate) {
      question = text;
    } else if (isGroup) {
      // In group: only reply if mentioned or prefix
      if (!text.startsWith(BOT_PREFIX)) return; // ignore non-prefixed group messages
      question = text.replace(BOT_PREFIX, '').trim();
    }
  }

  if (!question) return;

  // Typing indicator
  await sock.sendPresenceUpdate('composing', jid);

  const answer = await askAI(question, jid);

  await sock.sendMessage(jid, { text: answer });
}

// ──────────────── MAIN ────────────────
async function startBot() {
  console.log(`\n🤖 Starting ${BOT_NAME}...\n`);
  console.log(`🔧 Provider: ${AI_PROVIDER.toUpperCase()}`);
  console.log(`🧠 Model: ${AI_MODEL}`);
  console.log(`📝 Prefix: ${BOT_PREFIX}\n`);

  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: Browsers.ubuntu('Chrome'),
    logger: pino({ level: 'silent' }),
  });

  // QR Code muncul di terminal
  console.log('\n📱 Scan QR Code di atas dengan WhatsApp kamu!\n');

  // Simpan creds secara otomatis
  sock.ev.on('creds.update', saveCreds);

  // Handle koneksi
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('⚠️ Koneksi terputus. Reconnect:', shouldReconnect);
      if (shouldReconnect) startBot();
      else {
        console.log('❌ Logged out. Hapus folder auth_info lalu mulai ulang.');
        process.exit(0);
      }
    } else if (connection === 'open') {
      console.log(`\n✅ ${BOT_NAME} terhubung & siap!\n`);
    }
  });

  // Tangani pesan masuk
  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;
    for (const msg of m.messages) {
      if (msg.key.fromMe) continue; // skip pesan sendiri
      await handleCommand(sock, msg);
    }
  });

  return sock;
}

// ──────────────── START ────────────────
console.clear();
console.log('╔══════════════════════════╗');
console.log('║   🤖 WhatsApp AI Bot    ║');
console.log('║   Gemini • GPT • Baileys║');
console.log('╚══════════════════════════╝\n');

startBot().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
