const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Xendit = require("xendit-node");

admin.initializeApp();

const xendit = new Xendit({
  secretKey: functions.config().xendit.secret_key, // Set: firebase functions:config:set xendit.secret_key="xnd_prod_xxx"
});

exports.createQRIS = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login dulu bro!");
  }
  const { amount, orderId } = data;
  const { QRCode } = xendit;
  const qrClient = new QRCode({});

  try {
    const response = await qrClient.createQRCode({
      externalID: orderId,
      type: "DYNAMIC",
      amount,
      callbackURL: `${functions.config().xendit.webhook_url}/xenditWebhook`, // e.g., https://your-netlify.app/api/webhook (nanti proxy via Netlify Functions kalau gak mau Firebase)
    });

    // Simpan transaction ke Firestore (collection baru: "transactions")
    await admin.firestore().collection("transactions").add({
      orderId,
      amount,
      status: "pending",
      xenditId: response.id,
      qrString: response.qr_string,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update order existing
    await admin.firestore().collection("orders").doc(orderId).update({ paymentMethod: "qris" });

    return { success: true, qrString: response.qr_string, xenditId: response.id };
  } catch (error) {
    console.error("Xendit error:", error);
    throw new functions.https.HttpsError("internal", "Gagal buat QRIS: " + error.message);
  }
});

exports.xenditWebhook = functions.https.onRequest(async (req, res) => {
  const token = req.headers["x-callback-token"];
  if (token !== functions.config().xendit.callback_token) { // Set: firebase functions:config:set xendit.callback_token="your_token"
    return res.status(401).json({ error: "Unauthorized" });
  }

  const event = req.body;
  if (event.event === "qris.payment.paid") {
    const { external_id: orderId, id: xenditId } = event.data;

    // Update transaction
    const transactionQuery = await admin.firestore().collection("transactions").where("xenditId", "==", xenditId).limit(1).get();
    if (!transactionQuery.empty) {
      await transactionQuery.docs[0].ref.update({
        status: "paid",
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Update order status
    await admin.firestore().collection("orders").doc(orderId).update({
      status: "paid",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  res.status(200).send("OK");
});