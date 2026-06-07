const expressionEl = document.querySelector('#expression');
const statusEl = document.querySelector('#status');
const keys = document.querySelectorAll('.key');

let expression = '';
let busy = false;
let snapLoading;

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

  setBusy(true);
  setStatus('Menyiapkan pembayaran...');

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
        await markClientPaid(payload.orderId);
        await revealResult(payload.orderId);
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

async function revealResult(orderId) {
  setStatus('Memeriksa pembayaran...');

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`/api/result/${encodeURIComponent(orderId)}`);
    const payload = await response.json();

    if (response.ok) {
      expression = payload.result;
      renderExpression();
      setStatus('');
      setBusy(false);
      return;
    }

    await wait(1200);
  }

  setStatus('Pembayaran diproses. Coba muat ulang sebentar lagi.');
  setBusy(false);
}

async function markClientPaid(orderId) {
  if (!window.APP_CONFIG.clientConfirmEnabled) return;

  await fetch('/api/confirm-client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId })
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
