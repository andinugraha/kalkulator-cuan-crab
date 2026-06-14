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
let spoilerTimer;

// Atur Canonical URL secara dinamis berdasarkan origin aktif untuk mengoptimalkan SEO
const canonicalEl = document.querySelector('link[rel="canonical"]');
if (canonicalEl) {
  canonicalEl.setAttribute('href', window.location.origin + window.location.pathname);
}

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
  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault();
    backspace();
  }
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

async function fetchSpoiler() {
  if (busy || !expression) {
    if (!busy) setStatus('');
    return;
  }
  try {
    const response = await fetch('/api/spoiler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression, mode: angleMode })
    });
    if (busy) return; // Mencegah overwrite jika status berubah saat fetch
    const payload = await response.json();
    if (payload.spoiler) {
      setStatus(`Tagihan Rp ${payload.price.toLocaleString('id-ID')} | Spoiler: ${payload.spoiler}`);
    } else {
      setStatus('');
    }
  } catch (err) {
    if (!busy) setStatus('');
  }
}

function triggerSpoiler() {
  if (busy) return;
  clearTimeout(spoilerTimer);
  setStatus('Menganalisa...');
  spoilerTimer = setTimeout(fetchSpoiler, 400);
}

function appendValue(value) {
  if (expression === '0' && value !== '.' && !isOperatorChar(value)) {
    expression = value;
  } else {
    expression += value;
  }
  setStatus('');
  renderExpression();
  triggerSpoiler();
}

function isOperatorChar(char) {
  return ['+', '-', '×', '÷', '^', '%', '!'].includes(char);
}

function clearExpression() {
  expression = '';
  setStatus('');
  renderExpression();
  clearTimeout(spoilerTimer);
}

function backspace() {
  // Hapus nama fungsi ilmiah secara utuh jika berada di akhir rumus
  const scientificFuncs = ['asin(', 'acos(', 'atan(', 'sin(', 'cos(', 'tan(', 'log(', 'ln(', '√('];
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
  triggerSpoiler();
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
  const isInv = btn.classList.contains('active');
  const mapping = {
    'sin(': isInv ? 'asin(' : 'sin(',
    'cos(': isInv ? 'acos(' : 'cos(',
    'tan(': isInv ? 'atan(' : 'tan('
  };
  const textMapping = {
    'sin(': isInv ? 'sin⁻¹' : 'sin',
    'cos(': isInv ? 'cos⁻¹' : 'cos',
    'tan(': isInv ? 'tan⁻¹' : 'tan'
  };

  document.querySelectorAll('.key.scientific').forEach(key => {
    const baseVal = key.dataset.baseValue || key.dataset.value;
    if (mapping[baseVal]) {
      if (!key.dataset.baseValue) key.dataset.baseValue = baseVal;
      key.dataset.value = mapping[baseVal];
      key.textContent = textMapping[baseVal];
    }
  });

  setStatus('Inverse mode ' + (isInv ? 'on' : 'off'));
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
  setStatus('Menyiapkan perhitungan...');
  const oldExpression = expression;

  // Jika Midtrans non-aktif di config, hitung secara lokal (Offline/Offline Dev mode)
  if (!window.APP_CONFIG.midtransReady) {
    try {
      const response = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression: oldExpression, mode: angleMode })
      });
      const payload = await response.json();
      
      if (!response.ok) {
        throw new Error(payload.error || 'Perhitungan gagal.');
      }
      
      lastAnswer = payload.result;
      expression = payload.result;
      renderExpression();
      setStatus('');
      saveToHistory(oldExpression, payload.result);
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

  try {
    await loadSnap();

    const response = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression: oldExpression, mode: angleMode })
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || 'Pembayaran gagal dibuat.');
    }

    setStatus('Menunggu pembayaran...');

    window.snap.pay(payload.token, {
      onSuccess: async () => {
        if (window.APP_CONFIG.clientConfirmEnabled) {
          await markClientPaid(payload.orderId);
        }
        await revealResult(payload.orderId, oldExpression);
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

      // Fitur Viral: Gacha Tema Emas
      if (payload.isJackpot) {
        localStorage.setItem('unlocked_gold', '1');
        document.body.classList.add('gold-theme');
        alert("✨ JACKPOT! Anda membuka TEMA EMAS SULTAN! ✨");
      }

      // Tampilkan modal sertifikat tanpa prompt tambahan setelah pembayaran.
      const modal = document.getElementById('result-modal');
      const roastEl = document.getElementById('modal-roast');
      roastEl.textContent = payload.roast || '';
      modal.classList.remove('hidden');

      drawCertificate('Pengguna Kalkulator', oldExpression, payload.result, payload.price);

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

function clearStatusActions() {
  statusEl.querySelectorAll('.recheck-btn, .simulate-btn').forEach((btn) => btn.remove());
}

function showRecheckButton(orderId, oldExpression) {
  clearStatusActions();
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
  clearStatusActions();
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

// Modal Close & Download
document.getElementById('close-modal-btn')?.addEventListener('click', () => {
  document.getElementById('result-modal').classList.add('hidden');
});

document.getElementById('download-cert-btn')?.addEventListener('click', () => {
  const canvas = document.getElementById('certificate-canvas');
  const link = document.createElement('a');
  link.download = 'Sertifikat_Apresiasi_Kalkulator.png';
  link.href = canvas.toDataURL();
  link.click();
});

document.getElementById('share-ig-btn')?.addEventListener('click', async () => {
  const canvas = document.getElementById('certificate-canvas');
  if (!canvas) return;

  try {
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'sertifikat_apresiasi_kalkulator.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Sertifikat Apresiasi Kalkulator',
          text: 'Saya baru saja membuka hasil kalkulator premium.'
        });
      } else {
        alert("Browser Anda tidak mendukung share langsung. Silakan unduh sertifikat ini terlebih dahulu, lalu unggah manual ke Instagram Story Anda!");
      }
    }, 'image/png');
  } catch (err) {
    console.error("Share gagal", err);
    alert("Gagal membagikan. Silakan unduh secara manual.");
  }
});

