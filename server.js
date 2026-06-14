import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import midtransClient from 'midtrans-client';
import { evaluateExpression, calculatePrice, generateRoast, generateSpoiler } from './src/utils/calculator.js';
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

// Sajikan file statis dengan optimasi performa caching (Express Static Caching)
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d', // Cache aset selama 1 hari untuk mendongkrak performa Lighthouse
  etag: true,
  lastModified: true
}));

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

// Logika penentuan harga, roast, dan spoiler telah dipindahkan ke modul src/utils/calculator.js

app.post('/api/calculate', async (req, res) => {
  try {
    const expression = String(req.body?.expression || '').trim();
    const mode = String(req.body?.mode || 'deg').trim();
    if (!expression) {
      return res.status(400).json({ error: 'Masukkan perhitungan terlebih dahulu.' });
    }

    // Keamanan: Batasi panjang input rumus
    if (expression.length > 200) {
      return res.status(400).json({ error: 'Rumus terlalu panjang. Maksimal 200 karakter.' });
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
      item_details: [{ id: 'calc', price, quantity: 1, name: 'Hasil Kalkulator' }],
      metadata: {
        expression,
        mode,
        price: String(price),
        isJackpot: String(isJackpot)
      }
    });

    res.json({ orderId, token: transaction.token, redirectUrl: transaction.redirect_url });
  } catch (error) {
    console.error('Error in /api/calculate:', error);
    res.status(400).json({ error: 'Perhitungan gagal diproses.' });
  }
});

app.post('/api/spoiler', (req, res) => {
  try {
    const expression = String(req.body?.expression || '').trim();
    const mode = String(req.body?.mode || 'deg').trim();
    
    if (!expression) {
      return res.json({ spoiler: '', price: 0 });
    }

    // Keamanan: Batasi panjang input rumus
    if (expression.length > 200) {
      return res.json({ spoiler: 'Rumus terlalu panjang.', price: 0 });
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

    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      if (orders[orderId]) orders[orderId].status = 'settlement';
    } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
      if (orders[orderId]) orders[orderId].status = 'cancel';
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error in /api/midtrans/notification:', error);
    res.status(400).json({ error: 'Notifikasi tidak valid.' });
  }
});

app.post('/api/confirm-client', (req, res) => {
  if (!clientConfirmEnabled) return res.status(403).json({ error: 'Disabled' });
  const { orderId, expression } = req.body;
  const expr = String(expression || '').trim();
  if (!orders[orderId]) {
    orders[orderId] = { status: 'settlement', expression: expr, mode: 'deg', price: calculatePrice(expr), isJackpot: false };
  } else {
    orders[orderId].status = 'settlement';
  }
  res.json({ ok: true });
});

app.get('/api/result/:orderId', async (req, res) => {
  const { orderId } = req.params;

  // Cek memori lokal terlebih dahulu untuk feedback instan jika webhook/client-confirm telah berhasil
  const localOrder = orders[orderId];
  if (localOrder && localOrder.status === 'settlement') {
    try {
      const result = evaluateExpression(localOrder.expression, localOrder.mode);
      return res.json({
        result,
        price: localOrder.price,
        isJackpot: localOrder.isJackpot,
        roast: generateRoast(localOrder.expression, localOrder.price)
      });
    } catch (err) {
      return res.status(400).json({ error: 'Perhitungan gagal dievaluasi.' });
    }
  }

  // Fallback stateless: ambil data status langsung dari API Midtrans dan rekonsiliasi data dari metadata
  try {
    const statusResponse = await coreApi.transaction.status(orderId);
    if (isPaidStatus(statusResponse.transaction_status, statusResponse.fraud_status)) {
      // Ambil metadata yang tersemat pada transaksi Midtrans
      const metadata = statusResponse.metadata || {};
      const expr = metadata.expression || String(req.query.expression || '').trim();
      const mode = metadata.mode || String(req.query.mode || 'deg').trim();
      // Gunakan calculatePrice(expr) sebagai fallback utama daripada 1000 flat agar harga acak tetap konsisten
      const price = metadata.price ? Number(metadata.price) : calculatePrice(expr);
      const isJackpot = metadata.isJackpot === 'true' || metadata.isJackpot === true;

      // Sinkronkan ke memori lokal jika instans ini masih hidup
      if (localOrder) {
        localOrder.status = 'settlement';
      } else {
        orders[orderId] = { status: 'settlement', expression: expr, mode, price, isJackpot };
      }

      const result = evaluateExpression(expr, mode);
      return res.json({
        result,
        price,
        isJackpot,
        roast: generateRoast(expr, price)
      });
    } else {
      return res.status(402).json({ error: 'Pembayaran belum diselesaikan.' });
    }
  } catch (error) {
    console.error('Error in /api/result/:orderId:', error);
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
