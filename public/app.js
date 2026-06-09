const expressionEl = document.querySelector('#expression');
const statusEl = document.querySelector('#status');
const keys = document.querySelectorAll('.key');
const historyListEl = document.querySelector('#history-list');
const clearHistoryBtn = document.querySelector('#clear-history');

let expression = '';
let busy = false;
let snapLoading;

// --- 2. PERBAIKAN: Inisialisasi & Pengelolaan Riwayat (History) 5 Pencarian Terakhir ---
let searchHistory = [];
try {
  searchHistory = JSON.parse(localStorage.getItem('cuan_crab_history') || '[]');
} catch (e) {
  searchHistory = [];
}

// Render riwayat pertama kali saat aplikasi dimuat
renderHistory();

document.querySelector('.keys').addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || busy) return;

  const value = button.dataset.value;
  const action = button.dataset.action;

  if (value) appendValue(value);
  if (action === 'clear') clearExpression();
  if (action === 'backspace') backspace();
  if (action === 'pay') payForResult();
});

window.addEventListener('keydown', (event) => {
  if (busy) return;

  if (/^\d$/.test(event.key)) appendValue(event.key);
  if (['+', '-', '*', '/', '.', '(', ')'].includes(event.key)) appendValue(toDisplayOperator(event.key));
  if (event.key === 'Backspace') backspace();
  if (event.key === 'Escape') clearExpression();
  if (event.key === 'Enter') payForResult();
});

function appendValue(value) {
  expression = expression === '0' ? value : expression + value;
  setStatus('');
  renderExpression();
}

function clearExpression() {
  expression = '';
  setStatus('');
  renderExpression();
}

function backspace() {
  expression = expression.slice(0, -1);
  setStatus('');
  renderExpression();
}

async function payForResult() {
  if (!expression) {
    setStatus('Masukkan perhitungan.', true);
    return;
  }

  // VALIDASI RUMUS MATEMATIKA
  const lastChar = expression.slice(-1);
  const invalidEndings = ['+', '-', '×', '÷', '.'];
  
  if (invalidEndings.includes(lastChar)) {
    setStatus('Rumus tidak lengkap atau diakhiri operator/titik.', true);
    return;
  }

  const openCount = (expression.match(/\(/g) || []).length;
  const closeCount = (expression.match(/\)/g) || []).length;
  if (openCount !== closeCount) {
    setStatus('Kurung buka dan kurung tutup harus seimbang.', true);
    return;
  }

  setBusy(true);

  // --- 3. PERBAIKAN: Memastikan hasil kalkulator memunculkan hasil ---
  // Jika Midtrans non-aktif di config, hitung secara lokal agar hasil selalu muncul
  if (!window.APP_CONFIG.midtransReady) {
    try {
      setStatus('Menghitung hasil secara lokal...');
      const localResult = safeEvaluate(expression);
      const originalExpression = expression;
      
      expression = localResult;
      renderExpression();
      setStatus('Hasil Terhitung!', false);
      
      // Simpan hasil kalkulasi ke riwayat
      saveToHistory(originalExpression, localResult);
      setBusy(false);
      return;
    } catch (error) {
      setStatus('Kesalahan kalkulasi lokal: ' + error.message, true);
      setBusy(false);
      return;
    }
  }

  // Alur Normal (Menggunakan Midtrans)
  setStatus('Menyiapkan pembayaran...');
  const oldExpression = expression; // Simpan rumus asli sebelum ditimpa hasil

  try {
    await loadSnap();

    const response = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression })
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || 'Pembayaran gagal dibuat.');
    }

    window.snap.pay(payload.token, {
      onSuccess: async () => {
        // Jika server memperbolehkan konfirmasi client (misal untuk testing lokal), kirimkan konfirmasi
        if (window.APP_CONFIG.clientConfirmEnabled) {
          await markClientPaid(payload.orderId);
        }
        
        // --- PERBAIKAN: Langsung kalkulasi secara lokal saat sukses untuk instan respon ---
        try {
          const localResult = safeEvaluate(oldExpression);
          expression = localResult;
          renderExpression();
          setStatus('Pembayaran Sukses! Hasil muncul.', false);
          setBusy(false);
          
          // Efek suara cash register Tuan Krab
          playCashRegisterSound();
          
          // Simpan ke riwayat perhitungan
          saveToHistory(oldExpression, localResult);
        } catch (err) {
          // Fallback ke server jika evaluasi lokal gagal
          await revealResult(payload.orderId, oldExpression);
        }
      },
      onPending: () => {
        setStatus('Pembayaran belum selesai.');
        setBusy(false);
      },
      onError: () => {
        setStatus('Pembayaran gagal.', true);
        setBusy(false);
      },
      onClose: () => {
        setStatus('Pembayaran dibatalkan.');
        setBusy(false);
      }
    });
  } catch (error) {
    setStatus(error.message || 'Terjadi kesalahan.', true);
    setBusy(false);
  }
}

async function revealResult(orderId, oldExpression) {
  setStatus('Memeriksa pembayaran...');

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`/api/result/${encodeURIComponent(orderId)}?expression=${encodeURIComponent(oldExpression)}`);
    const payload = await response.json();

    if (response.ok) {
      expression = payload.result;
      renderExpression();
      setStatus('Pembayaran Sukses! Hasil muncul.', false);
      setBusy(false);
      
      // Efek suara cash register Tuan Krab
      playCashRegisterSound();
      
      // Simpan ke riwayat perhitungan
      saveToHistory(oldExpression, payload.result);
      return;
    }

    await wait(1200);
  }

  // Jika setelah 8 kali polling masih belum dibayar (timeout)
  showRecheckButton(orderId, oldExpression);
  setBusy(false);
}

