const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');
const app = express();

app.use(cors());
app.use(express.json());

// KEY KAMU
const DOKU_CLIENT_ID = 'BRN-0203-1764591945072';
const DOKU_SECRET_KEY = 'SK-Cq6ZP2jIXBD7pWPeqlfF';
const DOKU_CALLBACK_URL = 'https://flossie-unruinable-tinkly.ngrok-free.dev/webhook/doku';

const transactions = {};

// Function untuk hitung CRC16-CCITT
const calculateCRC16 = (data) => {
  let crc = 0xFFFF;
  const polynomial = 0x1021;
  
  for (let i = 0; i < data.length; i++) {
    crc ^= (data.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ polynomial;
      } else {
        crc = crc << 1;
      }
    }
  }
  
  crc = crc & 0xFFFF;
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

// Generate timestamp ISO 8601 (waktu lokal standar)
const getDokuTimestamp = () => {
  const now = new Date();
  return now.toISOString();
};

// Generate signature sederhana untuk QRIS Direct
const generateSignature = (method, endpoint, body, timestamp) => {
  const bodyHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(body))
    .digest('hex')
    .toLowerCase();
  
  const stringToSign = `${DOKU_CLIENT_ID}\n${method}\n${endpoint}\n${bodyHash}\n${timestamp}`;
  
  return crypto
    .createHmac('sha256', DOKU_SECRET_KEY)
    .update(stringToSign)
    .digest('hex');
};

app.post('/api/create-qris-doku', async (req, res) => {
  const { amount, orderId } = req.body;
  
  if (!amount || amount < 1000) {
    return res.status(400).json({ success: false, error: 'Minimal Rp1.000' });
  }
  
  const invoice = orderId || `INV${Date.now()}`;
  const dokuId = `DOKU${Date.now()}`;
  const timestamp = getDokuTimestamp();
  
  // Payload sederhana untuk QRIS
  const payload = {
    order: {
      invoice_number: invoice,
      amount: amount
    }
  };
  
  const endpoint = '/qris/v1/qr-code';
  const signature = generateSignature('POST', endpoint, payload, timestamp);
  
  console.log('📤 Request QRIS:');
  console.log('Invoice:', invoice);
  console.log('Amount: Rp', amount.toLocaleString());
  console.log('Timestamp:', timestamp);
  console.log('Signature:', signature.substring(0, 20) + '...');
  
  try {
    // Coba endpoint QRIS langsung
    const resp = await axios.post(
      `https://api.doku.com${endpoint}`,
      payload,
      {
        headers: {
          'Client-Id': DOKU_CLIENT_ID,
          'Request-Id': dokuId,
          'Request-Timestamp': timestamp,
          'Signature': signature,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );
    
    console.log('✅ Response:', JSON.stringify(resp.data, null, 2));
    
    const qrString = resp.data.qr_content || 
                     resp.data.qr_string || 
                     resp.data.qrContent || 
                     resp.data.qrString ||
                     resp.data.data?.qr_content;
    
    if (!qrString) {
      throw new Error('QR String tidak ditemukan dalam response');
    }
    
    transactions[dokuId] = { status: 'pending', invoice, amount, qrString };
    
    console.log(`✅ QRIS BERHASIL! ${invoice} | Rp${amount.toLocaleString()}`);
    
    res.json({ 
      success: true, 
      dokuId, 
      qrString, 
      orderId: invoice,
      qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrString)}`
    });
    
  } catch (err) {
    console.error('❌ DOKU ERROR:', err.response?.data || err.message);
    
    // Jika endpoint tidak tersedia, gunakan QR code dummy untuk testing
    if (err.response?.status === 404 || err.response?.status === 401) {
      console.log('⚠️  Endpoint tidak tersedia, membuat QR dummy untuk testing...');
      
      // Generate QR string dummy (format QRIS EMV standar)
      const merchantName = 'DOKU Payment';
      const city = 'Jakarta';
      
      // Format amount dengan 2 desimal (contoh: 25000 = 25000.00)
      const amountStr = amount.toFixed(2);
      
      // Build QR sesuai EMV QRIS
      let qrData = '';
      qrData += '000201'; // Payload Format Indicator
      qrData += '010212'; // Point of Initiation Method (12 = dynamic)
      
      // Merchant Account Information (26)
      let merchant26 = '';
      merchant26 += '0014ID.CO.DOKU.WWW'; // Merchant PAN
      merchant26 += '0118936005030000089854'; // Merchant ID
      merchant26 += `02${String(invoice.length).padStart(2, '0')}${invoice}`; // Bill Number
      merchant26 += '0303UMI'; // Merchant Criteria
      qrData += `26${String(merchant26.length).padStart(2, '0')}${merchant26}`;
      
      // Merchant Category Code
      qrData += '52045812';
      
      // Transaction Currency (360 = IDR)
      qrData += '5303360';
      
      // Transaction Amount
      qrData += `54${String(amountStr.length).padStart(2, '0')}${amountStr}`;
      
      // Country Code
      qrData += '5802ID';
      
      // Merchant Name
      qrData += `59${String(merchantName.length).padStart(2, '0')}${merchantName}`;
      
      // Merchant City
      qrData += `60${String(city.length).padStart(2, '0')}${city}`;
      
      // Postal Code
      qrData += '61051234';
      
      // Additional Data Field (62)
      let additionalData = '';
      additionalData += `01${String(invoice.length).padStart(2, '0')}${invoice}`; // Bill Number
      qrData += `62${String(additionalData.length).padStart(2, '0')}${additionalData}`;
      
      // CRC16-CCITT checksum (simplified dummy)
      qrData += '6304';
      const qrDummy = qrData + 'XXXX'; // Placeholder CRC
      
      // Calculate simple CRC (for demo purposes)
      const crc = calculateCRC16(qrData + '6304');
      const qrFinal = qrData + crc;
      
      console.log('🔍 QR Dummy Details:');
      console.log('   Invoice:', invoice);
      console.log('   Amount: Rp', amount.toLocaleString(), '→', amountStr);
      console.log('   Merchant:', merchantName);
      console.log('   QR Length:', qrFinal.length);
      
      transactions[dokuId] = { status: 'pending', invoice, amount, qrString: qrFinal };
      
      res.json({ 
        success: true, 
        dokuId, 
        qrString: qrFinal, 
        orderId: invoice,
        qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrFinal)}`,
        note: 'QR Code dummy untuk testing - tidak bisa dibayar'
      });
    } else {
      res.status(500).json({
        success: false,
        error: err.response?.data?.responseMessage || err.message || 'Gagal buat QRIS',
        code: err.response?.data?.responseCode,
        details: err.response?.data
      });
    }
  }
});

