import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { format } from 'date-fns';
import id from 'date-fns/locale/id';
import jsPDF from 'jspdf';
import { MdSearch, MdClose, MdCheckCircle, MdError, MdWarning } from 'react-icons/md';

// Komponen Notifikasi
const Notification = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <MdCheckCircle size={24} />;
      case 'error':
        return <MdError size={24} />;
      case 'warning':
        return <MdWarning size={24} />;
      default:
        return <MdCheckCircle size={24} />;
    }
  };

  const getColorClasses = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500 text-white';
      case 'error':
        return 'bg-red-500 text-white';
      case 'warning':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-blue-500 text-white';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${getColorClasses()}`}>
        {getIcon()}
        <span className="font-medium">{message}</span>
        <button
          onClick={onClose}
          className="ml-2 hover:bg-white/20 rounded-full p-1 transition-colors"
          aria-label="Tutup notifikasi"
        >
          <MdClose size={18} />
        </button>
      </div>
    </div>
  );
};

// Fungsi untuk memformat angka ke Rupiah
const formatRupiah = (value) => {
  if (isNaN(value)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
};

// Fungsi untuk membuat nota PDF seperti struk Indomaret
const generateReceiptPDF = (saleData, showNotification) => {
  try {
    const doc = new jsPDF({ format: 'a5' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 5;
    const lineHeight = 5;
    let y = margin;

    // Header
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text('PT. NdugalRacing', margin, y);
    y += lineHeight;
    doc.text('Jl. WLRO No. 72, Sorosutan', margin, y);
    y += lineHeight;
    doc.text('NPWP 01.010.001.0-101.010', margin, y);
    y += lineHeight;
    doc.text('[LOGO]', pageWidth - margin - 20, margin, { align: 'right' });
    y += lineHeight + 2;

    // Informasi Lokasi dan Transaksi
    const storeName = 'Point Stasiun Bojong Gede';
    const storeCode = '082268255699';
    const address = 'Dagaran, Sorosutan, Yogyakarta 55162';
    doc.text(`${storeName} ${storeCode}`, margin, y);
    y += lineHeight;
    doc.text(address, margin, y);
    y += lineHeight;
    const saleId = saleData.saleId || format(saleData.timestamp, 'yyyyMMddHHmm');
    const time = format(saleData.timestamp, 'dd.MM.yy-HH:mm', { locale: id });
    doc.text(`${time}  2.0.35 ${saleId}/KASIR/01`, margin, y);
    y += lineHeight + 2;

    doc.line(margin, y, pageWidth - margin, y);
    y += lineHeight;

    doc.setFontSize(8);
    saleData.items.forEach((item) => {
      const itemText = `${item.name}`;
      const priceText = `${item.quantity} x ${formatRupiah(item.price)} = ${formatRupiah(item.price * item.quantity)}`;
      doc.text(itemText, margin, y);
      doc.text(priceText, pageWidth - margin - 40, y, { align: 'right' });
      y += lineHeight;
      doc.line(margin, y, pageWidth - margin, y);
      y += lineHeight;
    });

    doc.line(margin, y, pageWidth - margin, y);
    y += lineHeight;

    const total = saleData.total;
    const cash = saleData.cashAmount;
    const change = saleData.change;
    const dpp = total / 1.11;
    const ppn = total - dpp;

    doc.text('HARGA JUAL :', margin, y);
    doc.text(formatRupiah(total), pageWidth - margin - 20, y, { align: 'right' });
    y += lineHeight;
    doc.text('TOTAL :', margin, y);
    doc.text(formatRupiah(total), pageWidth - margin - 20, y, { align: 'right' });
    y += lineHeight;
    doc.text('TUNAI :', margin, y);
    doc.text(formatRupiah(cash), pageWidth - margin - 20, y, { align: 'right' });
    y += lineHeight;
    doc.text('KEMBALI :', margin, y);
    doc.text(formatRupiah(change), pageWidth - margin - 20, y, { align: 'right' });
    y += lineHeight;
    doc.text('PPN : DPP=' + formatRupiah(dpp.toFixed(0)) + ' PPN=' + formatRupiah(ppn.toFixed(0)), margin, y);
    y += lineHeight + 2;

    doc.line(margin, y, pageWidth - margin, y);
    y += lineHeight;

    doc.text('TERIMA KASIH. SELAMAT BELANJA KEMBALI', margin, y);
    y += lineHeight;
    doc.text('===== LAYAMAN KONSUMEN MINIMARKET =====', margin, y);
    y += lineHeight;
    doc.text('SMS 0816 000 220 00  Call 150060', margin, y);
    y += lineHeight;
    doc.text('EMAIL: luthfikomara04@gmail.com', margin, y);

    doc.save(`nota_${saleId}.pdf`);
    showNotification('Nota PDF berhasil diunduh!', 'success');
  } catch (error) {
    console.error('Error generating PDF:', error);
    showNotification('Gagal membuat nota PDF. Silakan coba lagi.', 'error');
  }
};

function Cashier() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [cashAmount, setCashAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Fungsi untuk menampilkan notifikasi
  const showNotification = (message, type) => {
    setNotification({ message, type });
  };

  // Ambil daftar produk dari Firestore
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productsRef = collection(db, 'products');
        const snapshot = await getDocs(productsRef);
        const productsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProducts(productsData);
      } catch (err) {
        console.error('Gagal mengambil produk:', err);
        showNotification('Gagal memuat daftar produk.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Dapatkan daftar kategori unik dari produk
  const categories = ['Semua', ...new Set(products.map(p => p.category || 'Lainnya'))];

  // Filter produk berdasarkan pencarian dan kategori
  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Semua' || (product.category || 'Lainnya') === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Tambah produk ke keranjang
  const addToCart = (product) => {
    if (product.stock === 0) {
      showNotification(`Stok ${product.name} habis.`, 'warning');
      return;
    }
    setCart((prevCart) => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        if (existingItem.quantity >= product.stock) {
          showNotification(`Stok ${product.name} tidak cukup.`, 'warning');
          return prevCart;
        }
        showNotification(`${product.name} ditambahkan ke keranjang`, 'success');
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      showNotification(`${product.name} ditambahkan ke keranjang`, 'success');
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  // Hapus item dari keranjang
  const removeFromCart = (productId) => {
    const item = cart.find(i => i.id === productId);
    setCart((prevCart) => prevCart.filter(item => item.id !== productId));
    if (item) {
      showNotification(`${item.name} dihapus dari keranjang`, 'success');
    }
  };

  // Kurangi kuantitas item di keranjang
  const decreaseQuantity = (productId) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find(item => item.id === productId);
      if (existingItem.quantity === 1) {
        showNotification(`${existingItem.name} dihapus dari keranjang`, 'success');
        return prevCart.filter(item => item.id !== productId);
      }
      return prevCart.map(item =>
        item.id === productId
          ? { ...item, quantity: item.quantity - 1 }
          : item
      );
    });
  };

  // Hitung total harga
  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  // Handler untuk tombol nominal preset
  const setPresetAmount = (amount) => {
    setCashAmount(amount.toString());
  };

  // Selesaikan transaksi
  const completeTransaction = async () => {
    if (cart.length === 0) {
      showNotification('Keranjang kosong. Tambahkan produk terlebih dahulu.', 'warning');
      return;
    }

    const total = calculateTotal();
    const cash = parseInt(cashAmount) || 0;

    if (cash < total) {
      showNotification('Nominal tunai tidak cukup untuk membayar total belanja.', 'warning');
      return;
    }

    const change = cash - total;

    try {
      // Validasi stok
      for (const item of cart) {
        const product = products.find(p => p.id === item.id);
        if (!product || product.stock < item.quantity) {
          showNotification(`Stok ${item.name} tidak cukup. Sisa stok: ${product?.stock || 0}.`, 'error');
          return;
        }
      }

      const saleData = {
        customerName: customerName || 'Pembeli Langsung',
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        total: total,
        cashAmount: cash,
        change: change,
        timestamp: new Date(),
      };

      // Simpan transaksi
      const saleRef = await addDoc(collection(db, 'sales'), saleData);
      saleData.saleId = saleRef.id;

      // Update stok produk
      for (const item of cart) {
        const productRef = doc(db, 'products', item.id);
        const product = products.find(p => p.id === item.id);
        await updateDoc(productRef, {
          stock: product.stock - item.quantity,
        });
      }

      // Refresh daftar produk
      const snapshot = await getDocs(collection(db, 'products'));
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Generate PDF
      generateReceiptPDF(saleData, showNotification);

      // Reset form
      setCart([]);
      setCustomerName('');
      setCashAmount('');
      showNotification('Transaksi berhasil! Total: ' + formatRupiah(total), 'success');
      
    } catch (err) {
      console.error('Gagal menyimpan transaksi:', err);
      showNotification('Gagal menyimpan transaksi. Silakan coba lagi.', 'error');
    }
  };

  // Handler untuk input pencarian
  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  // Handler untuk menghapus pencarian
  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div className="animate-fade-in p-6">
      {/* Notifikasi */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
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
          aria-label="Nama pelanggan"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Daftar Produk</h2>
          
          {/* Input Pencarian */}
          <div className="mb-4 relative">
            <div className="flex items-center">
              <MdSearch className="absolute left-3 text-gray-500" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Cari produk..."
                className="w-full p-2 pl-10 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Cari produk"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 text-gray-500 hover:text-gray-700"
                  aria-label="Hapus pencarian"
                >
                  <MdClose size={20} />
                </button>
              )}
            </div>
          </div>

          {/* Filter Kategori */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter Kategori
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === category
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-500">Memuat produk...</p>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {searchQuery || selectedCategory !== 'Semua' ? 'Produk tidak ditemukan.' : 'Tidak ada produk tersedia.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="p-4 bg-white rounded-lg shadow flex justify-between items-center hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center space-x-4">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-10 h-10 object-cover rounded"
                      />
                    ) : (
                      <span className="w-10 h-10 flex items-center justify-center text-gray-500 bg-gray-100 rounded">
                        T/A
                      </span>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-xs text-blue-600 font-medium">{product.category || 'Lainnya'}</p>
                      <p className="text-sm text-gray-500">{formatRupiah(product.price)}</p>
                      <p className={`text-sm ${product.stock > 0 ? 'text-gray-500' : 'text-red-500 font-semibold'}`}>
                        Stok: {product.stock}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => addToCart(product)}
                    className={`btn ${
                      product.stock === 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-primary-500 text-white hover:bg-primary-600'
                    }`}
                    disabled={product.stock === 0}
                    aria-label={`Tambah ${product.name} ke keranjang`}
                  >
                    {product.stock === 0 ? 'Habis' : 'Tambah'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Keranjang */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Keranjang</h2>
          {cart.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Keranjang kosong.</p>
              <p className="text-sm text-gray-400 mt-1">Tambahkan produk untuk memulai transaksi</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-h-80 overflow-y-auto space-y-4">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-white rounded-lg shadow flex justify-between items-center"
                  >
                    <div className="flex items-center space-x-4">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-10 h-10 object-cover rounded"
                        />
                      ) : (
                        <span className="w-10 h-10 flex items-center justify-center text-gray-500 bg-gray-100 rounded">
                          T/A
                        </span>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-500">
                          {formatRupiah(item.price)} x {item.quantity}
                        </p>
                        <p className="text-sm font-semibold text-green-600">
                          {formatRupiah(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => decreaseQuantity(item.id)}
                        className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1 rounded"
                        aria-label={`Kurangi jumlah ${item.name}`}
                      >
                        -
                      </button>
                      <span className="font-semibold text-gray-900 min-w-[30px] text-center">{item.quantity}</span>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="btn bg-red-500 text-white hover:bg-red-600 px-3 py-1 rounded"
                        aria-label={`Hapus ${item.name} dari keranjang`}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                <p className="text-xl font-bold text-gray-900 mb-4">
                  Total: {formatRupiah(calculateTotal())}
                </p>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jumlah Tunai
                  </label>
                  <input
                    type="number"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    placeholder="Masukkan jumlah tunai"
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Jumlah tunai"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => setPresetAmount(calculateTotal())}
                    className="btn bg-blue-500 text-white hover:bg-blue-600 px-3 py-1.5 rounded text-sm font-medium"
                  >
                    Uang Pas
                  </button>
                  <button
                    onClick={() => setPresetAmount(10000)}
                    className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1.5 rounded text-sm"
                  >
                    10K
                  </button>
                  <button
                    onClick={() => setPresetAmount(15000)}
                    className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1.5 rounded text-sm"
                  >
                    15K
                  </button>
                  <button
                    onClick={() => setPresetAmount(25000)}
                    className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1.5 rounded text-sm"
                  >
                    25K
                  </button>
                  <button
                    onClick={() => setPresetAmount(50000)}
                    className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1.5 rounded text-sm"
                  >
                    50K
                  </button>
                  <button
                    onClick={() => setPresetAmount(100000)}
                    className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1.5 rounded text-sm"
                  >
                    100K
                  </button>
                </div>
                {cashAmount && (
                  <p className="mt-3 text-base font-semibold text-gray-700">
                    Kembalian: <span className="text-green-600">{formatRupiah((parseInt(cashAmount) || 0) - calculateTotal())}</span>
                  </p>
                )}
                <button
                  onClick={completeTransaction}
                  className="mt-4 w-full btn bg-primary-500 text-white hover:bg-primary-600 py-3 rounded-lg font-semibold text-lg shadow-md hover:shadow-lg transition-all"
                  aria-label="Selesaikan transaksi"
                >
                  Selesaikan Transaksi
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default Cashier;
