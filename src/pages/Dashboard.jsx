import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { 
  MdPointOfSale, 
  MdInventory, 
  MdShoppingBag, 
  MdInsights, 
  MdClose
} from 'react-icons/md';
import { format, startOfDay, endOfDay } from 'date-fns';
import id from 'date-fns/locale/id';

// Tambahkan CSS animasi khusus di head
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @keyframes bounceSlow {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-5px);
    }
  }

  .animate-fade-in {
    animation: fadeIn 0.2s ease-out;
  }

  .animate-scale-in {
    animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .animate-bounce-slow {
    animation: bounceSlow 2s ease-in-out infinite;
  }
`;
document.head.appendChild(style);

// Fungsi untuk memformat angka ke Rupiah
const formatRupiah = (value) => {
  if (isNaN(value)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
};

// Komponen untuk menangani error
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Kesalahan ditangkap oleh ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <p>Terjadi kesalahan:</p>
          <pre className="text-sm">{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalSales: 0,
    totalProducts: 0,
    lowStock: 0,
    dailySales: 0,
  });
  const [todaySales, setTodaySales] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCard, setActiveCard] = useState(null);
  const [showLowStockModal, setShowLowStockModal] = useState(false);

  // Ambil data untuk dasbor
  useEffect(() => {
    const ambilDataDasbor = async () => {
      try {
        // Ambil jumlah total produk
        const refProduk = collection(db, 'products');
        const snapshotProduk = await getDocs(refProduk);
        const jumlahProduk = snapshotProduk.size;

        // Hitung produk dengan stok rendah dan simpan datanya
        const produkStokRendah = snapshotProduk.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter((product) => {
            return product.stock <= (product.stockThreshold || 5);
          });

        const jumlahStokRendah = produkStokRendah.length;
        setLowStockProducts(produkStokRendah);

        // Ambil semua data penjualan untuk menghitung total penjualan
        const refPenjualanSemua = collection(db, 'sales');
        const snapshotPenjualanSemua = await getDocs(refPenjualanSemua);

        const semuaPenjualan = snapshotPenjualanSemua.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            customerName: data.customerName || 'Pembeli Langsung',
            items: Array.isArray(data.items) ? data.items : [],
            total: typeof data.total === 'number' ? data.total : 0,
            timestamp: data.timestamp,
          };
        });

        // Hitung total penjualan dari semua data
        const totalJumlahPenjualan = semuaPenjualan.reduce((sum, sale) => sum + sale.total, 0);

        // Dapatkan timestamp awal dan akhir hari ini
        const hariIni = new Date();
        const startToday = startOfDay(hariIni);
        const endToday = endOfDay(hariIni);

        // Query penjualan hari ini dengan filter timestamp
        const refPenjualanHariIni = collection(db, 'sales');
        const kueriPenjualanHariIni = query(
          refPenjualanHariIni,
          where('timestamp', '>=', startToday),
          where('timestamp', '<=', endToday),
          orderBy('timestamp', 'desc')
        );
        
        const snapshotPenjualanHariIni = await getDocs(kueriPenjualanHariIni);

        const penjualanHariIni = snapshotPenjualanHariIni.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            customerName: data.customerName || 'Pembeli Langsung',
            items: Array.isArray(data.items) ? data.items : [],
            total: typeof data.total === 'number' ? data.total : 0,
            timestamp: data.timestamp,
          };
        });

        // Hitung total penjualan hari ini
        const jumlahPenjualanHariIni = penjualanHariIni.reduce((sum, sale) => sum + sale.total, 0);

        setStats({
          totalSales: totalJumlahPenjualan,
          totalProducts: jumlahProduk,
          lowStock: jumlahStokRendah,
          dailySales: jumlahPenjualanHariIni,
        });

        setTodaySales(penjualanHariIni);
        setError(null);
      } catch (err) {
        console.error('Gagal mengambil data dasbor:', err);
        setError('Gagal memuat data dasbor');
      } finally {
        setLoading(false);
      }
    };

    ambilDataDasbor();
  }, []);

  const statCards = [
    {
      title: 'Total Penjualan',
      value: formatRupiah(stats.totalSales || 0),
      icon: <MdPointOfSale size={24} />,
      color: 'bg-blue-500',
      clickable: false,
      navigateTo: null,
    },
    {
      title: 'Total Produk',
      value: stats.totalProducts || 0,
      icon: <MdShoppingBag size={24} />,
      color: 'bg-teal-500',
      clickable: true,
      navigateTo: '/products',
    },
    {
      title: 'Stok Rendah',
      value: stats.lowStock || 0,
      icon: <MdInventory size={24} />,
      color: 'bg-orange-500',
      clickable: true,
      navigateTo: null,
      openModal: true,
    },
    {
      title: 'Penjualan Harian',
      value: formatRupiah(stats.dailySales || 0),
      icon: <MdInsights size={24} />,
      color: 'bg-gray-700',
      clickable: true,
      navigateTo: '/reports',
    },
  ];

  // Format timestamp ke format Indonesia
  const formatTimestamp = (timestamp) => {
    try {
      const date = timestamp?.toDate?.() || new Date(timestamp);
      return format(date, 'dd MMM yyyy, HH:mm', { locale: id });
    } catch (e) {
      console.error('Gagal memformat tanggal:', e);
      return 'T/A';
    }
  };

  // Render daftar item dalam penjualan
  const renderItems = (items) => {
    if (Array.isArray(items)) {
      if (items.length === 0) return '0';

      if (items[0]?.name) {
        return (
          <ul className="list-disc pl-5">
            {items.map((item, i) => (
              <li key={i}>
                {item.quantity}x {item.name} ({formatRupiah(item.price)})
              </li>
            ))}
          </ul>
        );
      }

      return items.length;
    }

    return typeof items === 'number' ? items : 0;
  };

  // Handler untuk klik card
  const handleCardClick = (index) => {
    const card = statCards[index];
    
    setActiveCard(index);
    
    if (card.openModal) {
      setTimeout(() => {
        setShowLowStockModal(true);
        setActiveCard(null);
      }, 150);
    } 
    else if (card.navigateTo) {
      setTimeout(() => {
        navigate(card.navigateTo);
        setActiveCard(null);
      }, 150);
    } 
    else {
      setTimeout(() => setActiveCard(null), 200);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Dasbor</h1>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Kartu Statistik - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {statCards.map((stat, index) => (
          <div
            key={index}
            onClick={() => handleCardClick(index)}
            className={`bg-white rounded-lg shadow overflow-hidden transition-all duration-300 ease-out ${
              stat.clickable ? 'cursor-pointer' : 'cursor-default'
            } ${
              activeCard === index ? 'scale-95 shadow-inner' : 'scale-100 hover:scale-105 hover:shadow-xl'
            } ${stat.clickable ? 'ring-2 ring-transparent hover:ring-blue-300 hover:ring-offset-2' : ''}`}
          >
            <div className="p-4 md:p-5">
              <div className="flex items-center">
                <div className={`rounded-lg p-3 ${stat.color} text-white mr-3 md:mr-4 flex-shrink-0`}>
                  {stat.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs md:text-sm font-medium text-gray-500 truncate mb-1">
                    {stat.title}
                  </p>
                  <p className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                    {stat.value}
                  </p>
                  {stat.clickable}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Produk Stok Rendah */}
      {showLowStockModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setShowLowStockModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden transform transition-all duration-300 ease-out animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b bg-gradient-to-r from-orange-50 to-white">
              <div className="flex items-center">
                <div className="rounded-md p-2 bg-orange-500 text-white mr-3 animate-bounce-slow">
                  <MdInventory size={24} />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-semibold text-gray-900">Produk Stok Rendah</h2>
                  <p className="text-xs md:text-sm text-gray-500">
                    {lowStockProducts.length} produk memerlukan restok
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLowStockModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform p-1"
                aria-label="Tutup modal"
              >
                <MdClose size={24} />
              </button>
            </div>

            {/* Konten Modal */}
            <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
              {lowStockProducts.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <MdInventory size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>Tidak ada produk dengan stok rendah</p>
                  <p className="text-sm mt-2">Semua produk memiliki stok yang cukup</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Gambar
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nama Produk
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Kategori
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stok
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Harga
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {lowStockProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50 transition-colors duration-150">
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-10 h-10 md:w-12 md:h-12 object-cover rounded transition-transform duration-200 hover:scale-110"
                              />
                            ) : (
                              <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                                T/A
                              </div>
                            )}
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 transition-all duration-200 hover:bg-blue-200">
                              {product.category || 'Lainnya'}
                            </span>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-semibold transition-all duration-200 ${
                              product.stock === 0 ? 'text-red-600 animate-pulse' : 'text-orange-600'
                            }`}>
                              {product.stock}
                            </span>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatRupiah(product.price)}
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${
                              product.stock === 0 
                                ? 'bg-red-100 text-red-800 hover:bg-red-200' 
                                : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                            }`}>
                              {product.stock === 0 ? 'Habis' : 'Stok Rendah'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3">
              <button
                onClick={() => setShowLowStockModal(false)}
                className="px-3 md:px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                Tutup
              </button>
              <Link
                to="/products"
                onClick={() => setShowLowStockModal(false)}
                className="px-3 md:px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-lg"
              >
                Kelola Produk
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Penjualan Hari Ini */}
      <ErrorBoundary>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 md:p-6 border-b flex items-center justify-between">
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-gray-900">Penjualan Hari Ini</h2>
              <p className="text-xs md:text-sm text-gray-500 mt-1">
                {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}
              </p>
            </div>
            <div className="bg-blue-50 px-3 py-1 rounded-full">
              <span className="text-sm font-semibold text-blue-600">
                {todaySales.length} Transaksi
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID Transaksi
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pelanggan
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Waktu
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-4 md:px-6 py-4 text-center text-gray-500 text-sm">
                      Memuat data penjualan...
                    </td>
                  </tr>
                ) : todaySales.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 md:px-6 py-8 text-center text-gray-500">
                      <MdPointOfSale size={48} className="mx-auto mb-4 text-gray-300" />
                      <p className="text-sm font-medium">Belum ada penjualan hari ini</p>
                      <p className="text-xs mt-1">Transaksi akan muncul di sini setelah ada penjualan</p>
                    </td>
                  </tr>
                ) : (
                  todaySales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-xs md:text-sm font-medium text-gray-900">
                        #{sale.id?.substring(0, 8) || 'T/A'}
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-xs md:text-sm text-gray-500">
                        {sale.customerName}
                      </td>
                      <td className="px-4 md:px-6 py-4 text-xs md:text-sm text-gray-500">
                        {renderItems(sale.items)}
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-xs md:text-sm font-medium text-green-600">
                        {formatRupiah(sale.total || 0)}
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-xs md:text-sm text-gray-500">
                        {formatTimestamp(sale.timestamp)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Total Hari Ini: <span className="font-bold text-green-600">{formatRupiah(stats.dailySales)}</span>
            </div>
            <Link
              to="/reports"
              className="text-blue-500 hover:text-blue-600 text-sm font-medium"
              aria-label="Lihat semua penjualan"
            >
              Lihat semua laporan →
            </Link>
          </div>
        </div>
      </ErrorBoundary>
    </div>
  );
}

export default Dashboard;
