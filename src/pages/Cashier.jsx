import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { format } from 'date-fns';
import id from 'date-fns/locale/id';
import jsPDF from 'jspdf';
import { MdSearch, MdClose } from 'react-icons/md';

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
const generateReceiptPDF = (saleData) => {
  const doc = new jsPDF({ format: 'a5' });
  const pageWidth = doc.internal.pageSize.getWidth(); // 148mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
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
  const storeName = 'Point Stasiun Bojong Gede'; // Bisa diambil dari settings
  const storeCode = '082268255699'; // Bisa diambil dari settings
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
};

function Cashier() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [cashAmount, setCashAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

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
        setError(null);
      } catch (err) {
        console.error('Gagal mengambil produk:', err);
        setError('Gagal memuat daftar produk.');
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
      setError(`Stok ${product.name} habis.`);
      return;
    }
    setCart((prevCart) => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        if (existingItem.quantity >= product.stock) {
          setError(`Stok ${product.name} tidak cukup.`);
          return prevCart;
        }
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
    setError(null);
  };

  // Hapus item dari keranjang
  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter(item => item.id !== productId));
  };

  // Kurangi kuantitas item di keranjang
  const decreaseQuantity = (productId) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find(item => item.id === productId);
      if (existingItem.quantity === 1) {
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
      setError('Keranjang kosong. Tambahkan produk terlebih dahulu.');
      return;
    }

    const total = calculateTotal();
    const cash = parseInt(cashAmount) || 0;

    if (cash < total) {
      setError('Nominal tunai tidak cukup untuk membayar total belanja.');
      return;
    }

    const change = cash - total;

    try {
      for (const item of cart) {
        const product = products.find(p => p.id === item.id);
        if (!product || product.stock < item.quantity) {
          setError(`Stok ${item.name} tidak cukup. Sisa stok: ${product?.stock || 0}.`);
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

      const saleRef = await addDoc(collection(db, 'sales'), saleData);
      saleData.saleId = saleRef.id;

      for (const item of cart) {
        const productRef = doc(db, 'products', item.id);
        const product = products.find(p => p.id === item.id);
        await updateDoc(productRef, {
          stock: product.stock - item.quantity,
        });
      }

      const snapshot = await getDocs(collection(db, 'products'));
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      generateReceiptPDF(saleData);

      setCart([]);
      setCustomerName('');
      setCashAmount('');
      setSuccessMessage('Transaksi berhasil disimpan dan nota telah diunduh!');
      setError(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Gagal menyimpan transaksi:', err);
      setError('Gagal menyimpan transaksi. Coba lagi.');
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Kasir</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {successMessage}
        </div>
      )}
      
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
            <p className="text-gray-500">Memuat produk...</p>
          ) : filteredProducts.length === 0 ? (
            <p className="text-gray-500">
              {searchQuery || selectedCategory !== 'Semua' ? 'Produk tidak ditemukan.' : 'Tidak ada produk ditemukan.'}
            </p>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="p-4 bg-white rounded-lg shadow flex justify-between items-center"
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
                      <p className="text-sm text-gray-500">Stok: {product.stock}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => addToCart(product)}
                    className="btn bg-primary-500 text-white hover:bg-primary-600"
                    disabled={product.stock === 0}
                    aria-label={`Tambah ${product.name} ke keranjang`}
                  >
                    Tambah
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
            <p className="text-gray-500">Keranjang kosong.</p>
          ) : (
            <div className="space-y-4">
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
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => decreaseQuantity(item.id)}
                      className="btn bg-gray-200 text-gray-700 hover:bg-gray-300"
                      aria-label={`Kurangi jumlah ${item.name}`}
                    >
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="btn bg-red-500 text-white hover:bg-red-600"
                      aria-label={`Hapus ${item.name} dari keranjang`}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-lg font-semibold text-gray-900">
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
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => setPresetAmount(calculateTotal())}
                    className="btn bg-blue-500 text-white hover:bg-blue-600 px-3 py-1 rounded"
                  >
                    Uang Pas ({formatRupiah(calculateTotal())})
                  </button>
                  <button
                    onClick={() => setPresetAmount(10000)}
                    className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1 rounded"
                  >
                    Rp 10.000
                  </button>
                  <button
                    onClick={() => setPresetAmount(15000)}
                    className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1 rounded"
                  >
                    Rp 15.000
                  </button>
                  <button
                    onClick={() => setPresetAmount(25000)}
                    className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1 rounded"
                  >
                    Rp 25.000
                  </button>
                  <button
                    onClick={() => setPresetAmount(50000)}
                    className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1 rounded"
                  >
                    Rp 50.000
                  </button>
                  <button
                    onClick={() => setPresetAmount(100000)}
                    className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1 rounded"
                  >
                    Rp 100.000
                  </button>
                </div>
                {cashAmount && (
                  <p className="mt-2 text-sm text-gray-700">
                    Kembalian: {formatRupiah((parseInt(cashAmount) || 0) - calculateTotal())}
                  </p>
                )}
                <button
                  onClick={completeTransaction}
                  className="mt-4 w-full btn bg-primary-500 text-white hover:bg-primary-600"
                  aria-label="Selesaikan transaksi"
                >
                  Selesaikan Transaksi
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Cashier;
