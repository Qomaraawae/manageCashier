import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { format } from 'date-fns';
import id from 'date-fns/locale/id';
import { MdOutlineSearch, MdDownload, MdRefresh, MdDateRange } from 'react-icons/md';
import * as XLSX from 'xlsx';

// Fungsi untuk memformat angka ke Rupiah
const formatRupiah = (value) => {
  if (isNaN(value)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
};

// Fungsi untuk format angka tanpa simbol Rp (untuk Excel)
const formatNumber = (value) => {
  if (isNaN(value)) return 0;
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
  }).format(value);
};

function Reports() {
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Ambil data penjualan dari Firestore
  useEffect(() => {
    const ambilPenjualan = async () => {
      try {
        const refPenjualan = collection(db, 'sales');
        const q = query(refPenjualan, orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);

        const dataPenjualan = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            customerName: data.customerName || 'Pembeli Langsung',
            timestamp: data.timestamp,
            items: data.items || [],
            total: data.total || 0,
            cashAmount: data.cashAmount || 0,
            change: data.change || 0,
          };
        });

        setSales(dataPenjualan);
        setFilteredSales(dataPenjualan);

        // Hitung total pendapatan dan jumlah item
        const pendapatan = dataPenjualan.reduce((sum, sale) => sum + sale.total, 0);
        const jumlahItem = dataPenjualan.reduce((sum, sale) => {
          return sum + (Array.isArray(sale.items) ? sale.items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) : 0);
        }, 0);

        setTotalRevenue(pendapatan);
        setTotalItems(jumlahItem);
      } catch (error) {
        console.error('Gagal mengambil data penjualan:', error);
      } finally {
        setLoading(false);
      }
    };

    ambilPenjualan();
  }, []);

  // Filter berdasarkan tanggal
  const filterByDate = (salesData, filterType) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return salesData.filter((sale) => {
      const saleDate = sale.timestamp instanceof Date ? sale.timestamp : sale.timestamp.toDate();
      
      switch (filterType) {
        case 'today':
          const saleDateOnly = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate());
          return saleDateOnly.getTime() === today.getTime();
        
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return saleDate >= weekAgo;
        
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return saleDate >= monthAgo;
        
        default:
          return true;
      }
    });
  };

  // Filter penjualan berdasarkan kata kunci pencarian dan tanggal
  useEffect(() => {
    let filtered = sales;

    // Filter berdasarkan tanggal
    filtered = filterByDate(filtered, dateFilter);

    // Filter berdasarkan pencarian
    if (searchTerm !== '') {
      filtered = filtered.filter((sale) =>
        sale.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredSales(filtered);

    // Update total revenue dan items berdasarkan filter
    const pendapatan = filtered.reduce((sum, sale) => sum + sale.total, 0);
    const jumlahItem = filtered.reduce((sum, sale) => {
      return sum + (Array.isArray(sale.items) ? sale.items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) : 0);
    }, 0);

    setTotalRevenue(pendapatan);
    setTotalItems(jumlahItem);
  }, [searchTerm, dateFilter, sales]);

  // Fungsi untuk reset filter
  const resetFilter = () => {
    setSearchTerm('');
    setDateFilter('all');
    setShowResetConfirm(false);
  };

  // Fungsi untuk ekspor ke Excel dengan format yang rapi
  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    
    // Header untuk laporan dengan format yang lebih baik
    const reportHeader = [
      ['LAPORAN PENJUALAN'],
      [],
      ['Tanggal Cetak', format(new Date(), 'dd MMMM yyyy, HH:mm', { locale: id })],
      ['Filter', dateFilter === 'all' ? 'Semua Data' : dateFilter === 'today' ? 'Hari Ini' : dateFilter === 'week' ? '7 Hari Terakhir' : '30 Hari Terakhir'],
      ['Total Transaksi', filteredSales.length],
      ['Total Pendapatan', `Rp ${formatNumber(totalRevenue)}`],
      [],
      [],
    ];

    // Data transaksi
    const excelData = filteredSales.map((sale, index) => {
      const itemsList = Array.isArray(sale.items) 
        ? sale.items.map(item => `${item.quantity}x ${item.name} @ Rp ${formatNumber(item.price)}`).join('; ')
        : '-';
      
      const totalItems = Array.isArray(sale.items)
        ? sale.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
        : 0;

      return {
        'No': index + 1,
        'ID Transaksi': sale.id,
        'Pelanggan': sale.customerName,
        'Tanggal': format(
          sale.timestamp instanceof Date ? sale.timestamp : sale.timestamp.toDate(),
          'dd/MM/yyyy',
          { locale: id }
        ),
        'Waktu': format(
          sale.timestamp instanceof Date ? sale.timestamp : sale.timestamp.toDate(),
          'HH:mm',
          { locale: id }
        ),
        'Detail Item': itemsList,
        'Jumlah Item': totalItems,
        'Total': sale.total,
        'Tunai': sale.cashAmount || 0,
        'Kembalian': sale.change || 0,
      };
    });

    // Buat worksheet dari header
    const worksheet = XLSX.utils.aoa_to_sheet(reportHeader);
    
    // Tambahkan data transaksi
    XLSX.utils.sheet_add_json(worksheet, excelData, { 
      origin: `A${reportHeader.length + 1}`,
      skipHeader: false 
    });

    // Hitung lebar kolom otomatis berdasarkan konten
    const getMaxWidth = (data, header) => {
      const headerRow = reportHeader.length + 1;
      let maxWidths = new Array(Object.keys(excelData[0] || {}).length).fill(10);
      
      // Cek header
      Object.keys(excelData[0] || {}).forEach((key, idx) => {
        maxWidths[idx] = Math.max(maxWidths[idx], key.length);
      });
      
      // Cek semua data
      excelData.forEach(row => {
        Object.values(row).forEach((val, idx) => {
          const length = String(val).length;
          maxWidths[idx] = Math.max(maxWidths[idx], length);
        });
      });
      
      // Tambahkan sedikit padding dan batasi maksimal
      return maxWidths.map(w => ({ wch: Math.min(Math.max(w + 2, 10), 60) }));
    };

    // Set lebar kolom dengan auto-fit
    worksheet['!cols'] = getMaxWidth(excelData, reportHeader);

    // Merge cells untuk judul
    if (!worksheet['!merges']) worksheet['!merges'] = [];
    worksheet['!merges'].push(
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } } // Merge judul
    );

    // Format styling untuk header
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    // Style untuk judul dan info header
    for (let R = 0; R <= 6; R++) {
      for (let C = 0; C <= 1; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!worksheet[cellAddress]) continue;
        
        if (R === 0) {
          // Judul bold dan besar
          worksheet[cellAddress].s = {
            font: { bold: true, sz: 16 },
            alignment: { horizontal: 'center', vertical: 'center' }
          };
        } else if (R >= 2 && R <= 5 && C === 0) {
          // Label (kolom A) bold
          worksheet[cellAddress].s = {
            font: { bold: true },
            alignment: { horizontal: 'left', vertical: 'center' }
          };
        }
      }
    }

    // Style untuk header tabel (bold dan background)
    const headerRowIndex = reportHeader.length;
    for (let C = 0; C <= 9; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: C });
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "F3F4F6" } },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }
    }

    // Format angka dengan pemisah ribuan untuk kolom Total, Tunai, Kembalian
    for (let R = headerRowIndex + 1; R <= range.e.r; R++) {
      // Total (kolom H)
      const totalCell = XLSX.utils.encode_cell({ r: R, c: 7 });
      if (worksheet[totalCell] && typeof worksheet[totalCell].v === 'number') {
        worksheet[totalCell].z = '#,##0';
      }
      
      // Tunai (kolom I)
      const tunaiCell = XLSX.utils.encode_cell({ r: R, c: 8 });
      if (worksheet[tunaiCell] && typeof worksheet[tunaiCell].v === 'number') {
        worksheet[tunaiCell].z = '#,##0';
      }
      
      // Kembalian (kolom J)
      const kembalianCell = XLSX.utils.encode_cell({ r: R, c: 9 });
      if (worksheet[kembalianCell] && typeof worksheet[kembalianCell].v === 'number') {
        worksheet[kembalianCell].z = '#,##0';
      }
    }

    // Set row height untuk judul
    if (!worksheet['!rows']) worksheet['!rows'] = [];
    worksheet['!rows'][0] = { hpt: 25 }; // Tinggi baris judul

    // Tambahkan worksheet ke workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Penjualan');

    // Generate nama file dengan tanggal
    const today = format(new Date(), 'yyyy-MM-dd_HHmm');
    const fileName = `Laporan_Penjualan_${today}.xlsx`;

    // Download file
    XLSX.writeFile(workbook, fileName);
  };

  // Tampilkan pesan loading saat data diambil
  if (loading) {
    return (
      <div className="animate-fade-in p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Laporan Penjualan</h1>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-500">Memuat data penjualan...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Laporan Penjualan</h1>
        <div className="flex flex-wrap gap-2 relative">
          <button
            onClick={exportToExcel}
            className="btn bg-primary-500 text-white hover:bg-primary-600 flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 hover:shadow-lg"
            aria-label="Ekspor laporan ke Excel"
          >
            <MdDownload size={20} />
            <span>Ekspor Excel</span>
          </button>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="btn bg-secondary-500 text-white hover:bg-secondary-600 flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 hover:shadow-lg"
            aria-label="Reset filter laporan"
          >
            <MdRefresh size={20} />
            <span>Reset</span>
          </button>

          {/* Popover Konfirmasi */}
          {showResetConfirm && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowResetConfirm(false)}
              ></div>
              <div className="absolute top-12 right-0 bg-white shadow-xl rounded-lg p-4 z-20 border border-gray-200 min-w-[250px]">
                <p className="text-sm text-gray-700 mb-4">Apakah Anda yakin ingin mereset semua filter?</p>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={resetFilter}
                    className="px-4 py-2 text-sm text-white bg-secondary-500 hover:bg-secondary-600 rounded-md transition-colors"
                  >
                    Ya, Reset
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Filter Tanggal */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-2 mb-3">
          <MdDateRange className="text-gray-500" size={20} />
          <h3 className="text-sm font-medium text-gray-700">Filter Periode</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setDateFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              dateFilter === 'all'
                ? 'bg-primary-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Semua Data
          </button>
          <button
            onClick={() => setDateFilter('today')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              dateFilter === 'today'
                ? 'bg-primary-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Hari Ini
          </button>
          <button
            onClick={() => setDateFilter('week')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              dateFilter === 'week'
                ? 'bg-primary-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            7 Hari Terakhir
          </button>
          <button
            onClick={() => setDateFilter('month')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              dateFilter === 'month'
                ? 'bg-primary-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            30 Hari Terakhir
          </button>
        </div>
      </div>

      {/* Kartu Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-medium opacity-90">Total Pendapatan</h3>
          <p className="text-3xl font-bold mt-2">
            {formatRupiah(totalRevenue)}
          </p>
          <p className="text-xs opacity-75 mt-2">Dari {filteredSales.length} transaksi</p>
        </div>
        <div className="bg-gradient-to-br from-secondary-500 to-secondary-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-medium opacity-90">Total Transaksi</h3>
          <p className="text-3xl font-bold mt-2">
            {filteredSales.length}
          </p>
          <p className="text-xs opacity-75 mt-2">Penjualan berhasil</p>
        </div>
        <div className="bg-gradient-to-br from-accent-500 to-accent-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-medium opacity-90">Total Item Terjual</h3>
          <p className="text-3xl font-bold mt-2">
            {totalItems}
          </p>
          <p className="text-xs opacity-75 mt-2">Produk terjual</p>
        </div>
      </div>

      {/* Tabel Penjualan */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MdOutlineSearch className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Cari berdasarkan nama pelanggan atau ID transaksi..."
              className="input pl-10 w-full bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent px-4 py-2"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Cari penjualan"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  No
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  ID Transaksi
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Pelanggan
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Tanggal & Waktu
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <MdOutlineSearch size={48} className="mb-3" />
                      <p className="text-gray-500 font-medium">Tidak ada data penjualan</p>
                      <p className="text-sm text-gray-400 mt-1">
                        {searchTerm ? 'Coba ubah kata kunci pencarian' : 'Belum ada transaksi untuk periode ini'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale, index) => {
                  const totalItems = Array.isArray(sale.items)
                    ? sale.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
                    : 0;

                  return (
                    <tr key={sale.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono font-medium text-gray-900 bg-gray-100 px-2 py-1 rounded">
                          #{sale.id.substring(0, 8)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{sale.customerName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {format(
                            sale.timestamp instanceof Date ? sale.timestamp : sale.timestamp.toDate(),
                            'dd MMM yyyy',
                            { locale: id }
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(
                            sale.timestamp instanceof Date ? sale.timestamp : sale.timestamp.toDate(),
                            'HH:mm',
                            { locale: id }
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {totalItems} item
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-semibold text-green-600">
                          {formatRupiah(sale.total)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer dengan total */}
        {filteredSales.length > 0 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Menampilkan <span className="font-semibold">{filteredSales.length}</span> transaksi
              </p>
              <p className="text-sm font-semibold text-gray-900">
                Total: <span className="text-green-600 text-lg">{formatRupiah(totalRevenue)}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Reports;