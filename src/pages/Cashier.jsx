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
  MdShoppingCart,
  MdAdd,
  MdRemove,
  MdDelete,
} from "react-icons/md";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://managecashier-production.up.railway.app";

// ==================== NOTIFIKASI ====================
const Notification = ({ message, type, onClose, id }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  const getIcon = () => {
    switch (type) {
      case "success": return <MdCheckCircle size={20} />;
      case "error": return <MdError size={20} />;
      case "warning": return <MdWarning size={20} />;
      default: return <MdCheckCircle size={20} />;
    }
  };

  const color = type === "error" ? "bg-red-500" : type === "warning" ? "bg-amber-500" : "bg-green-500";

  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4 pointer-events-none">
      <div className={`pointer-events-auto max-w-sm rounded-lg shadow-lg ${color} text-white`}>
        <div className="flex items-center gap-2.5 p-3">
          {getIcon()}
          <span className="font-medium text-sm flex-1">{message}</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/20">
            <MdClose size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== FORMAT & PDF ====================
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
      doc.text(`${item.name}`, margin, y);
      doc.text(`${item.quantity} x ${formatRupiah(item.price)} = ${formatRupiah(item.price * item.quantity)}`, w - margin - 5, y, { align: "right" });
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
    doc.text(`${saleData.paymentMethod === "QRIS" ? "QRIS" : "TUNAI"} :`, margin, y);
    doc.text(formatRupiah(cash), w - margin - 5, y, { align: "right" });
    y += 5;
    doc.text("KEMBALI :", margin, y);
    doc.text(formatRupiah(change), w - margin - 5, y, { align: "right" });
    y += 10;

    doc.text("TERIMA KASIH", margin, y);
    doc.save(`nota_${saleId}.pdf`);
    showNotification("Nota berhasil diunduh!", "success");
  } catch (err) {
    console.error(err);
    showNotification("Gagal membuat nota", "error");
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
  const [currentOrderId, setCurrentOrderId] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const showNotification = (msg, type) => setNotification({ message: msg, type, id: Date.now() });

  useEffect(() => {
    const isProduction = import.meta.env.VITE_MIDTRANS_IS_PRODUCTION === 'true';
    const script = document.createElement("script");
    script.src = isProduction ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js";
    script.setAttribute("data-client-key", import.meta.env.VITE_MIDTRANS_CLIENT_KEY);
    script.async = true;
    document.body.appendChild(script);
    return () => document.body.contains(script) && document.body.removeChild(script);
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const snap = await getDocs(collection(db, "products"));
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        showNotification("Gagal memuat produk", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const categories = ["Semua", ...new Set(products.map((p) => p.category || "Lainnya"))];
  const filteredProducts = products.filter(
    (p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) && (selectedCategory === "Semua" || p.category === selectedCategory)
  );

  const addToCart = (product) => {
    if (product.stock === 0) return showNotification(`Stok ${product.name} habis`, "warning");
    setCart((prev) => {
      const exist = prev.find((i) => i.id === product.id);
      if (exist && exist.quantity >= product.stock) {
        showNotification("Stok tidak cukup", "warning");
        return prev;
      }
      showNotification(`${product.name} ditambahkan`, "success");
      return exist ? prev.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { ...product, quantity: 1 }];
    });
  };

  const decreaseQuantity = (id) => setCart((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: i.quantity - 1 } : i)).filter((i) => i.quantity > 0));

  const removeFromCart = (id) => {
    const item = cart.find((i) => i.id === id);
    setCart((prev) => prev.filter((i) => i.id !== id));
    if (item) showNotification(`${item.name} dihapus`, "success");
  };

  const calculateTotal = () => cart.reduce((s, i) => s + i.price * i.quantity, 0);

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
        customerName: customerName || "Pembeli",
        items: cart.map((i) => ({ productId: i.id, name: i.name, price: i.price, quantity: i.quantity })),
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
      showNotification("Transaksi berhasil!", "success");
    } catch (err) {
      showNotification("Gagal menyimpan transaksi", "error");
    }
  };

  const payWithMidtrans = async () => {
    if (cart.length === 0 || isProcessingPayment || !window.snap) return;
    setIsProcessingPayment(true);
    showNotification("Membuat transaksi...", "warning");

    const total = calculateTotal();
    const orderId = `INV-${Date.now()}`;
    setCurrentOrderId(orderId);

    try {
      const res = await fetch(`${API_BASE_URL}/create-transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: total, orderId, customer: { name: customerName || "Pembeli", email: "customer@example.com", phone: "081234567890" } }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success || !data.snap_token) throw new Error(data.error);

      await setDoc(doc(db, "transactions", orderId), { orderId, total, status: "pending", createdAt: new Date() });

      window.snap.pay(data.snap_token, {
        onSuccess: () => finalizePayment("paid", orderId),
        onPending: () => { showNotification("Menunggu pembayaran", "warning"); setIsProcessingPayment(false); },
        onError: () => { showNotification("Pembayaran gagal", "error"); setIsProcessingPayment(false); },
        onClose: () => { showNotification("Popup ditutup", "warning"); setIsProcessingPayment(false); },
      });
    } catch (err) {
      showNotification("Error: " + err.message, "error");
      setIsProcessingPayment(false);
    }
  };

  const finalizePayment = async (status, orderId) => {
    setIsProcessingPayment(false);
    if (status !== "paid") return showNotification("Pembayaran gagal", "error");

    try {
      for (const item of cart) {
        const p = products.find((x) => x.id === item.id);
        await updateDoc(doc(db, "products", item.id), { stock: p.stock - item.quantity });
      }
      const snap = await getDocs(collection(db, "products"));
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));

      const saleData = {
        customerName: customerName || "QRIS",
        items: cart.map(i => ({ productId: i.id, name: i.name, price: i.price, quantity: i.quantity })),
        total: calculateTotal(),
        cashAmount: calculateTotal(),
        change: 0,
        timestamp: new Date(),
        saleId: orderId,
        paymentMethod: "QRIS",
      };
      await addDoc(collection(db, "sales"), saleData);
      await updateDoc(doc(db, "transactions", orderId), { status: "paid", paidAt: new Date() });
      generateReceiptPDF(saleData, showNotification);

      setCart([]);
      setCustomerName("");
      setCashAmount("");
      showNotification("Pembayaran berhasil!", "success");
    } catch (err) {
      showNotification("Gagal menyimpan transaksi", "error");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 md:p-5">
      {notification && <Notification message={notification.message} type={notification.type} id={notification.id} onClose={() => setNotification(null)} />}

      <div className="max-w-7xl mx-auto mb-4">
        <div className="bg-white rounded-lg shadow-sm border p-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-800">Kasir</h1>
              <p className="text-xs text-gray-500">Kelola transaksi</p>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <MdShoppingCart size={18} />
              <span className="text-sm font-medium">{cart.length} item</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mb-3">
        <div className="bg-white rounded-lg shadow-sm border p-3">
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Nama Pelanggan (opsional)</label>
          <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Masukkan nama" className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-lg shadow-sm border p-3">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Daftar Produk</h2>
          
          <div className="mb-3 relative">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari produk..." className="w-full pl-9 pr-9 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2"><MdClose size={16} /></button>}
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${selectedCategory === cat ? "bg-blue-500 text-white" : "bg-gray-100 hover:bg-gray-200"}`}>{cat}</button>
            ))}
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {loading ? (
              <p className="text-center text-gray-500 py-8 text-sm">Memuat...</p>
            ) : filteredProducts.length === 0 ? (
              <p className="text-center text-gray-500 py-8 text-sm">Produk tidak ditemukan</p>
            ) : (
              filteredProducts.map((p) => {
                const inCart = cart.find((i) => i.id === p.id);
                const sisa = p.stock - (inCart?.quantity || 0);
                return (
                  <div key={p.id} className="p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 border">
                    <div className="flex items-center gap-2.5">
                      <div className="w-12 h-12 flex-shrink-0 bg-white rounded border overflow-hidden">
                        <img src={p.imageUrl || "https://res.cloudinary.com/ddxlfwarp/image/upload/v1733021162/default-product_ktvkol.png"} alt={p.name} className="w-full h-full object-cover" onError={(e) => { e.target.src = "https://res.cloudinary.com/ddxlfwarp/image/upload/v1733021162/default-product_ktvkol.png"; }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800 text-sm truncate">{p.name}</h3>
                        <p className="text-xs text-gray-500">{p.category || "Lainnya"}</p>
                        <p className="text-sm font-bold text-blue-600">{formatRupiah(p.price)}</p>
                        <p className={`text-xs font-medium ${sisa === 0 ? "text-red-500" : sisa < 5 ? "text-orange-500" : "text-green-600"}`}>Stok: {p.stock} {inCart && `(sisa: ${sisa})`}</p>
                      </div>
                      <button onClick={() => addToCart(p)} disabled={p.stock === 0} className={`w-9 h-9 rounded-lg font-bold text-lg ${p.stock === 0 ? "bg-gray-200 text-gray-400" : "bg-blue-500 text-white hover:bg-blue-600 active:scale-95"}`}>{p.stock === 0 ? "×" : "+"}</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-3">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Keranjang</h2>
          
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <MdShoppingCart size={40} className="mb-2 opacity-50" />
              <p className="text-sm">Keranjang kosong</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 mb-3">
                {cart.map((item) => (
                  <div key={item.id} className="p-2.5 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 flex-shrink-0 bg-white rounded border overflow-hidden">
                        <img src={item.imageUrl || "https://res.cloudinary.com/ddxlfwarp/image/upload/v1733021162/default-product_ktvkol.png"} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800 text-sm truncate">{item.name}</h3>
                        <p className="text-xs text-gray-500">{formatRupiah(item.price)} × {item.quantity}</p>
                        <p className="text-sm font-bold text-green-600">{formatRupiah(item.price * item.quantity)}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center bg-white rounded border">
                          <button onClick={() => decreaseQuantity(item.id)} className="w-6 h-6 flex items-center justify-center hover:bg-gray-100"><MdRemove size={14} /></button>
                          <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                          <button onClick={() => addToCart(products.find(p => p.id === item.id))} className="w-6 h-6 flex items-center justify-center hover:bg-gray-100"><MdAdd size={14} /></button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100 flex items-center justify-center"><MdDelete size={13} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3 border">
                <div className="flex items-center justify-between mb-3 pb-2.5 border-b">
                  <span className="text-sm text-gray-600 font-medium">Total</span>
                  <span className="text-xl font-bold text-gray-800">{formatRupiah(calculateTotal())}</span>
                </div>

                <div className="mb-2.5">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Jumlah Tunai</label>
                  <input type="number" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="Masukkan jumlah" className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  <button onClick={() => setCashAmount(calculateTotal())} className="px-2.5 py-1.5 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600">Pas</button>
                  {[10000, 20000, 50000, 100000].map((v) => (
                    <button key={v} onClick={() => setCashAmount(v)} className="px-2.5 py-1.5 bg-white border rounded text-xs font-medium hover:bg-gray-50">{formatRupiah(v).replace('Rp ', 'Rp')}</button>
                  ))}
                </div>

                {cashAmount && (
                  <div className="mb-2.5 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-green-700 font-medium">Kembalian</span>
                      <span className="text-base font-bold text-green-600">{formatRupiah((parseInt(cashAmount) || 0) - calculateTotal())}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={completeTransaction} disabled={isProcessingPayment || cart.length === 0} className="py-2.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 active:scale-95">Tunai</button>
                  <button onClick={payWithMidtrans} disabled={isProcessingPayment || cart.length === 0} className={`py-2.5 rounded-lg text-sm font-semibold text-white active:scale-95 ${isProcessingPayment ? "bg-gray-400" : "bg-green-500 hover:bg-green-600"} disabled:opacity-50`}>{isProcessingPayment ? "Proses..." : "QRIS"}</button>
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