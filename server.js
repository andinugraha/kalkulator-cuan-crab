import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import midtransClient from 'midtrans-client';
import { evaluateExpression } from './src/utils/calculator.js';
import { getContentPage } from './src/pages/content.js';
import { getSitemapXml } from './src/templates/html.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 3001);
const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const clientConfirmEnabled = process.env.ENABLE_CLIENT_PAYMENT_CONFIRM === 'true';

const requiredEnv = ['MIDTRANS_SERVER_KEY', 'MIDTRANS_CLIENT_KEY'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

const snap = new midtransClient.Snap({
  isProduction,
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-CHANGE_ME',
  clientKey: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-CHANGE_ME'
});

const coreApi = new midtransClient.CoreApi({
  isProduction,
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-CHANGE_ME',
  clientKey: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-CHANGE_ME'
});

const orders = {};

app.use(express.json());

const contentRoutes = ['produk', 'tentang', 'kontak', 'privasi', 'syarat', 'refund', 'faq'];

contentRoutes.forEach((slug) => {
  app.get(`/${slug}`, (_req, res) => {
    const html = getContentPage(slug);
    if (!html) return res.status(404).send('Halaman tidak ditemukan.');
    res.type('html').send(html);
  });
});

app.get('/sitemap.xml', (_req, res) => {
  res.type('application/xml').send(getSitemapXml());
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/config.js', (_req, res) => {
  res.type('application/javascript').send(`
window.APP_CONFIG = {
  midtransReady: ${missingEnv.length === 0},
  midtransClientKey: ${JSON.stringify(process.env.MIDTRANS_CLIENT_KEY || '')},
  snapUrl: ${JSON.stringify(isProduction
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js')},
  clientConfirmEnabled: ${clientConfirmEnabled}
};`);
});

// Harga Dinamis
function calculatePrice(expression) {
  let price = 1000;
  
  const funcs = ['sin', 'cos', 'tan', 'log', 'ln', 'asin', 'acos', 'atan', 'sqrt'];
  funcs.forEach((f) => {
    const matches = expression.match(new RegExp(f, 'g'));
    if (matches) price += matches.length * 2000;
  });

  const sqrtMatches = expression.match(/√/g);
  if (sqrtMatches) price += sqrtMatches.length * 2000;

  const ops = ['\\+', '\\-', '\\*', '\\/', '\\^', '%'];
  ops.forEach(op => {
    const matches = expression.match(new RegExp(op, 'g'));
    if (matches) price += matches.length * 500;
  });

  return Math.min(price, 100000); // Max 100k
}

// Roast
function generateRoast(expression, price) {
  if (expression.replace(/\s/g, '') === '1+1') return '1+1=2. Anak TK juga tau! Sayang banget uangnya.';
  if (price > 10000) return `Buset, bayar Rp ${price.toLocaleString('id-ID')} buat rumus keriting ginian? Fix lo lagi ujian tapi males mikir.`;
  if (price === 1000) return `Rp 1.000 buat ngitung sepele gini? Emang hape lo ga ada aplikasi kalkulator gratisan?`;
  return `Uang Rp ${price.toLocaleString('id-ID')} melayang demi kepastian matematika. Definisi sultan gabut sejati.`;
}

function generateSpoiler(result) {
  const resStr = String(result);
  if (resStr.includes('e') || resStr.includes('E')) {
    return "Hasilnya adalah notasi ilmiah.";
  }
  const isNegative = resStr.startsWith('-');
  const isDecimal = resStr.includes('.');
  const length = resStr.replace(/[-.]/g, '').length;
  
  let hints = [];
  hints.push(isNegative ? "Bilangan negatif" : "Bilangan positif");
  hints.push(isDecimal ? "memiliki nilai desimal" : "bulat");
  hints.push(`dengan ${length} digit angka`);
  
  if (!isDecimal) {
    const num = parseInt(resStr, 10);
    if (!isNaN(num)) hints.push(num % 2 === 0 ? "genap" : "ganjil");
  }

  return hints.join(", ") + ".";
}

app.post('/api/calculate', async (req, res) => {
  try {
    const expression = String(req.body?.expression || '').trim();
    const mode = String(req.body?.mode || 'deg').trim();
    if (!expression) {
      return res.status(400).json({ error: 'Masukkan perhitungan terlebih dahulu.' });
    }

    if (missingEnv.length > 0) {
      return res.json({ result: evaluateExpression(expression, mode) });
    }

    const price = calculatePrice(expression);
    const orderId = `CALC-${Date.now()}`;
    const isJackpot = Math.random() < 0.05; // 5% chance

    orders[orderId] = { status: 'pending', expression, mode, price, isJackpot };

    const transaction = await snap.createTransaction({
      transaction_details: { order_id: orderId, gross_amount: price },
      item_details: [{ id: 'calc', price, quantity: 1, name: 'Hasil Kalkulator' }]
    });

    res.json({ orderId, token: transaction.token, redirectUrl: transaction.redirect_url });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Perhitungan gagal.' });
  }
});

app.post('/api/spoiler', (req, res) => {
  try {
    const expression = String(req.body?.expression || '').trim();
    const mode = String(req.body?.mode || 'deg').trim();
    
    if (!expression) {
      return res.json({ spoiler: '', price: 0 });
    }
    
    const openCount = (expression.match(/\(/g) || []).length;
    const closeCount = (expression.match(/\)/g) || []).length;
    if (openCount !== closeCount) {
      return res.json({ spoiler: '...', price: calculatePrice(expression) });
    }

    const price = calculatePrice(expression);
    const result = evaluateExpression(expression, mode);
    res.json({ 
      spoiler: generateSpoiler(result),
      price: price
    });
  } catch (error) {
    res.json({ spoiler: '', price: calculatePrice(req.body?.expression || '') });
  }
});

app.post('/api/midtrans/notification', async (req, res) => {
  try {
    const notification = await coreApi.transaction.notification(req.body);
    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;

    if (transactionStatus == 'capture' || transactionStatus == 'settlement') {
      if (orders[orderId]) orders[orderId].status = 'settlement';
    } else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire') {
      if (orders[orderId]) orders[orderId].status = 'cancel';
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Notifikasi tidak valid.' });
  }
});

app.post('/api/confirm-client', (req, res) => {
  if (!clientConfirmEnabled) return res.status(403).json({ error: 'Disabled' });
  const { orderId } = req.body;
  if (!orders[orderId]) {
    orders[orderId] = { status: 'settlement', expression: '', mode: 'deg', price: 1000, isJackpot: false };
  } else {
    orders[orderId].status = 'settlement';
  }
  res.json({ ok: true });
});

app.get('/api/result/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const expression = String(req.query.expression || '').trim();
  const mode = String(req.query.mode || 'deg').trim();

  // Try local first for instant feedback if webhook or client-confirm passed
  const localOrder = orders[orderId];
  if (localOrder && localOrder.status === 'settlement') {
    const result = evaluateExpression(expression, mode);
    return res.json({
      result,
      price: localOrder.price,
      isJackpot: localOrder.isJackpot,
      roast: generateRoast(expression, localOrder.price)
    });
  }

  // Fallback to Midtrans status API
  try {
    const statusResponse = await coreApi.transaction.status(orderId);
    if (isPaidStatus(statusResponse.transaction_status, statusResponse.fraud_status)) {
      if (localOrder) localOrder.status = 'settlement';
      
      const price = localOrder ? localOrder.price : 1000;
      const isJackpot = localOrder ? localOrder.isJackpot : false;
      const result = evaluateExpression(expression, mode);
      
      return res.json({
        result,
        price,
        isJackpot,
        roast: generateRoast(expression, price)
      });
    } else {
      return res.status(402).json({ error: 'Pembayaran belum diselesaikan.' });
    }
  } catch (error) {
    return res.status(402).json({ error: 'Pembayaran belum diselesaikan atau tidak terdaftar.' });
  }
});

app.listen(port, () => {
  console.log(`Kalkulator berjalan di http://localhost:${port}`);
});

function isPaidStatus(transactionStatus, fraudStatus) {
  if (transactionStatus === 'capture') {
    return fraudStatus === 'accept' || fraudStatus === undefined;
  }
  return transactionStatus === 'settlement';
}
