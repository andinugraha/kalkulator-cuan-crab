import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import midtransClient from 'midtrans-client';
import { evaluateExpression } from './public/calculator.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 3001);
const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const resultPrice = Number(process.env.RESULT_PRICE || 5000);
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

const orders = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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

app.post('/api/calculate', async (req, res) => {
  try {
    if (missingEnv.length > 0) {
      return res.status(500).json({
        error: `Konfigurasi Midtrans belum lengkap: ${missingEnv.join(', ')}`
      });
    }

    const expression = String(req.body?.expression || '').trim();
    const mode = String(req.body?.mode || 'deg').trim();
    if (!expression) {
      return res.status(400).json({ error: 'Masukkan perhitungan terlebih dahulu.' });
    }

    const result = evaluateExpression(expression, mode);
    
    // Kriptografi: Buat signature agar orderId hanya valid untuk ekspresi dan mode ini saja
    const salt = crypto.randomBytes(4).toString('hex'); // 8 karakter heksadesimal
    const secret = process.env.MIDTRANS_SERVER_KEY || 'default_secret';
    const hash = crypto.createHmac('sha256', secret)
      .update(`${expression}:${mode}:${salt}`)
      .digest('hex')
      .slice(0, 16); // 16 karakter hash

    const orderId = `C-${salt}-${hash}`;

    orders.set(orderId, {
      expression,
      mode,
      result,
      paid: false,
      createdAt: Date.now()
    });

    const transaction = await snap.createTransaction({
      transaction_details: {
        order_id: orderId,
        gross_amount: resultPrice
      },
      item_details: [
        {
          id: 'hasil-kalkulator',
          price: resultPrice,
          quantity: 1,
          name: 'Hasil Kalkulator'
        }
      ],
      callbacks: {
        finish: `${req.protocol}://${req.get('host')}/`
      }
    });

    res.json({
      orderId,
      token: transaction.token,
      redirectUrl: transaction.redirect_url
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Perhitungan gagal diproses.' });
  }
});

app.post('/api/midtrans/notification', async (req, res) => {
  try {
    const notification = await coreApi.transaction.notification(req.body);
    const order = orders.get(notification.order_id);

    if (order && isPaidStatus(notification.transaction_status, notification.fraud_status)) {
      order.paid = true;
      order.paidAt = Date.now();
      order.paymentStatus = notification.transaction_status;
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Notifikasi tidak valid.' });
  }
});

app.post('/api/confirm-client', (req, res) => {
  if (!clientConfirmEnabled) {
    return res.status(403).json({ error: 'Konfirmasi client dinonaktifkan.' });
  }

  const orderId = String(req.body?.orderId || '');
  const order = orders.get(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  }

  order.paid = true;
  order.paidAt = Date.now();
  order.paymentStatus = 'client-confirmed';
  res.json({ ok: true });
});

app.get('/api/result/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const expression = String(req.query.expression || '').trim();
  const mode = String(req.query.mode || 'deg').trim();

  if (!expression) {
    return res.status(400).json({ error: 'Parameter expression wajib disertakan.' });
  }

  // 1. Validasi keaslian orderId terhadap expression dan mode
  const parts = orderId.split('-');
  if (parts.length !== 3 || parts[0] !== 'C') {
    return res.status(400).json({ error: 'Order ID tidak valid.' });
  }

  const salt = parts[1];
  const expectedHash = parts[2];
  const secret = process.env.MIDTRANS_SERVER_KEY || 'default_secret';
  const hash = crypto.createHmac('sha256', secret)
    .update(`${expression}:${mode}:${salt}`)
    .digest('hex')
    .slice(0, 16);

  if (hash !== expectedHash) {
    return res.status(400).json({ error: 'Verifikasi rumus gagal (rumus tidak cocok dengan Order ID).' });
  }

  // 2. Cek status pembayaran
  // Cek memori lokal terlebih dahulu (untuk testing konfirmasi client lokal)
  const localOrder = orders.get(orderId);
  if (localOrder && localOrder.paid) {
    return res.json({
      expression: localOrder.expression,
      result: localOrder.result
    });
  }

  // Cek langsung ke Midtrans API (Stateless - Menjamin berjalan di Vercel Serverless)
  try {
    const statusResponse = await coreApi.transaction.status(orderId);
    
    if (isPaidStatus(statusResponse.transaction_status, statusResponse.fraud_status)) {
      const result = evaluateExpression(expression, mode);
      
      // Update memori lokal jika orderId ada di Map (opsional)
      if (localOrder) {
        localOrder.paid = true;
      }

      return res.json({
        expression,
        result
      });
    } else {
      return res.status(402).json({ error: 'Pembayaran belum diselesaikan.' });
    }
  } catch (error) {
    console.error('Error fetching Midtrans status:', error);
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
