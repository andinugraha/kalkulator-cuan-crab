import { evaluateExpression } from './calculator.js';

const expressionEl = document.querySelector('#expression');
const statusEl = document.querySelector('#status');
const keys = document.querySelectorAll('.key');
const historyListEl = document.querySelector('#history-list');
const clearHistoryBtn = document.querySelector('#clear-history');
const historyToggleBtn = document.querySelector('#history-toggle-btn');
const historyPopover = document.querySelector('#history-popover');
const degBtn = document.querySelector('.deg-btn');
const radBtn = document.querySelector('.rad-btn');

let expression = '';
let busy = false;
let snapLoading;
let lastAnswer = '';
let angleMode = 'deg'; // default mode derajat

// --- Inisialisasi & Pengelolaan Riwayat (History) ---
let searchHistory = [];
try {
  searchHistory = JSON.parse(localStorage.getItem('scientific_calc_history') || '[]');
} catch (e) {
  searchHistory = [];
}

renderHistory();

// Event Listener Klik Tombol
document.querySelector('.keys').addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || busy) return;

  const value = button.dataset.value;
  const action = button.dataset.action;

  if (value) appendValue(value);
  if (action === 'clear') clearExpression();
  if (action === 'set-deg') setAngleMode('deg');
  if (action === 'set-rad') setAngleMode('rad');
  if (action === 'ans') appendValue(lastAnswer || '0');
  if (action === 'exp') appendValue('E');
  if (action === 'pay') payForResult();
  if (action === 'toggle-inv') toggleInv(button);
});

// Event Listener Keyboard Fisik
window.addEventListener('keydown', (event) => {
  if (busy) return;

  if (/^\d$/.test(event.key)) appendValue(event.key);
  if (['+', '-', '*', '/', '.', '(', ')', '%', '!'].includes(event.key)) {
    appendValue(toDisplayOperator(event.key));
  }
  if (event.key === '^') appendValue('^');
  if (event.key === 'Backspace') backspace();
  if (event.key === 'Escape') clearExpression();
  if (event.key === 'Enter') payForResult();
});

// Event Listener Riwayat Popover
if (historyToggleBtn && historyPopover) {
  historyToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    historyPopover.classList.toggle('hidden');
  });

  // Tutup popover saat klik di luar popover
  document.addEventListener('click', (e) => {
    if (!historyPopover.contains(e.target) && e.target !== historyToggleBtn) {
      historyPopover.classList.add('hidden');
    }
  });
}

function appendValue(value) {
  if (expression === '0' && value !== '.' && !isOperatorChar(value)) {
    expression = value;
  } else {
    expression += value;
  }
  setStatus('');
  renderExpression();
}

function isOperatorChar(char) {
  return ['+', '-', '×', '÷', '^', '%', '!'].includes(char);
}

function clearExpression() {
  expression = '';
  setStatus('');
  renderExpression();
}

function backspace() {
  // Hapus nama fungsi ilmiah secara utuh jika berada di akhir rumus
  const scientificFuncs = ['sin(', 'cos(', 'tan(', 'log(', 'ln(', 'sqrt('];
  let deleted = false;
  for (const func of scientificFuncs) {
    if (expression.endsWith(func)) {
      expression = expression.slice(0, -func.length);
      deleted = true;
      break;
    }
  }
  if (!deleted) {
    expression = expression.slice(0, -1);
  }
  setStatus('');
  renderExpression();
}

function setAngleMode(mode) {
  angleMode = mode;
  if (mode === 'deg') {
    degBtn.classList.add('active');
    radBtn.classList.remove('active');
  } else {
    radBtn.classList.add('active');
    degBtn.classList.remove('active');
  }
  setStatus(`Sudut: ${mode.toUpperCase()}`);
}

function toggleInv(btn) {
  btn.classList.toggle('active');
  setStatus('Inverse mode toggled');
}

