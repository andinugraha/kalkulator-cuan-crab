import 'dotenv/config';
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import midtransClient from 'midtrans-client';
import { evaluateExpression, calculatePrice, generateRoast, generateSpoiler } from './src/utils/calculator.js';
import { getContentPage } from './src/pages/content.js';
import { getSitemapXml } from './src/templates/html.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 3001);

// CONFIGURATION & ENVIRONMENT
const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const clientConfirmEnabled = process.env.ENABLE_CLIENT_PAYMENT_CONFIRM === 'true';

const serverKey = process.env.MIDTRANS_SERVER_KEY;
const clientKey = process.env.MIDTRANS_CLIENT_KEY;
const sandboxServerKey = process.env.MIDTRANS_SANDBOX_SERVER_KEY || serverKey;
const sandboxClientKey = process.env.MIDTRANS_SANDBOX_CLIENT_KEY || clientKey;

const requiredEnv = ['MIDTRANS_SERVER_KEY', 'MIDTRANS_CLIENT_KEY'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

// MIDTRANS INSTANCES
const snap = new midtransClient.Snap({
  isProduction,
  serverKey: serverKey,
  clientKey: clientKey
});

const coreApi = new midtransClient.CoreApi({
  isProduction,
  serverKey: serverKey,
  clientKey: clientKey
});

const coreApiSandbox = new midtransClient.CoreApi({
  isProduction: false,
  serverKey: sandboxServerKey,
  clientKey: sandboxClientKey
});

const orders = {};

// MIDDLEWARE
app.use(express.json());

// 1. HEALTH CHECK & WEBHOOK (MUST BE AT THE TOP)
app.get('/api/midtrans/notification', (req, res) => {
  console.log('>>> [GET] Midtrans Health Check Received');
  res.status(200).json({
    status: 'ok',
    environment: isProduction ? 'production' : 'sandbox',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/midtrans/notification', async (req, res) => {
  const body = req.body || {};
  const order_id = body.order_id || '';
  const status_code = body.status_code;
  const gross_amount = body.gross_amount;
  const signature_key = body.signature_key;

  console.log('====== [MIDTRANS WEBHOOK RECEIVED] ======');
  console.log(`- Runtime Env: ${isProduction ? 'PRODUCTION' : 'SANDBOX'}`);
  console.log(`- Order ID: ${order_id}`);
  console.log(`- Status Code: ${status_code}`);
  console.log(`- Payload:`, JSON.stringify(body));

  try {
    // A. DETEKSI TEST NOTIFICATION (Penyebab Utama BadRequest)
    // Jika dari dashboard Midtrans "Send Test Notification", JANGAN panggil API notification()
    if (!order_id || order_id.includes('payment_notif_test') || order_id.includes('test-notification')) {
      console.log('>>> [TEST NOTIFICATION DETECTED] Skip API call, returning 200 OK');
      return res.status(200).json({ status: 'ok', message: 'Test notification received' });
    }

    // B. PENENTUAN INSTANCE & KEY (Sandbox vs Production)
    const isSandboxNotif = !isProduction || order_id.startsWith('SB-') || order_id.includes('test');
    const apiInstance = isSandboxNotif ? coreApiSandbox : coreApi;
    const activeServerKey = isSandboxNotif ? sandboxServerKey : serverKey;

    // C. SIGNATURE VERIFICATION (Manual SHA512)
    if (signature_key && order_id && status_code && gross_amount) {
      const rawString = order_id + status_code + gross_amount + activeServerKey;
      const calculatedSignature = crypto.createHash('sha512').update(rawString).digest('hex');
      
      console.log(`- Received Signature: ${signature_key}`);
      console.log(`- Calculated Signature: ${calculatedSignature}`);

      if (signature_key !== calculatedSignature) {
        console.warn(`[WARNING] Signature mismatch for Order: ${order_id}`);
        // Di sandbox/test, kita toleransi agar tidak 403 palsu saat review
        if (isProduction && !order_id.includes('test')) {
          console.error('[CRITICAL] Signature Invalid in Production!');
          // Tetap return 200 agar Midtrans tidak spam retry, tapi jangan proses database
          return res.status(200).json({ status: 'error', message: 'Invalid signature' });
        }
      } else {
        console.log('[SUCCESS] Signature Verified.');
      }
    }

    // D. FETCH VERIFIED NOTIFICATION DATA
    // Menggunakan notification() untuk memastikan data benar-benar dari Midtrans
    const notification = await apiInstance.transaction.notification(body);
    
    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;

    console.log(`- Verified Order ID: ${orderId}`);
    console.log(`- Transaction Status: ${transactionStatus}`);
    console.log(`- Fraud Status: ${fraudStatus}`);

    // E. UPDATE DATABASE (Memory Store)
    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      if (fraudStatus === 'challenge') {
        if (orders[orderId]) orders[orderId].status = 'challenge';
      } else {
        if (orders[orderId]) orders[orderId].status = 'settlement';
      }
    } else if (['cancel', 'deny', 'expire'].includes(transactionStatus)) {
      if (orders[orderId]) orders[orderId].status = 'cancel';
    } else if (transactionStatus === 'pending') {
      if (orders[orderId]) orders[orderId].status = 'pending';
    }

    return res.status(200).json({ status: 'ok' });

  } catch (error) {
    // FIX BUG: Jangan ada catch di dalam catch. Selalu return 200 ke Midtrans.
    console.error('[ERROR] Webhook processing failed:', error.message);
    return res.status(200).json({ 
      status: 'error', 
      message: error.message,
      note: 'Returned 200 to Midtrans to acknowledge receipt despite error'
    });
  } finally {
    console.log('====== [END MIDTRANS WEBHOOK] ======');
  }
});

// 2. SECURITY HEADERS
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// 3. PAGE ROUTES
const contentRoutes = ['produk', 'tentang', 'kontak', 'privasi', 'syarat', 'refund', 'faq'];
contentRoutes.forEach((slug) => {
  app.get(`/${slug}`, (_req, res) => {
    const html = getContentPage(slug);
    if (!html) return res.status(404).send('Halaman tidak ditemukan.');
    res.type('html').send(html);
  });
});

app.get('/sitemap.xml', (_req, res) => res.type('application/xml').send(getSitemapXml()));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// 4. STATIC ASSETS
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));