// Fungsi bantu kalkulasi lokal yang aman dari XSS/eval injection
function safeEvaluate(str) {
  let clean = str.replace(/×/g, '*').replace(/÷/g, '/');
  
  // Deteksi pembagian dengan nol
  if (/\/\s*0/.test(clean)) {
    throw new Error('Tuan Krab tidak suka pembagian gratis! 💸');
  }

  // Pastikan hanya berisi angka dan operator dasar
  if (/^[0-9+\-*/().\s]+$/.test(clean)) {
    const evalResult = Function(`"use strict"; return (${clean})`)();
    if (typeof evalResult === 'number' && !isNaN(evalResult) && isFinite(evalResult)) {
      // Batasi desimal maksimal 8 angka di belakang koma agar tidak kepanjangan
      return Number(evalResult.toFixed(8)).toString();
    }
    throw new Error('Hasil tak berhingga atau NaN');
  }
  throw new Error('Karakter tidak valid');
}

// Fungsi penanganan riwayat
function saveToHistory(expr, result) {
  const item = `${expr} = ${result}`;
  // Bersihkan duplikat item yang sama
  searchHistory = searchHistory.filter(i => i !== item);
  // Masukkan item baru di paling atas
  searchHistory.unshift(item);
  
  // Batasi hanya menyimpan maksimal 5 pencarian terakhir
  if (searchHistory.length > 5) {
    searchHistory = searchHistory.slice(0, 5);
  }
  
  localStorage.setItem('cuan_crab_history', JSON.stringify(searchHistory));
  renderHistory();
}

function renderHistory() {
  if (!historyListEl) return;
  historyListEl.innerHTML = '';

  if (searchHistory.length === 0) {
    historyListEl.innerHTML = '<li class="empty-history">Belum ada riwayat transaksi cuan</li>';
    return;
  }

  searchHistory.forEach(item => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.textContent = item;
    
    // Ketika item riwayat diklik, muat angkanya kembali ke display kalkulator
    li.addEventListener('click', () => {
      const parts = item.split(' = ');
      if (parts.length > 1) {
        expression = parts[1]; // Muat hasil kalkulasinya ke input
        renderExpression();
        setStatus('Dimuat dari riwayat');
      }
    });

    historyListEl.appendChild(li);
  });
}

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener('click', () => {
    searchHistory = [];
    localStorage.removeItem('cuan_crab_history');
    renderHistory();
    setStatus('Riwayat dibersihkan.');
  });
}

async function loadSnap() {
  if (!window.APP_CONFIG.midtransReady) {
    throw new Error('Midtrans belum dikonfigurasi.');
  }

  if (window.snap) return;
  if (!snapLoading) {
    snapLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = window.APP_CONFIG.snapUrl;
      script.dataset.clientKey = window.APP_CONFIG.midtransClientKey;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Snap Midtrans gagal dimuat.'));
      document.head.append(script);
    });
  }

  await snapLoading;
}

function setBusy(value) {
  busy = value;
  keys.forEach((key) => {
    key.disabled = value;
  });
}

function setStatus(message, error = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', error);
}

function renderExpression() {
  expressionEl.textContent = expression || '0';
}

function toDisplayOperator(key) {
  if (key === '*') return '×';
  if (key === '/') return '÷';
  return key;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fungsi konfirmasi client (diaktifkan saat testing lokal jika diizinkan server)
async function markClientPaid(orderId) {
  try {
    await fetch('/api/confirm-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });
  } catch (e) {
    console.error('Gagal mengirim konfirmasi client:', e);
  }
}

// Menampilkan tombol "Cek Status" secara dinamis di elemen status
function showRecheckButton(orderId, oldExpression) {
  statusEl.innerHTML = 'Pembayaran sedang diproses. ';
  
  const btn = document.createElement('button');
  btn.className = 'recheck-btn';
  btn.textContent = 'Cek Status';
  btn.style.marginLeft = '8px';
  btn.style.padding = '2px 8px';
  btn.style.background = 'var(--accent)';
  btn.style.color = '#fff';
  btn.style.border = 'none';
  btn.style.borderRadius = '4px';
  btn.style.cursor = 'pointer';
  btn.style.fontSize = '11px';
  btn.style.fontWeight = '600';
  
  btn.addEventListener('click', async () => {
    setBusy(true);
    await revealResult(orderId, oldExpression);
  });
  
  statusEl.appendChild(btn);
}

// Menghasilkan efek suara chime koin (cash register) dinamis lewat Web Audio API
function playCashRegisterSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Bunyi Koin 1 (Chime tinggi)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(950, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(1350, ctx.currentTime + 0.08);
    
    gain1.gain.setValueAtTime(0.25, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.35);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.35);
    
    // Bunyi Koin 2 (Chime harmoni berselang sedikit)
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1150, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(1650, ctx.currentTime + 0.12);
      
      gain2.gain.setValueAtTime(0.18, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.45);
      
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start();
      osc2.stop(ctx.currentTime + 0.45);
    }, 80);
  } catch (e) {
    console.error('Web Audio API not supported or blocked:', e);
  }
}

// --- JAVASCRIPT GESTURE LOCK: Mengunci zoom in & zoom out total pada handphone ---
// 1. Cegah pinch-to-zoom (cubit dengan dua jari atau lebih)
document.addEventListener('touchstart', (event) => {
  if (event.touches.length > 1) {
    event.preventDefault();
  }
}, { passive: false });

// 2. Cegah double-tap to zoom (ketuk layar dua kali berturut-turut cepat)
let lastTouchEnd = 0;
document.addEventListener('touchend', (event) => {
  const now = (new Date()).getTime();
  if (now - lastTouchEnd <= 300) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });

// 3. Cegah gesture zoom di browser iOS Safari
document.addEventListener('gesturestart', (event) => {
  event.preventDefault();
});