async function payForResult() {
  if (!expression) {
    setStatus('Masukkan perhitungan.', true);
    return;
  }

  // Validasi kurung seimbang
  const openCount = (expression.match(/\(/g) || []).length;
  const closeCount = (expression.match(/\)/g) || []).length;
  if (openCount !== closeCount) {
    setStatus('Kurung buka dan tutup tidak seimbang.', true);
    return;
  }

  setBusy(true);

  // Jika Midtrans non-aktif di config, hitung secara lokal (Offline/Offline Dev mode)
  if (!window.APP_CONFIG.midtransReady) {
    try {
      setStatus('Menghitung...');
      const localResult = evaluateExpression(expression, angleMode);
      lastAnswer = localResult;
      
      const originalExpression = expression;
      expression = localResult;
      renderExpression();
      setStatus('');
      
      saveToHistory(originalExpression, localResult);
      setBusy(false);
      return;
    } catch (error) {
      setStatus(error.message, true);
      setBusy(false);
      return;
    }
  }

  // Alur Normal (Menggunakan Midtrans)
  setStatus('Menyiapkan pembayaran...');
  const oldExpression = expression;

  try {
    await loadSnap();

    const response = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression, mode: angleMode })
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || 'Pembayaran gagal dibuat.');
    }

    window.snap.pay(payload.token, {
      onSuccess: async () => {
        if (window.APP_CONFIG.clientConfirmEnabled) {
          await markClientPaid(payload.orderId);
        }
        
        try {
          const localResult = evaluateExpression(oldExpression, angleMode);
          lastAnswer = localResult;
          expression = localResult;
          renderExpression();
          setStatus('');
          playCashRegisterSound();
          saveToHistory(oldExpression, localResult);
          setBusy(false);
        } catch (err) {
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
  if (window.APP_CONFIG.clientConfirmEnabled) {
    showSimulateButton(orderId);
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`/api/result/${encodeURIComponent(orderId)}?expression=${encodeURIComponent(oldExpression)}&mode=${angleMode}`);
    const payload = await response.json();

    if (response.ok) {
      expression = payload.result;
      lastAnswer = payload.result;
      renderExpression();
      setStatus('');
      playCashRegisterSound();
      saveToHistory(oldExpression, payload.result);
      setBusy(false);
      return;
    }

    await wait(1200);
  }

  showRecheckButton(orderId, oldExpression);
  setBusy(false);
}

function saveToHistory(expr, result) {
  const item = `${expr} = ${result}`;
  searchHistory = searchHistory.filter(i => i !== item);
  searchHistory.unshift(item);
  
  if (searchHistory.length > 10) {
    searchHistory = searchHistory.slice(0, 10);
  }
  
  localStorage.setItem('scientific_calc_history', JSON.stringify(searchHistory));
  renderHistory();
}

function renderHistory() {
  if (!historyListEl) return;
  historyListEl.innerHTML = '';

  if (searchHistory.length === 0) {
    historyListEl.innerHTML = '<li class="empty-history">Belum ada riwayat perhitungan</li>';
    return;
  }

  searchHistory.forEach(item => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.textContent = item;
    
    li.addEventListener('click', () => {
      const parts = item.split(' = ');
      if (parts.length > 1) {
        expression = parts[0];
        renderExpression();
        setStatus(parts[1]);
        if (historyPopover) historyPopover.classList.add('hidden');
      }
    });

    historyListEl.appendChild(li);
  });
}

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    searchHistory = [];
    localStorage.removeItem('scientific_calc_history');
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
  if (key === '-') return '−';
  return key;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function showRecheckButton(orderId, oldExpression) {
  statusEl.innerHTML = 'Pembayaran diproses. ';
  
  const btn = document.createElement('button');
  btn.className = 'recheck-btn';
  btn.textContent = 'Cek Status';
  btn.style.marginLeft = '8px';
  btn.style.padding = '2px 8px';
  btn.style.background = 'var(--bg-btn-equals)';
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

function showSimulateButton(orderId) {
  const btn = document.createElement('button');
  btn.className = 'simulate-btn';
  btn.textContent = 'Simulasi Sukses (Test)';
  btn.style.marginLeft = '8px';
  btn.style.padding = '2px 8px';
  btn.style.background = '#059669'; // Emerald green
  btn.style.color = '#fff';
  btn.style.border = 'none';
  btn.style.borderRadius = '4px';
  btn.style.cursor = 'pointer';
  btn.style.fontSize = '11px';
  btn.style.fontWeight = '600';
  
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    btn.disabled = true;
    btn.textContent = 'Memproses...';
    await markClientPaid(orderId);
  });
  
  statusEl.appendChild(btn);
}

function playCashRegisterSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
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

// Pencegahan Zoom pada Mobile
document.addEventListener('touchstart', (event) => {
  if (event.touches.length > 1) {
    event.preventDefault();
  }
}, { passive: false });

let lastTouchEnd = 0;
document.addEventListener('touchend', (event) => {
  const now = (new Date()).getTime();
  if (now - lastTouchEnd <= 300) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });

document.addEventListener('gesturestart', (event) => {
  event.preventDefault();
});