require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

// ====================== CORS ======================
app.use(
  cors({
    origin: [
      "https://storecashier.netlify.app",
      "http://localhost:5173",
      "http://localhost:3001",
      "http://localhost:5174",
    ],
    credentials: true,
  })
);
app.options("*", cors()); // Handle preflight
app.use(express.json());

// ====================== MIDTRANS CONFIG ======================
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY;
const MIDTRANS_IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === "true";

const MIDTRANS_API_URL = MIDTRANS_IS_PRODUCTION
  ? "https://app.midtrans.com"
  : "https://app.sandbox.midtrans.com";

const PORT = process.env.PORT || 3001;

// Validasi key
if (!MIDTRANS_SERVER_KEY || !MIDTRANS_CLIENT_KEY) {
  console.error("Error: MIDTRANS_SERVER_KEY atau MIDTRANS_CLIENT_KEY tidak ada di environment!");
  process.exit(1);
}

// Simpan transaksi sementara (di memory)
const transactions = {};

// ====================== CREATE TRANSACTION (QRIS) ======================
app.post("/create-transaction", async (req, res) => {
  const { amount, orderId, customer } = req.body;

  if (!amount || !orderId) {
    return res.status(400).json({ success: false, error: "amount & orderId wajib diisi" });
  }

  const authString = Buffer.from(MIDTRANS_SERVER_KEY + ":").toString("base64");

  const payload = {
    transaction_details: {
      order_id: orderId,
      gross_amount: Number(amount),
    },
    customer_details: {
      first_name: customer?.name || "Customer",
      email: customer?.email || "customer@example.com",
      phone: customer?.phone || "081234567890",
    },
    item_details: [
      {
        id: "ITEM-001",
        price: Number(amount),
        quantity: 1,
        name: "Pembayaran Kasir",
      },
    ],
    enabled_payments: ["gopay", "shopeepay", "qris", "bank_transfer", "indomaret", "alfamart"],
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

    // Simpan status transaksi
    transactions[orderId] = {
      status: "pending",
      amount: Number(amount),
      createdAt: new Date(),
    };

    console.log(`Transaksi berhasil dibuat → ${orderId} | Rp${amount.toLocaleString("id-ID")}`);

    res.json({
      success: true,
      snap_token: response.data.token,
      redirect_url: response.data.redirect_url,
    });
  } catch (error) {
    console.error("Midtrans Error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: "Gagal membuat transaksi Midtrans",
    });
  }
});

// ====================== WEBHOOK MIDTRANS ======================
app.post("/webhook/midtrans", (req, res) => {
  const { order_id, transaction_status } = req.body;

  if (transactions[order_id]) {
    if (["settlement", "capture"].includes(transaction_status)) {
      transactions[order_id].status = "paid";
      console.log(`Pembayaran LUNAS → ${order_id}`);
    } else if (["deny", "cancel", "expire"].includes(transaction_status)) {
      transactions[order_id].status = "failed";
      console.log(`Pembayaran GAGAL → ${order_id}`);
    }
  }

  res.status(200).json({ success: true });
});

// ====================== CEK STATUS (opsional) ======================
// PASTIKAN TULISANNYA PERSIS: :orderId (bukan : atau :: atau spasi!)
app.get("/api/check-status/:orderId", (req, res) => {
  const { orderId } = req.params;
  const trx = transactions[orderId];

  if (!trx) {
    return res.status(404).json({ success: false, error: "Transaksi tidak ditemukan" });
  }

  res.json({ success: true, status: trx.status });
});

// ====================== HEALTH CHECK ======================
app.get("/", (req, res) => {
  res.send("Backend Kasir QRIS Midtrans — SIAP & JALAN 100%!");
});

// ====================== START SERVER ======================
app.listen(PORT, () => {
  console.log("========================================");
  console.log("   MIDTRANS SNAP BACKEND BERHASIL HIDUP");
  console.log(`   Port       : ${PORT}`);
  console.log(`   Mode       : ${MIDTRANS_IS_PRODUCTION ? "PRODUCTION" : "SANDBOX"}`);
  console.log(`   Endpoint   : /create-transaction`);
  console.log("========================================");
});
