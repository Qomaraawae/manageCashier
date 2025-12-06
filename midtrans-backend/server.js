require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// ============= MIDTRANS CONFIG =============
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY; // wajib untuk Snap di frontend
const MIDTRANS_IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === "true";

const MIDTRANS_API_URL = MIDTRANS_IS_PRODUCTION
  ? "https://app.midtrans.com"
  : "https://app.sandbox.midtrans.com";

const PORT = process.env.PORT || 3001;

if (!MIDTRANS_SERVER_KEY || !MIDTRANS_CLIENT_KEY) {
  console.error(
    "MIDTRANS_SERVER_KEY atau MIDTRANS_CLIENT_KEY tidak ada di .env!"
  );
  process.exit(1);
}

// Simpan transaksi sementara di memory
const transactions = {};

// ============= ENDPOINT SNAP =============
// Buat transaksi → langsung dapat snap_token
app.post("/api/create-transaction", async (req, res) => {
  const { amount, orderId, customer } = req.body;
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
      finish: "https://storecashier.netlify.app/payment-success", // ganti sesuai frontend kamu
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

    // Simpan status awal
    transactions[orderId] = {
      status: "pending",
      amount,
      createdAt: new Date(),
    };

    console.log("Transaksi dibuat:", orderId, "Rp" + amount.toLocaleString());

    res.json({
      success: true,
      snap_token: response.data.token, // ini yang dipakai di frontend
      redirect_url: response.data.redirect_url, // optional, bisa langsung redirect
    });
  } catch (error) {
    console.error(
      "Error Midtrans Snap:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      error: "Gagal membuat transaksi",
    });
  }
});

// Webhook (tetap pakai ini biar status otomatis update)
app.post("/webhook/midtrans", (req, res) => {
  const { order_id, transaction_status, fraud_status } = req.body;

  if (transactions[order_id]) {
    if (
      transaction_status === "settlement" ||
      transaction_status === "capture"
    ) {
      transactions[order_id].status = "paid";
      console.log(`LUNAS ${order_id}`);
    } else if (["deny", "cancel", "expire"].includes(transaction_status)) {
      transactions[order_id].status = "failed";
      console.log(`GAGAL ${order_id}`);
    }
  }

  res.status(200).json({ success: true });
});

// Cek status (opsional)
app.get("/api/check-status/:orderId", (req, res) => {
  const trx = transactions[req.params.orderId];
  if (!trx) return res.status(404).json({ success: false, error: "Not found" });

  res.json({ success: true, status: trx.status });
});

app.listen(PORT, () => {
  console.log("\nMIDTRANS SNAP BACKEND SIAP!");
  console.log(`http://localhost:${PORT}`);
  console.log(`Mode: ${MIDTRANS_IS_PRODUCTION ? "PRODUCTION" : "SANDBOX"}\n`);
});
