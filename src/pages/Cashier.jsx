// Cashier.jsx → TAMPILAN 100% KEMBALI KE VERSI ASLI ANDA
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { format } from "date-fns";
import id from "date-fns/locale/id";
import jsPDF from "jspdf";
import {
  MdSearch,
  MdClose,
  MdCheckCircle,
  MdError,
  MdWarning,
} from "react-icons/md";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// ==================== NOTIFIKASI (TETAP PERSIS) ====================
const Notification = ({ message, type, onClose, id }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  const getIcon = () => {
    switch (type) {
      case "success": return <MdCheckCircle size={26} className="text-white" />;
      case "error":   return <MdError size={26} className="text-white" />;
      case "warning": return <MdWarning size={26} className="text-white" />;
      default:        return <MdCheckCircle size={26} className="text-white" />;
    }
  };

  const color = type === "error" ? "bg-red-600" : type === "warning" ? "bg-yellow-500 text-gray-900" : "bg-green-600";

  return (
    <div className="fixed inset-x-0 top-4 sm:top-6 z-50 flex justify-center px-4 pointer-events-none">
      <div className={`pointer-events-auto w-full max-w-md rounded-2xl shadow-2xl ${color} text-white animate-slide-down-fade border border-white/20`}>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {getIcon()}
            <span className="font-semibold text-base sm:text-lg">{message}</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20">
            <MdClose size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== FORMAT RUPIAH & PDF (TETAP PERSIS) ====================
const formatRupiah = (value) => {
  if (isNaN(value)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
};

const generateReceiptPDF = (saleData, showNotification) => {
  try {
    const doc = new jsPDF({ format: "a5" });
    const w = doc.internal.pageSize.getWidth();
    const margin = 5;
    let y = margin;

    doc.setFont("courier", "normal");
    doc.setFontSize(8);

    doc.text("PT. NdugalRacing", margin, y);
    y += 5;
    doc.text("Jl. WLRO No. 72, Sorosutan", margin, y);
    y += 5;
    doc.text("NPWP 01.010.001.0-101.010", margin, y);
    y += 8;

    const store = "Point Stasiun Bojong Gede 082268255699";
    const addr = "Dagaran, Sorosutan, Yogyakarta 55162";
    doc.text(store, margin, y);
    y += 5;
    doc.text(addr, margin, y);
    y += 5;

    const saleId = saleData.saleId || format(saleData.timestamp, "yyyyMMddHHmm");
    const time = format(saleData.timestamp, "dd.MM.yy-HH:mm", { locale: id });
    doc.text(`${time}  2.0.35 ${saleId}/KASIR/01`, margin, y);
    y += 8;
    doc.line(margin, y, w - margin, y);
    y += 5;

    saleData.items.forEach((item) => {
      const line1 = `${item.name}`;
      const line2 = `${item.quantity} x ${formatRupiah(item.price)} = ${formatRupiah(item.price * item.quantity)}`;
      doc.text(line1, margin, y);
      doc.text(line2, w - margin - 5, y, { align: "right" });
      y += 5;
      doc.line(margin, y, w - margin, y);
      y += 5;
    });

    doc.line(margin, y, w - margin, y);
    y += 5;

    const total = saleData.total;
    const cash = saleData.cashAmount || total;
    const change = saleData.change || 0;

    doc.text("TOTAL :", margin, y);
    doc.text(formatRupiah(total), w - margin - 5, y, { align: "right" });
    y += 5;
    doc.text(`${saleData.paymentMethod === "QRIS" ? "QRIS MIDTRANS" : "TUNAI"} :`, margin, y);
    doc.text(formatRupiah(cash), w - margin - 5, y, { align: "right" });
    y += 5;
    doc.text("KEMBALI :", margin, y);
    doc.text(formatRupiah(change), w - margin - 5, y, { align: "right" });
    y += 10;

    doc.text("TERIMA KASIH. SELAMAT BELANJA KEMBALI", margin, y);
    doc.save(`nota_${saleId}.pdf`);
    showNotification("Nota berhasil diunduh!", "success");
  } catch (err) {
    console.error(err);
    showNotification("Gagal membuat nota.", "error");
  }
};

function Cashier() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [cashAmount, setCashAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // MIDTRANS STATES
  const [currentOrderId, setCurrentOrderId] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const showNotification = (msg, type) =>
    setNotification({ message: msg, type, id: Date.now() });

  // Load Midtrans Snap.js (sandbox/production otomatis)
  useEffect(() => {
    const isProduction = import.meta.env.VITE_MIDTRANS_IS_PRODUCTION === 'true';
    const script = document.createElement("script");
    script.src = isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    script.setAttribute("data-client-key", import.meta.env.VITE_MIDTRANS_CLIENT_KEY);
    script.async = true;
    document.body.appendChild(script);
    return () => document.body.contains(script) && document.body.removeChild(script);
  }, []);

  // Fetch products
  useEffect(() => {
    const fetch = async () => {
      try {
        const snap = await getDocs(collection(db, "products"));
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        showNotification("Gagal memuat produk.", "error");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const categories = ["Semua", ...new Set(products.map((p) => p.category || "Lainnya"))];
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (selectedCategory === "Semua" || p.category === selectedCategory)
  );

  const addToCart = (product) => {
    if (product.stock === 0) return showNotification(`Stok ${product.name} habis`, "warning");
    setCart((prev) => {
      const exist = prev.find((i) => i.id === product.id);
      if (exist && exist.quantity >= product.stock) return showNotification("Stok tidak cukup", "warning"), prev;
      showNotification(`${product.name} ditambahkan`, "success");
      return exist
        ? prev.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...prev, { ...product, quantity: 1 }];
    });
  };

  const decreaseQuantity = (id) =>
    setCart((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: i.quantity - 1 } : i)).filter((i) => i.quantity > 0)
    );

  const removeFromCart = (id) => {
    const item = cart.find((i) => i.id === id);
    setCart((prev) => prev.filter((i) => i.id !== id));
    if (item) showNotification(`${item.name} dihapus`, "success");
  };

  const calculateTotal = () => cart.reduce((s, i) => s + i.price * i.quantity, 0);

  // BAYAR TUNAI (TETAP PERSIS)
  const completeTransaction = async () => {
    if (cart.length === 0) return showNotification("Keranjang kosong", "warning");

    for (const item of cart) {
      const p = products.find((x) => x.id === item.id);
      if (p && p.stock < item.quantity) return showNotification(`Stok ${item.name} tidak cukup`, "error");
    }

    const total = calculateTotal();
    const cash = parseInt(cashAmount) || 0;
    if (cash < total) return showNotification("Uang tidak cukup", "warning");

    try {
      const saleData = {
        customerName: customerName || "Pembeli Langsung",
        items: cart.map((i) => ({
          productId: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
        })),
        total,
        cashAmount: cash,
        change: cash - total,
        timestamp: new Date(),
        paymentMethod: "cash",
      };
      const ref = await addDoc(collection(db, "sales"), saleData);
      saleData.saleId = ref.id;

      for (const item of cart) {
        const p = products.find((x) => x.id === item.id);
        await updateDoc(doc(db, "products", item.id), { stock: p.stock - item.quantity });
      }

      const snap = await getDocs(collection(db, "products"));
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

      generateReceiptPDF(saleData, showNotification);
      setCart([]);
      setCustomerName("");
      setCashAmount("");
      showNotification("Transaksi tunai berhasil!", "success");
    } catch (err) {
      showNotification("Gagal simpan transaksi", "error");
    }
  };

  // BAYAR QRIS MIDTRANS (SUDAH DIPERBAIKI → PAKAI SNAP TOKEN)
  const payWithMidtrans = async () => {
    if (cart.length === 0 || isProcessingPayment) return;
    setIsProcessingPayment(true);
    showNotification("Membuat transaksi QRIS...", "warning");

    const total = calculateTotal();
    const orderId = `INV-${Date.now()}`;
    setCurrentOrderId(orderId);

    try {
      const res = await fetch(`${API_BASE_URL}/create-transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: total,
          orderId,
          customer: { name: customerName || "Pembeli", email: "customer@example.com", phone: "081234567890" },
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Gagal membuat transaksi");

      // Simpan sementara di Firestore
      await setDoc(doc(db, "transactions", orderId), {
        orderId,
        total,
        status: "pending",
        createdAt: new Date(),
      });

      // Buka popup Snap
      window.snap.pay(data.snap_token, {
        onSuccess: () => finalizePayment("paid"),
        onPending: () => { showNotification("Menunggu pembayaran...", "warning"); setIsProcessingPayment(false); },
        onError: () => { showNotification("Pembayaran gagal!", "error"); setIsProcessingPayment(false); },
        onClose: () => { showNotification("Popup ditutup", "warning"); setIsProcessingPayment(false); },
      });

    } catch (err) {
      showNotification("Error: " + err.message, "error");
      setIsProcessingPayment(false);
    }
  };

  const finalizePayment = async (status) => {
    setIsProcessingPayment(false);
    if (status !== "paid") return showNotification("Pembayaran tidak berhasil", "error");

    try {
      for (const item of cart) {
        const p = products.find((x) => x.id === item.id);
        await updateDoc(doc(db, "products", item.id), { stock: p.stock - item.quantity });
      }
      setProducts((await getDocs(collection(db, "products"))).docs.map(d => ({ id: d.id, ...d.data() })));

      const saleData = {
        customerName: customerName || "QRIS Midtrans",
        items: cart.map(i => ({ productId: i.id, name: i.name, price: i.price, quantity: i.quantity })),
        total: calculateTotal(),
        cashAmount: calculateTotal(),
        change: 0,
        timestamp: new Date(),
        saleId: currentOrderId,
        paymentMethod: "QRIS",
      };
      await addDoc(collection(db, "sales"), saleData);
      generateReceiptPDF(saleData, showNotification);

      setCart([]); setCustomerName(""); setCashAmount("");
      showNotification("Pembayaran QRIS berhasil! Terima kasih", "success");
    } catch (err) {
      showNotification("Gagal menyimpan transaksi", "error");
    }
  };

  // RENDER — TAMPILAN 100% PERSIS SEPERTI ASLI ANDA
  return (
    <div className="animate-fade-in p-6">
      {notification && (
        <Notification message={notification.message} type={notification.type} id={notification.id} onClose={() => setNotification(null)} />
      )}

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Kasir</h1>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nama Pelanggan (opsional)
        </label>
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Masukkan nama pelanggan"
          className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* === KIRI: DAFTAR PRODUK === */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Daftar Produk</h2>
          <div className="mb-4 relative">
            <MdSearch className="absolute left-3 top-3 text-gray-500" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari produk..."
              className="w-full pl-10 pr-10 p-2 border rounded"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-3">
                <MdClose size={20} />
              </button>
            )}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${selectedCategory === cat ? "bg-blue-500 text-white" : "bg-gray-200"}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {loading ? (
              <p className="text-center text-gray-500 py-8">Memuat produk...</p>
            ) : filteredProducts.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Produk tidak ditemukan</p>
            ) : (
              filteredProducts.map((p) => {
                const inCart = cart.find((i) => i.id === p.id);
                const sisa = p.stock - (inCart?.quantity || 0);
                return (
                  <div key={p.id} className="p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100">
                    <div className="flex items-start gap-4">
                      <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={p.imageUrl || "https://res.cloudinary.com/ddxlfwarp/image/upload/v1733021162/default-product_ktvkol.png"}
                          alt={p.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.src = "https://res.cloudinary.com/ddxlfwarp/image/upload/v1733021162/default-product_ktvkol.png"; }}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 mb-1 truncate">{p.name}</h3>
                        <p className="text-xs text-gray-500 mb-2">{p.category || "Lainnya"}</p>
                        <p className="text-lg font-bold text-blue-600 mb-1">{formatRupiah(p.price)}</p>
                        <p className={`text-sm font-medium ${sisa === 0 ? "text-red-500" : sisa < 5 ? "text-orange-500" : "text-green-600"}`}>
                          Stok: {p.stock} {inCart && `(sisa: ${sisa})`}
                        </p>
                      </div>

                      <button
                        onClick={() => addToCart(p)}
                        disabled={p.stock === 0}
                        className={`flex-shrink-0 w-12 h-12 rounded-lg font-bold text-xl transition-all ${p.stock === 0 ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-sm"}`}
                      >
                        {p.stock === 0 ? "X" : "+"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* === KANAN: KERANJANG (TETAP PERSIS) === */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Keranjang</h2>
          {cart.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">Keranjang kosong</div>
          ) : (
            <>
              <div className="max-h-80 overflow-y-auto space-y-3 mb-6">
                {cart.map((item) => (
                  <div key={item.id} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                        <img src={item.imageUrl || "https://res.cloudinary.com/ddxlfwarp/image/upload/v1733021162/default-product_ktvkol.png"} alt={item.name} className="w-full h-full object-cover" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 mb-1 truncate">{item.name}</h3>
                        <p className="text-sm text-gray-600 mb-2">{formatRupiah(item.price)} × {item.quantity}</p>
                        <p className="text-lg font-bold text-green-600">{formatRupiah(item.price * item.quantity)}</p>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                          <button onClick={() => decreaseQuantity(item.id)} className="w-8 h-8 flex items-center justify-center bg-white rounded text-gray-700 hover:bg-gray-200 font-bold transition-colors">−</button>
                          <span className="w-10 text-center font-semibold text-gray-900">{item.quantity}</span>
                          <button onClick={() => addToCart(products.find(p => p.id === item.id))} className="w-8 h-8 flex items-center justify-center bg-white rounded text-gray-700 hover:bg-gray-200 font-bold transition-colors">+</button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">Hapus</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-gray-300">
                  <span className="text-gray-600 font-medium">Total Belanja</span>
                  <span className="text-3xl font-bold text-gray-900">{formatRupiah(calculateTotal())}</span>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Jumlah Tunai</label>
                  <input
                    type="number"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    placeholder="Masukkan jumlah uang"
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  />
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  <button onClick={() => setCashAmount(calculateTotal())} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm">Uang Pas</button>
                  {[10000, 20000, 50000, 100000].map((v) => (
                    <button key={v} onClick={() => setCashAmount(v)} className="px-4 py-2 bg-white border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors">{formatRupiah(v).replace('Rp ', 'Rp')}</button>
                  ))}
                </div>

                {cashAmount && (
                  <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-green-700 font-medium">Kembalian</span>
                      <span className="text-2xl font-bold text-green-600">
                        {formatRupiah((parseInt(cashAmount) || 0) - calculateTotal())}
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={completeTransaction}
                    disabled={isProcessingPayment || cart.length === 0}
                    className="py-4 bg-blue-600 text-white rounded-xl font-bold text-base hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md"
                  >
                    Bayar Tunai
                  </button>

                  <button
                    onClick={payWithMidtrans}
                    disabled={isProcessingPayment || cart.length === 0}
                    className={`py-4 rounded-xl font-bold text-base text-white transition-all active:scale-95 shadow-md ${isProcessingPayment ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"} disabled:opacity-50`}
                  >
                    {isProcessingPayment ? "Proses..." : "QRIS"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Cashier;