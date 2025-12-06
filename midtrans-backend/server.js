// server.js — VERSI PALING AMAN & MINIMAL (100% JALAN DI RAILWAY)

require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Pastikan environment ada
if (!process.env.MIDTRANS_SERVER_KEY) {
  console.error("MIDTRANS_SERVER_KEY tidak ada!");
  process.exit(1);
}

// Hanya 1 endpoint utama — TIDAK ADA YANG BISA RUSAK
app.post("/create-transaction", async (req, res) => {
  try {
    const { amount, orderId } = req.body;
    const auth = Buffer.from(process.env.MIDTRANS_SERVER_KEY + ":").toString("base64");

    const response = await axios.post("https://app.sandbox.midtrans.com/snap/v1/transactions", {
      transaction_details: { order_id: orderId, gross_amount: amount },
      item_details: [{ id: "a1", price: amount, quantity: 1, name: "Test" }],
      enabled_payments: ["qris", "gopay"]
    }, {
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }
    });

    res.json({ success: true, snap_token: response.data.token });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: "Gagal" });
  }
});

// Health check
app.get("/", (req, res) => res.send("Backend JALAN 100%"));

app.listen(PORT, () => {
  console.log(`Server hidup di port ${PORT}`);
});
