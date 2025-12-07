require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Validasi environment variable
if (!process.env.MIDTRANS_SERVER_KEY) {
  console.error("❌ MIDTRANS_SERVER_KEY tidak ditemukan di .env");
  process.exit(1);
}

const IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === "true";
const MIDTRANS_API = IS_PRODUCTION
  ? "https://app.midtrans.com"
  : "https://app.sandbox.midtrans.com";

console.log(`🚀 Server mode: ${IS_PRODUCTION ? "PRODUCTION" : "SANDBOX"}`);

// ENDPOINT UTAMA: CREATE SNAP TOKEN
app.post("/create-transaction", async (req, res) => {
  try {
    const { amount, orderId, customer } = req.body;

    // Validasi input
    if (!amount || !orderId) {
      return res.status(400).json({
        success: false,
        error: "amount dan orderId wajib diisi",
      });
    }

    // Buat authorization header
    const auth = Buffer.from(process.env.MIDTRANS_SERVER_KEY + ":").toString(
      "base64"
    );

    // Request Snap Token ke Midtrans
    const snapResponse = await axios.post(
      `${MIDTRANS_API}/snap/v1/transactions`,
      {
        transaction_details: {
          order_id: orderId,
          gross_amount: amount,
        },
        customer_details: {
          first_name: customer?.name || "Pembeli",
          email: customer?.email || "customer@example.com",
          phone: customer?.phone || "081234567890",
        },
        enabled_payments: ["qris", "gopay", "shopeepay", "other_qris"],
        callbacks: {
          finish: "https://yourdomain.com/payment-success",
        },
        expiry: {
          start_time:
            new Date(Date.now() + 60 * 1000)
              .toISOString()
              .slice(0, 19)
              .replace("T", " ") + " +0700",
          unit: "minutes",
          duration: 15,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
      }
    );

    const { token, redirect_url } = snapResponse.data;

    console.log(`✅ Snap token berhasil dibuat untuk order: ${orderId}`);

    // Kirim snap token ke frontend
    res.json({
      success: true,
      snap_token: token,
      redirect_url: redirect_url,
      order_id: orderId,
      amount: amount,
    });
  } catch (err) {
    console.error(
      "❌ Error create transaction:",
      err.response?.data || err.message
    );
    res.status(500).json({
      success: false,
      error:
        err.response?.data?.error_messages?.[0] ||
        err.message ||
        "Gagal membuat transaksi",
    });
  }
});

// ENDPOINT HEALTH CHECK
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    mode: IS_PRODUCTION ? "PRODUCTION" : "SANDBOX",
    timestamp: new Date().toISOString(),
  });
});

// ENDPOINT WEBHOOK (opsional, untuk auto-update status)
app.post("/webhook", async (req, res) => {
  try {
    const notification = req.body;
    console.log("📩 Webhook received:", notification);

    // Validasi signature (PENTING untuk produksi)
    // TODO: Implementasi signature validation

    const { order_id, transaction_status, fraud_status } = notification;

    console.log(`📋 Order ${order_id} status: ${transaction_status}`);

    // Di sini Anda bisa update status di Firestore
    // await updateDoc(doc(db, "transactions", order_id), { status: transaction_status });

    res.json({ status: "OK" });
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint ${req.method} ${req.path} tidak ditemukan`,
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}`);
  console.log(
    `📡 Mode: ${IS_PRODUCTION ? "PRODUCTION ⚠️" : "SANDBOX (testing)"}`
  );
});
