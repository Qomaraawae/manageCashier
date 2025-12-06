require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const app = express();

// === CORS – DIPERBAIKI & DIPERKUAT ===
app.use(cors({
  origin: [
    "https://storecashier.netlify.app",
    "http://localhost:5173",        // untuk development vite
    "http://localhost:3000",        // kalau pakai port lain
  ],
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Handle preflight untuk semua route (penting!)
app.options("*", cors());

app.use(express.json());

// ============= MIDTRANS CONFIG =============
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY;
const MIDTRANS_IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === "true";
const MIDTRANS_API_URL = MIDTRANS_IS_PRODUCTION
  ? "https://app.midtrans.com"
  : "https://app.sandbox.midtrans.com";

const PORT = process.env.PORT || 3001;

if (!MIDTRANS_SERVER_KEY || !MIDTRANS_CLIENT_KEY) {
  console.error("MIDTRANS_SERVER_KEY atau MIDTRANS_CLIENT_KEY tidak ada di environment!");
  process.exit(1);
}

// Simpan transaksi sementara di memory
const transactions = {};

// ============= ENDPOINT SNAP – DIPERBAIKI =============
// SESUAI DENGAN YANG DIPANGGIL FRONTEND: /create-transaction (tanpa /api)
app.post("/create-transaction", async (req, res) => {
  const { amount, orderId, customer } = req.body;

  if (!amount || !orderId) {
    return res.status(400).json({ success: false, error: "Amount & orderId wajib diisi" });
  }

  const authString = Buffer.from(MIDTRANS_SERVER_KEY + ":").toString("base64");

  const payload = {
    transaction_details: {
      order_id: orderId,
      gross_amount: amount,
    },
    customer_details: {
      first_name: customer?.name || "Customer",
      email: customer?.email || "customer@example.com",
      phone: customer?.phone || "081234567890",
    },
    item_details: [
      {
        id: "ITEM-001",
        price: amount,
        quantity: 1,
        name: "Pembayaran di Kasir",
      },
    ],
    enabled_payments: [
      "gopay",
      "shopeepay",
      "qris",
      "bank_transfer",
      "indomaret",
      "alfamart",
    ],
    callbacks: {
      finish: "https://storecashier.netlify.app/payment-success",
    },
  };

  try {
    const response = await axios.post(
      `${MIDTRANS_API_URL}/snap/v1/transactions`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authString}`,
        },
      }
    );

    transactions[orderId] = {
      status: "pending",
      amount,
      createdAt: new Date(),
    };

    console.log("Transaksi dibuat:", orderId, "Rp" + amount.toLocaleString("id-ID"));

    res.json({
      success: true,
      snap_token: response.data.token,
      redirect_url: response.data.redirect_url,
    });
  } catch (error) {
    console.error("Error Midtrans Snap:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: "Gagal membuat transaksi Midtrans",
      details: error.response?.data || error.message,
    });
  }
});

// Webhook Midtrans (tetap sama)
app.post("/webhook/midtrans", (req, res) => {
  const { order_id, transaction_status } = req.body;
  if (transactions[order_id]) {
    if (["settlement", "capture"].includes(transaction_status)) {
      transactions[order_id].status = "paid";
      console.log(`LUNAS ${order_id}`);
    } else if (["deny", "cancel", "expire"].includes(transaction_status)) {
      transactions[order_id].status = "failed";
      console.log(`GAGAL ${order_id}`);
    }
  }
  res.status(200).json({ success: true });
});

// Cek status (opsional, tetap pakai /api kalau kamu pakai di tempat lain)
app.get("/api/check-status/:orderId", (req, res) => {
  const trx = transactions[req.params.orderId];
  if (!trx) return res.status(404).json({ success: false, error: "Not found" });
  res.json({ success: true, status: trx.status });
});

// Health check (bagus untuk Railway)
app.get("/", (req, res) => {
  res.send("Midtrans Backend Kasir – SIAP!");
});

app.listen(PORT, () => {
  console.log("\nMIDTRANS SNAP BACKEND SIAP!");
  console.log(`Mode: ${MIDTRANS_IS_PRODUCTION ? "PRODUCTION" : "SANDBOX"}`);
  console.log(`Server jalan di port: ${PORT}\n`);
});