// Gambar sertifikat portrait bergaya geometris biru-putih.
function drawCertificate(name, expression, result, price) {
  const canvas = document.getElementById('certificate-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  canvas.width = 1080;
  canvas.height = 1920;

  const blue = '#0b55c5';
  const cyan = '#16a7e8';
  const navy = '#12356f';
  const gold = '#f7bf1e';
  const ink = '#1f2937';
  const muted = '#5b6472';

  ctx.fillStyle = '#fbfdff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, 'rgba(22, 167, 232, 0.10)');
  gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(1, 'rgba(11, 85, 197, 0.12)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGeometricCertificateDecor(ctx, canvas.width, canvas.height, blue, cyan, gold);

  ctx.strokeStyle = 'rgba(11, 85, 197, 0.18)';
  ctx.lineWidth = 6;
  ctx.strokeRect(64, 64, 952, 1792);

  ctx.strokeStyle = gold;
  ctx.lineWidth = 4;
  ctx.strokeRect(88, 88, 904, 1744);

  ctx.fillStyle = navy;
  ctx.textAlign = 'center';
  ctx.font = '700 92px Arial, sans-serif';
  ctx.fillText('SERTIFIKAT', 540, 318);

  ctx.font = '500 34px Arial, sans-serif';
  ctx.fillText('A P R E S I A S I', 540, 376);

  ctx.strokeStyle = cyan;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(258, 420);
  ctx.lineTo(822, 420);
  ctx.stroke();

  ctx.fillStyle = muted;
  ctx.font = '400 31px Arial, sans-serif';
  ctx.fillText('Dengan bangga dipersembahkan kepada:', 540, 560);

  // Implementasi Nama & Peran Acak Meme yang Lucu, Menarik, dan Konsisten Berdasarkan Rumus (Maksimal 2 Kata)
  const randomNames = [
    "Sultan Depok", "Sultan Gabut", "Albert Einstein", "Kalkulator Lover", 
    "Warga Kreatif", "Sultan Kemayoran", "Pecinta Angka", 
    "Matematikawan Gaib", "Pemuja AC", "Hamba Allah", "Sultan Citayam",
    "Pakar Aljabar", "Dewa Hitung", "Jagoan Neon"
  ];
  const randomRoles = [
    "HASIL PREMIUM", "SULTAN GABUT", "DONATUR MEME", 
    "PAHLAWAN RUMUS", "PENYELAMAT MATEMATIKA", "DUTA GEOMETRIS",
    "SULTAN ANGKA", "SPONSOR RESMI", "GABUT SEJATI"
  ];

  let nameHash = 0;
  const cleanExpr = String(expression || '').replace(/\s/g, '');
  for (let i = 0; i < cleanExpr.length; i++) {
    nameHash += cleanExpr.charCodeAt(i);
  }
  
  const finalName = name === 'Pengguna Kalkulator' ? randomNames[nameHash % randomNames.length] : name;
  const finalRole = randomRoles[nameHash % randomRoles.length];

  ctx.fillStyle = cyan;
  fitCenteredText(ctx, finalName.toUpperCase(), 540, 710, 780, 92, 48, 'Arial, sans-serif', 800);

  ctx.fillStyle = ink;
  ctx.font = '400 32px Arial, sans-serif';
  ctx.fillText('sebagai', 540, 795);

  drawBadge(ctx, 540, 875, finalRole);

  ctx.fillStyle = ink;
  ctx.font = '400 31px Arial, sans-serif';
  wrapCanvasText(
    ctx,
    `Telah menyelesaikan perhitungan "${expression}" dan berhasil membuka hasil premium dengan kontribusi sebesar Rp ${Number(price || 0).toLocaleString('id-ID')}.`,
    540,
    1015,
    760,
    46
  );

  ctx.fillStyle = muted;
  ctx.font = '400 28px Arial, sans-serif';
  ctx.fillText('Hasil perhitungan', 540, 1240);

  ctx.fillStyle = blue;
  fitCenteredText(ctx, String(result), 540, 1362, 760, 160, 60, 'Courier New, monospace', 800);

  drawMedal(ctx, 280, 1630, gold, navy);
  drawSignatureLine(ctx, 800, 1698, 'Owner Website');
  drawSignatureImage(ctx, 800, 1635);

  ctx.fillStyle = '#8b95a3';
  ctx.font = '600 26px Arial, sans-serif';
  ctx.fillText('cuancrab.online', 540, 1812);
}

function drawGeometricCertificateDecor(ctx, width, height, blue, cyan, gold) {
  ctx.save();
  ctx.fillStyle = cyan;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(200, 0);
  ctx.lineTo(0, 210);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = blue;
  ctx.beginPath();
  ctx.moveTo(width, 0);
  ctx.lineTo(width - 170, 0);
  ctx.lineTo(width, 170);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = gold;
  ctx.fillRect(142, 82, 190, 28);
  ctx.fillRect(width - 336, height - 116, 196, 28);

  ctx.fillStyle = cyan;
  ctx.beginPath();
  ctx.arc(0, height, 178, Math.PI * 1.5, Math.PI * 2);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = blue;
  ctx.beginPath();
  ctx.arc(width, height, 220, Math.PI, Math.PI * 1.5);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = blue;
  ctx.lineWidth = 6;
  for (let i = 0; i < 7; i += 1) {
    ctx.beginPath();
    ctx.arc(width - 118 - (i * 22), 92, 22 + (i * 2), 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = gold;
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 12; col += 1) {
      ctx.beginPath();
      ctx.arc(176 + col * 24, 220 + row * 22, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = gold;
  ctx.lineWidth = 7;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(width - 240 + i * 30, height - 250);
    ctx.lineTo(width - 196 + i * 30, height - 294);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBadge(ctx, x, y, text) {
  ctx.save();
  ctx.strokeStyle = '#f7bf1e';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x - 228, y - 42);
  ctx.lineTo(x + 198, y - 42);
  ctx.lineTo(x + 228, y);
  ctx.lineTo(x + 198, y + 42);
  ctx.lineTo(x - 228, y + 42);
  ctx.lineTo(x - 198, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#12356f';
  ctx.font = '700 34px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y + 12);
  ctx.restore();
}

function drawMedal(ctx, x, y, gold, navy) {
  ctx.save();
  ctx.strokeStyle = 'rgba(18, 53, 111, 0.42)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 142, y - 10);
  ctx.lineTo(x - 268, y - 10);
  ctx.moveTo(x + 142, y - 10);
  ctx.lineTo(x + 268, y - 10);
  ctx.stroke();

  const medalGradient = ctx.createRadialGradient(x - 36, y - 44, 10, x, y, 82);
  medalGradient.addColorStop(0, '#fff7b8');
  medalGradient.addColorStop(0.48, gold);
  medalGradient.addColorStop(1, '#c88900');
  ctx.fillStyle = medalGradient;
  ctx.beginPath();
  ctx.arc(x, y, 72, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d29b08';
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.fillStyle = navy;
  ctx.font = '700 42px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OK', x, y + 15);
  ctx.restore();
}

function drawSignatureImage(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = '#0f172a'; // Slate 900, elegant ink color
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  
  // Tall 'A'
  // Start with the loop on the left:
  ctx.moveTo(x - 110, y + 25);
  ctx.bezierCurveTo(x - 150, y - 10, x - 120, y - 50, x - 100, y - 30);
  ctx.bezierCurveTo(x - 80, y - 10, x - 100, y + 30, x - 80, y - 120);
  // Main high peak of A:
  ctx.quadraticCurveTo(x - 70, y - 160, x - 65, y - 150);
  ctx.lineTo(x - 50, y + 45); // Down stroke of A
  
  // Up stroke of A/connect to m
  ctx.moveTo(x - 55, y - 10);
  ctx.quadraticCurveTo(x - 45, y - 50, x - 35, y - 15);
  
  // m (loops)
  ctx.quadraticCurveTo(x - 30, y - 45, x - 22, y - 15);
  ctx.quadraticCurveTo(x - 17, y - 45, x - 10, y - 15);
  ctx.quadraticCurveTo(x - 5, y - 45, x + 3, y - 15);
  
  // second m
  ctx.quadraticCurveTo(x + 8, y - 45, x + 15, y - 15);
  ctx.quadraticCurveTo(x + 20, y - 45, x + 28, y - 15);
  ctx.quadraticCurveTo(x + 33, y - 45, x + 40, y - 15);
  
  // a
  ctx.quadraticCurveTo(x + 50, y - 35, x + 58, y - 15);
  ctx.quadraticCurveTo(x + 65, y, x + 60, y - 25);
  ctx.quadraticCurveTo(x + 50, y - 45, x + 45, y - 25);
  ctx.lineTo(x + 65, y - 15);

  // e
  ctx.quadraticCurveTo(x + 75, y - 40, x + 82, y - 25);
  ctx.quadraticCurveTo(x + 90, y - 10, x + 85, y - 15);

  // Tall 'l'
  ctx.quadraticCurveTo(x + 95, y - 110, x + 110, y - 130);
  ctx.quadraticCurveTo(x + 125, y - 140, x + 112, y - 30);
  ctx.quadraticCurveTo(x + 100, y + 30, x + 125, y + 15);
  
  // Ending wave
  ctx.quadraticCurveTo(x + 135, y + 25, x + 145, y + 15);
  
  ctx.stroke();
  ctx.restore();
}

function drawSignatureLine(ctx, x, y, label) {
  ctx.save();
  ctx.strokeStyle = '#16a7e8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 142, y);
  ctx.lineTo(x + 142, y);
  ctx.stroke();
  ctx.fillStyle = '#1f2937';
  ctx.font = '500 25px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + 42);
  ctx.restore();
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/);
  let line = '';
  let currentY = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line) ctx.fillText(line, x, currentY);
}

function fitCenteredText(ctx, text, x, y, maxWidth, startSize, minSize, family, weight) {
  let fontSize = startSize;
  do {
    ctx.font = `${weight} ${fontSize}px ${family}`;
    fontSize -= 2;
  } while (ctx.measureText(text).width > maxWidth && fontSize >= minSize);

  ctx.fillText(text, x, y);
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
