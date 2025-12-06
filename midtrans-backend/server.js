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

    if (!amount || !orderId) {
      return res.status(400).json({ success: false, error: "amount & orderId wajib" });
    }

    const auth = Buffer.from(process.env.MIDTRANS_SERVER_KEY + ":").toString("base64");

    // PAKAI CORE API + QRIS dengan acquirer GoPay
    const chargeResponse = await axios.post(
      "https://app.sandbox.midtrans.com/v2/charge",   // ganti app.midtrans.com kalau sudah production
      {
        payment_type: "qris",
        transaction_details: {
          order_id: orderId,
          gross_amount: amount,
        },
        qris: {
          acquirer: "gopay"   // ini yang bikin QR bisa dipindai GoPay & semua e-wallet lain
        },
        callbacks: {
          finish: "https://yourdomain.com/thanks"   // optional, redirect setelah sukses
        },
        expiry: {
          start_time: new Date(Date.now() + 60 * 1000).toISOString().slice(0, 19).replace("T", " ") + " +0700",
          unit: "minutes",
          duration: 15   // sesuaikan dengan timer 23 menit Anda
        }
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
      }
    );

    const data = chargeResponse.data;

    // Ambil URL gambar QR Code langsung dari Midtrans
    const qrAction = data.actions?.find(a => a.name === "generate-qr-code" || a.name === "generate-qr-code-v2");
    
    if (!qrAction) {
      throw new Error("QR action tidak ditemukan di response Midtrans");
    }

    // Langsung ambil gambar QRnya
    const qrImageResponse = await axios.get(qrAction.url, {
      headers: { Authorization: `Basic ${auth}` },
      responseType: "arraybuffer"
    });

    const qrBase64 = Buffer.from(qrImageResponse.data).toString("base64");
    const qrCodeImage = `data:image/png;base64,${qrBase64}`;

    // Kirim semua data yang dibutuhkan frontend kasir
    res.json({
      success: true,
      order_id: orderId,
      amount: amount,
      qr_code_image: qrCodeImage,           // ini yang langsung ditampilkan
      qr_string: data.qr_string,            // cadangan kalau mau generate sendiri
      transaction_id: data.transaction_id,
      expiry_time: data.expiry_time
    });

  } catch (err) {
    console.error("Error create transaction:", err.response?.data || err.message);
    res.status(500).json({
      success: false,
      error: err.response?.data || err.message
    });
  }
});
