import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  setDoc,
  query,
  where,
  getDoc,
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
  MdNavigateBefore,
  MdNavigateNext,
  MdFirstPage,
  MdLastPage,
} from "react-icons/md";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://managecashier-production.up.railway.app";

// NOTIFIKASI
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

    const store = "Point Kidul Lapangan Kae 082268255699";
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

// KOMPONEN PAGINATION
const Pagination = ({ currentPage, totalPages, itemsPerPage, totalItems, onPageChange, onItemsPerPageChange }) => {
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pageNumbers.push(i);
        pageNumbers.push("...");
        pageNumbers.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pageNumbers.push(1);
        pageNumbers.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pageNumbers.push(i);
      } else {
        pageNumbers.push(1);
        pageNumbers.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pageNumbers.push(i);
        pageNumbers.push("...");
        pageNumbers.push(totalPages);
      }
    }
    return pageNumbers;
  };

  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {start}–{end} dari <span className="font-medium text-gray-700">{totalItems}</span> produk
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 whitespace-nowrap">Tampilkan</span>
          <select
            value={itemsPerPage}
            onChange={(e) => { onItemsPerPageChange(Number(e.target.value)); onPageChange(1); }}
            className="border border-gray-300 rounded-md px-1.5 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[6, 9, 12, 15].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <MdFirstPage size={16} />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <MdNavigateBefore size={16} />
        </button>

        {getPageNumbers().map((page, index) =>
          page === "..." ? (
            <span key={`dots-${index}`} className="w-7 h-7 flex items-center justify-center text-xs text-gray-400">···</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium transition-colors ${currentPage === page
                ? "bg-blue-500 text-white"
                : "text-gray-600 hover:bg-gray-100"
                }`}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <MdNavigateBefore size={16} />
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <MdNavigateNext size={16} />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <MdLastPage size={16} />
        </button>
      </div>
    </div>
  );
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
  const [pendingSaleId, setPendingSaleId] = useState(null);

  // State untuk pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);

  const showNotification = (msg, type) => setNotification({ message: msg, type, id: Date.now() });

  // Load Midtrans Snap script
  useEffect(() => {
    const isProduction = import.meta.env.VITE_MIDTRANS_IS_PRODUCTION === 'true';
    const script = document.createElement("script");
    script.src = isProduction ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js";
    script.setAttribute("data-client-key", import.meta.env.VITE_MIDTRANS_CLIENT_KEY);
    script.async = true;
    document.body.appendChild(script);
    return () => document.body.contains(script) && document.body.removeChild(script);
  }, []);

  // Load products
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

  // MONITOR EXPIRED TRANSACTIONS (Setiap 1 menit)
  useEffect(() => {
    const checkExpiredTransactions = async () => {
      try {
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

        const expiredQuery = query(
          collection(db, "transactions"),
          where("status", "==", "pending"),
          where("createdAt", "<", fifteenMinsAgo)
        );

        const snapshot = await getDocs(expiredQuery);

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();

          // Update status menjadi expired
          await updateDoc(docSnap.ref, {
            status: "expired",
            expiredAt: new Date()
          });

          console.log(`✅ Transaction ${data.orderId} marked as expired`);

          // Optional: Kembalikan stok produk jika ada
          if (data.items && data.items.length > 0) {
            for (const item of data.items) {
              if (item.productId) {
                const productRef = doc(db, "products", item.productId);
                const productSnap = await getDoc(productRef);
                if (productSnap.exists()) {
                  const currentStock = productSnap.data().stock;
                  await updateDoc(productRef, {
                    stock: currentStock + item.quantity
                  });
                }
              }
            }
          }
        }

        if (snapshot.size > 0) {
          console.log(`✅ Updated ${snapshot.size} expired transactions`);
        }
      } catch (err) {
        console.error("Error checking expired transactions:", err);
      }
    };

    // Jalankan pengecekan setiap 1 menit
    const interval = setInterval(checkExpiredTransactions, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const categories = ["Semua", ...new Set(products.map((p) => p.category || "Lainnya"))];
  const filteredProducts = products.filter(
    (p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) && (selectedCategory === "Semua" || p.category === selectedCategory)
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

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

  const getChangeColor = () => {
    const total = calculateTotal();
    const cash = parseInt(cashAmount) || 0;
    const change = cash - total;

    if (change < 0) return "text-red-600 bg-red-50 border-red-200";
    if (change === 0) return "text-green-600 bg-green-50 border-green-200";
    return "text-sky-600 bg-sky-50 border-sky-200";
  };

  const getChangeStatusText = () => {
    const total = calculateTotal();
    const cash = parseInt(cashAmount) || 0;
    const change = cash - total;

    if (change < 0) return "Kekurangan";
    if (change === 0) return "Pas";
    return "Kembalian";
  };

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
        paymentStatus: "cash",
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
      console.error(err);
      showNotification("Gagal menyimpan transaksi", "error");
    }
  };

  // Fungsi untuk update status sale
  const updateSaleStatus = async (orderId, newStatus, saleDocId = null) => {
    try {
      let saleQuery;
      if (saleDocId) {
        saleQuery = await getDocs(query(collection(db, "sales"), where("__name__", "==", saleDocId)));
      } else {
        saleQuery = await getDocs(query(collection(db, "sales"), where("saleId", "==", orderId)));
      }

      if (!saleQuery.empty) {
        const saleDoc = saleQuery.docs[0];
        await updateDoc(doc(db, "sales", saleDoc.id), {
          paymentStatus: newStatus,
          ...(newStatus === "paid" && { cashAmount: calculateTotal(), change: 0 })
        });
        console.log(`✅ Sale status updated to ${newStatus} for ${orderId}`);
        return saleDoc.id;
      }
      return null;
    } catch (err) {
      console.error("Error updating sale status:", err);
      return null;
    }
  };

  const payWithMidtrans = async () => {
    if (cart.length === 0 || isProcessingPayment || !window.snap) return;
    setIsProcessingPayment(true);
    showNotification("Membuat transaksi...", "warning");

    const total = calculateTotal();
    const orderId = `INV-${Date.now()}`;
    setCurrentOrderId(orderId);

    // Hitung waktu expired (15 menit dari sekarang)
    const expireAt = new Date(Date.now() + 15 * 60 * 1000);

    // Data untuk sales (akan disimpan sebagai pending)
    const saleData = {
      customerName: customerName || "Pembeli QRIS",
      items: cart.map(i => ({ productId: i.id, name: i.name, price: i.price, quantity: i.quantity })),
      total: total,
      cashAmount: 0,
      change: 0,
      timestamp: new Date(),
      saleId: orderId,
      paymentMethod: "QRIS",
      paymentStatus: "pending",
      expireAt: expireAt, // TAMBAHKAN expireAt untuk TTL
    };

    try {
      // 1. SIMPAN KE SALES DULU dengan status pending
      const saleRef = await addDoc(collection(db, "sales"), saleData);
      const newSaleId = saleRef.id;
      setPendingSaleId(newSaleId);
      console.log(`✅ Sales pending saved: ${orderId} (${newSaleId}), expires at ${expireAt}`);

      // 2. Panggil backend untuk membuat transaksi Midtrans
      const res = await fetch(`${API_BASE_URL}/create-transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: total,
          orderId,
          customer: {
            name: customerName || "Pembeli",
            email: "customer@example.com",
            phone: "081234567890"
          }
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success || !data.snap_token) throw new Error(data.error);

      // 3. SIMPAN KE TRANSACTIONS dengan expireAt
      const transactionData = {
        orderId,
        total,
        status: "pending",
        createdAt: new Date(),
        expireAt: expireAt, // Pastikan ini terisi
        customerName: customerName || "Pembeli QRIS",
        items: cart.map(i => ({
          productId: i.id,
          name: i.name,
          quantity: i.quantity,
          price: i.price
        }))
      };

      console.log("Saving transaction with expireAt:", expireAt);
      await setDoc(doc(db, "transactions", orderId), transactionData);

      // 4. Buka popup Midtrans
      window.snap.pay(data.snap_token, {
        onSuccess: async () => {
          // Update status sale menjadi paid
          await updateSaleStatus(orderId, "paid", newSaleId);

          // Update stok produk
          for (const item of cart) {
            const p = products.find((x) => x.id === item.id);
            await updateDoc(doc(db, "products", item.id), { stock: p.stock - item.quantity });
          }

          // Update transaction status (hapus expireAt agar tidak expired)
          await updateDoc(doc(db, "transactions", orderId), {
            status: "paid",
            paidAt: new Date(),
            expireAt: null // Hapus expireAt karena sudah dibayar
          });

          // Refresh products
          const snap = await getDocs(collection(db, "products"));
          setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));

          // Generate nota
          const finalSaleData = { ...saleData, paymentStatus: "paid", cashAmount: total, change: 0 };
          generateReceiptPDF(finalSaleData, showNotification);

          setCart([]);
          setCustomerName("");
          setCashAmount("");
          setIsProcessingPayment(false);
          showNotification("Pembayaran berhasil!", "success");
        },
        onPending: () => {
          showNotification("Menunggu pembayaran", "warning");
          setIsProcessingPayment(false);
        },
        onError: async () => {
          showNotification("Pembayaran gagal", "error");
          await updateSaleStatus(orderId, "failed", newSaleId);
          await updateDoc(doc(db, "transactions", orderId), { status: "failed" });
          setIsProcessingPayment(false);
        },
        onClose: () => {
          showNotification("Popup ditutup", "warning");
          setIsProcessingPayment(false);
        },
      });
    } catch (err) {
      console.error("Error:", err);
      showNotification("Error: " + err.message, "error");
      if (pendingSaleId) {
        await updateSaleStatus(orderId, "failed", pendingSaleId);
      }
      setIsProcessingPayment(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 dark:from-gray-900 to-gray-100 dark:to-gray-800 p-3 md:p-5 transition-colors">
      {notification && <Notification message={notification.message} type={notification.type} id={notification.id} onClose={() => setNotification(null)} />}

      <div className="max-w-7xl mx-auto mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm dark:shadow-gray-700/30 border dark:border-gray-700 p-3 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-800 dark:text-white">Kasir</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Kelola transaksi</p>
            </div>
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <MdShoppingCart size={18} />
              <span className="text-sm font-medium">{cart.length} item</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mb-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm dark:shadow-gray-700/30 border dark:border-gray-700 p-3 transition-colors">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nama Pelanggan (opsional)</label>
          <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Masukkan nama" className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors" />
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Kolom Daftar Produk */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm dark:shadow-gray-700/30 border dark:border-gray-700 p-3 flex flex-col h-full min-h-[500px] md:min-h-[600px] transition-colors">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 sticky top-0 bg-white dark:bg-gray-800 py-1 z-10">Daftar Produk</h2>

          <div className="mb-3 relative">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari produk..." className="w-full pl-9 pr-9 py-2 text-sm border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors" />
            {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2"><MdClose size={16} className="text-gray-500 dark:text-gray-400" /></button>}
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5 sticky top-[72px] bg-white dark:bg-gray-800 py-1 z-10">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedCategory === cat ? "bg-blue-500 text-white dark:bg-blue-600" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>{cat}</button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[300px]">
            {loading ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">Memuat...</p>
            ) : currentProducts.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">Produk tidak ditemukan</p>
            ) : (
              currentProducts.map((p) => {
                const inCart = cart.find((i) => i.id === p.id);
                const sisa = p.stock - (inCart?.quantity || 0);
                return (
                  <div key={p.id} className="p-2.5 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 border dark:border-gray-600 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-12 h-12 flex-shrink-0 bg-white dark:bg-gray-600 rounded border dark:border-gray-500 overflow-hidden">
                        <img src={p.imageUrl || "https://res.cloudinary.com/ddxlfwarp/image/upload/v1733021162/default-product_ktvkol.png"} alt={p.name} className="w-full h-full object-cover" onError={(e) => { e.target.src = "https://res.cloudinary.com/ddxlfwarp/image/upload/v1733021162/default-product_ktvkol.png"; }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800 dark:text-white text-sm truncate">{p.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{p.category || "Lainnya"}</p>
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatRupiah(p.price)}</p>
                        <p className={`text-xs font-medium ${sisa === 0 ? "text-red-500 dark:text-red-400" : sisa < 5 ? "text-orange-500 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`}>Stok: {p.stock} {inCart && `(sisa: ${sisa})`}</p>
                      </div>
                      <button onClick={() => addToCart(p)} disabled={p.stock === 0} className={`w-9 h-9 rounded-lg font-bold text-lg transition-colors ${p.stock === 0 ? "bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500" : "bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 active:scale-95"}`}>{p.stock === 0 ? "×" : "+"}</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {!loading && filteredProducts.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              totalItems={filteredProducts.length}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          )}
        </div>

        {/* Kolom Keranjang */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm dark:shadow-gray-700/30 border dark:border-gray-700 p-3 flex flex-col h-full min-h-[500px] md:min-h-[600px] transition-colors">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 sticky top-0 bg-white dark:bg-gray-800 py-1 z-10">Keranjang</h2>

          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-16 text-gray-400 dark:text-gray-500">
              <MdShoppingCart size={48} className="mb-2 opacity-50" />
              <p className="text-sm">Keranjang kosong</p>
              <p className="text-xs mt-1 text-center">Klik (+) pada produk untuk menambahkan</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3 min-h-[200px]">
                {cart.map((item) => (
                  <div key={item.id} className="p-2.5 bg-gray-50 dark:bg-gray-700 rounded-lg border dark:border-gray-600 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 flex-shrink-0 bg-white dark:bg-gray-600 rounded border dark:border-gray-500 overflow-hidden">
                        <img src={item.imageUrl || "https://res.cloudinary.com/ddxlfwarp/image/upload/v1733021162/default-product_ktvkol.png"} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800 dark:text-white text-sm truncate">{item.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatRupiah(item.price)} × {item.quantity}</p>
                        <p className="text-sm font-bold text-green-600 dark:text-green-400">{formatRupiah(item.price * item.quantity)}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center bg-white dark:bg-gray-600 rounded border dark:border-gray-500">
                          <button onClick={() => decreaseQuantity(item.id)} className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-500"><MdRemove size={14} /></button>
                          <span className="w-7 text-center text-sm font-semibold text-gray-900 dark:text-white">{item.quantity}</span>
                          <button onClick={() => addToCart(products.find(p => p.id === item.id))} className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-500"><MdAdd size={14} /></button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="px-2 py-1 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-xs hover:bg-red-100 dark:hover:bg-red-900/50 flex items-center justify-center transition-colors"><MdDelete size={13} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="sticky bottom-0 bg-white dark:bg-gray-800 pt-3 border-t dark:border-gray-700 mt-auto transition-colors">
                <div className="bg-gradient-to-br from-gray-50 dark:from-gray-700 to-gray-100 dark:to-gray-800 rounded-lg p-3 border dark:border-gray-600 transition-colors">
                  <div className="flex items-center justify-between mb-3 pb-2.5 border-b dark:border-gray-600">
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Total</span>
                    <span className="text-xl font-bold text-gray-800 dark:text-white">{formatRupiah(calculateTotal())}</span>
                  </div>

                  <div className="mb-2.5">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Jumlah Tunai</label>
                    <input type="number" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="Masukkan jumlah" className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors" />
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    <button onClick={() => setCashAmount(calculateTotal())} className="px-2.5 py-1.5 bg-blue-500 dark:bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors">Pas</button>
                    {[10000, 20000, 50000, 100000].map((v) => (
                      <button key={v} onClick={() => setCashAmount(v)} className="px-2.5 py-1.5 bg-white dark:bg-gray-700 border dark:border-gray-600 text-gray-900 dark:text-white rounded text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">{formatRupiah(v).replace('Rp ', 'Rp')}</button>
                    ))}
                  </div>

                  {cashAmount && (
                    <div className={`mb-2.5 p-2.5 rounded-lg border transition-colors ${getChangeColor()}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${getChangeColor().split(' ')[0]}`}>
                          {getChangeStatusText()}
                        </span>
                        <span className={`text-base font-bold ${getChangeColor().split(' ')[0]}`}>
                          {formatRupiah((parseInt(cashAmount) || 0) - calculateTotal())}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={completeTransaction} disabled={isProcessingPayment || cart.length === 0} className="py-2.5 bg-blue-500 dark:bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition-colors">Tunai</button>
                    <button onClick={payWithMidtrans} disabled={isProcessingPayment || cart.length === 0} className={`py-2.5 rounded-lg text-sm font-semibold text-white active:scale-95 transition-colors ${isProcessingPayment ? "bg-gray-400 dark:bg-gray-600" : "bg-green-500 dark:bg-green-600 hover:bg-green-600 dark:hover:bg-green-700"} disabled:opacity-50`}>{isProcessingPayment ? "Proses..." : "QRIS"}</button>
                  </div>
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