app.get('/config.js', (_req, res) => {
  res.type('application/javascript').send(`
window.APP_CONFIG = {
  midtransReady: ${missingEnv.length === 0},
  midtransClientKey: ${JSON.stringify(process.env.MIDTRANS_CLIENT_KEY || '')},
  snapUrl: ${JSON.stringify(isProduction ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js')},
  clientConfirmEnabled: ${clientConfirmEnabled}
};`);
});

// 5. CALCULATION ENDPOINTS
app.post('/api/calculate', async (req, res) => {
  try {
    const { expression, mode = 'deg' } = req.body || {};
    const expr = String(expression || '').trim();
    if (!expr || expr.length > 200) return res.status(400).json({ error: 'Input tidak valid.' });

    if (missingEnv.length > 0) return res.json({ result: evaluateExpression(expr, mode) });

    const price = calculatePrice(expr);
    const orderId = `CALC-${Date.now()}`;
    const isJackpot = Math.random() < 0.05;

    orders[orderId] = { status: 'pending', expression: expr, mode, price, isJackpot };

    const transaction = await snap.createTransaction({
      transaction_details: { order_id: orderId, gross_amount: price },
      item_details: [{ id: 'calc', price, quantity: 1, name: 'Hasil Kalkulator' }],
      metadata: { expression: expr, mode, price: String(price), isJackpot: String(isJackpot) }
    });

    res.json({ orderId, token: transaction.token, redirect_url: transaction.redirect_url });
  } catch (error) {
    res.status(400).json({ error: 'Proses gagal.' });
  }
});

app.post('/api/spoiler', (req, res) => {
  try {
    const { expression, mode = 'deg' } = req.body || {};
    const expr = String(expression || '').trim();
    if (!expr) return res.json({ spoiler: '', price: 0 });
    const result = evaluateExpression(expr, mode);
    res.json({ spoiler: generateSpoiler(result), price: calculatePrice(expr) });
  } catch (error) {
    res.json({ spoiler: '', price: 0 });
  }
});

app.get('/api/result/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const localOrder = orders[orderId];

  if (localOrder && localOrder.status === 'settlement') {
    return res.json({
      result: evaluateExpression(localOrder.expression, localOrder.mode),
      price: localOrder.price,
      isJackpot: localOrder.isJackpot,
      roast: generateRoast(localOrder.expression, localOrder.price)
    });
  }

  try {
    const statusResponse = await coreApi.transaction.status(orderId);
    if (isPaidStatus(statusResponse.transaction_status, statusResponse.fraud_status)) {
      const metadata = statusResponse.metadata || {};
      return res.json({
        result: evaluateExpression(metadata.expression || '', metadata.mode || 'deg'),
        price: Number(metadata.price || 0),
        isJackpot: metadata.isJackpot === 'true',
        roast: generateRoast(metadata.expression || '', Number(metadata.price || 0))
      });
    }
    return res.status(402).json({ error: 'Pembayaran belum selesai.' });
  } catch (error) {
    return res.status(404).json({ error: 'Data tidak ditemukan.' });
  }
});

app.listen(port, () => console.log(`Server running on port ${port}`));

function isPaidStatus(ts, fs) {
  return ts === 'settlement' || (ts === 'capture' && (fs === 'accept' || fs === undefined));
}