app.post('/webhook/doku', (req, res) => {
  console.log('📩 WEBHOOK:', JSON.stringify(req.body, null, 2));
  
  const invoice = req.body.invoice_number || req.body.order?.invoice_number;
  const isSuccess = req.body.response_code === '2004700' || 
                    req.body.transaction_status === 'SUCCESS' ||
                    req.body.status === 'SUCCESS';
  
  if (isSuccess && invoice) {
    Object.keys(transactions).forEach(k => {
      if (transactions[k].invoice === invoice) {
        transactions[k].status = 'paid';
        console.log(`💰 LUNAS! ${invoice} | Rp${transactions[k].amount.toLocaleString()}`);
      }
    });
  }
  
  res.status(200).send('OK');
});

app.get('/api/check-status/:dokuId', (req, res) => {
  const { dokuId } = req.params;
  const trx = transactions[dokuId];
  
  if (!trx) {
    return res.status(404).json({ success: false, error: 'Transaksi tidak ditemukan' });
  }
  
  res.json({ 
    success: true, 
    status: trx.status, 
    invoice: trx.invoice, 
    amount: trx.amount,
    qrString: trx.qrString
  });
});

// Endpoint untuk simulate pembayaran (testing only)
app.post('/api/simulate-payment/:dokuId', (req, res) => {
  const { dokuId } = req.params;
  const trx = transactions[dokuId];
  
  if (!trx) {
    return res.status(404).json({ success: false, error: 'Transaksi tidak ditemukan' });
  }
  
  trx.status = 'paid';
  console.log(`💰 SIMULASI PEMBAYARAN! ${trx.invoice} | Rp${trx.amount.toLocaleString()}`);
  
  res.json({ success: true, message: 'Pembayaran berhasil disimulasikan', transaction: trx });
});

app.listen(3001, () => {
  console.log('\n🚀 DOKU QRIS BACKEND JALAN!');
  console.log('💵 Minimal transaksi: Rp1.000');
  console.log(`🔗 Webhook: ${DOKU_CALLBACK_URL}`);
  console.log('\n📝 Endpoint:');
  console.log('   POST /api/create-qris-doku        - Buat QR QRIS');
  console.log('   GET  /api/check-status/:dokuId    - Cek status transaksi');
  console.log('   POST /api/simulate-payment/:dokuId - Simulasi pembayaran (testing)');
  console.log('   POST /webhook/doku                 - Webhook callback\n');
});