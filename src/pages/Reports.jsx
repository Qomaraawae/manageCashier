import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { format } from 'date-fns';
import id from 'date-fns/locale/id';
import { 
  MdOutlineSearch, MdDownload, MdRefresh, MdDateRange, MdPictureAsPdf, 
  MdCheckCircle, MdError, MdClose, MdAccessTime, MdCancel 
} from 'react-icons/md';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

// === BADGE STATUS PEMBAYARAN ===
const PaymentStatusBadge = ({ paymentMethod, paymentStatus }) => {
  if (paymentMethod !== 'QRIS') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Tunai</span>;
  }

  const config = {
    paid:    { color: 'bg-green-100 text-green-800',  icon: <MdCheckCircle size={14} className="mr-1" />, label: 'Success' },
    pending: { color: 'bg-yellow-100 text-yellow-800',icon: <MdAccessTime size={14} className="mr-1" />, label: 'Pending' },
    failed:  { color: 'bg-red-100 text-red-800',      icon: <MdError size={14} className="mr-1" />,       label: 'Gagal' },
    cancel:  { color: 'bg-gray-100 text-gray-800',    icon: <MdCancel size={14} className="mr-1" />,      label: 'Cancel' },
    expire:  { color: 'bg-gray-100 text-gray-800',    icon: <MdCancel size={14} className="mr-1" />,      label: 'Kadaluarsa' },
  };

  const status = config[paymentStatus] || config.failed;
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>{status.icon}{status.label}</span>;
};

// === NOTIFIKASI ===
const Notification = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(), 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
        {type === 'success' ? <MdCheckCircle size={24} /> : <MdError size={24} />}
        <span className="font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 hover:bg-white/20 rounded-full p-1 transition-colors">
          <MdClose size={18} />
        </button>
      </div>
    </div>
  );
};

const formatRupiah = (value) => {
  if (isNaN(value)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};

const formatNumber = (value) => {
  if (isNaN(value)) return 0;
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(value);
};

// === GENERATE PDF (TETAP 100% SAMA DENGAN ASLI KAMU) ===
const generateReceiptPDF = (saleData, showNotification) => {
  try {
    const doc = new jsPDF({ format: 'a5' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 5;
    let y = margin;

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text('PT. NdugalRacing', margin, y);
    y += 5;
    doc.text('Jl. WLRO No. 72, Sorosutan', margin, y);
    y += 5;
    doc.text('NPWP 01.010.001.0-101.010', margin, y);
    y += 8;

    const store = "Point Stasiun Bojong Gede 082268255699";
    const addr = "Dagaran, Sorosutan, Yogyakarta 55162";
    doc.text(store, margin, y);
    y += 5;
    doc.text(addr, margin, y);
    y += 5;

    const saleId = saleData.id || format(saleData.timestamp instanceof Date ? saleData.timestamp : saleData.timestamp.toDate(), 'yyyyMMddHHmm');
    const time = format(saleData.timestamp instanceof Date ? saleData.timestamp : saleData.timestamp.toDate(), 'dd.MM.yy-HH:mm', { locale: id });
    doc.text(`${time}  2.0.35 ${saleId}/KASIR/01`, margin, y);
    y += 8;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    saleData.items.forEach((item) => {
      const line1 = `${item.name}`;
      const line2 = `${item.quantity} x ${formatRupiah(item.price)} = ${formatRupiah(item.price * item.quantity)}`;
      doc.text(line1, margin, y);
      doc.text(line2, pageWidth - margin - 5, y, { align: "right" });
      y += 5;
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;
    });

    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    const total = saleData.total;
    const cash = saleData.cashAmount || total;
    const change = saleData.change || 0;

    doc.text("TOTAL :", margin, y);
    doc.text(formatRupiah(total), pageWidth - margin - 5, y, { align: "right" });
    y += 5;
    doc.text(`${saleData.paymentMethod === "QRIS" ? "QRIS MIDTRANS" : "TUNAI"} :`, margin, y);
    doc.text(formatRupiah(cash), pageWidth - margin - 5, y, { align: "right" });
    y += 5;
    doc.text("KEMBALI :", margin, y);
    doc.text(formatRupiah(change), pageWidth - margin - 5, y, { align: "right" });
    y += 10;

    doc.text("TERIMA KASIH. SELAMAT BELANJA KEMBALI", margin, y);
    doc.save(`nota_${saleId}.pdf`);
    showNotification("Nota berhasil diunduh!", "success");
  } catch (err) {
    console.error(err);
    showNotification("Gagal membuat nota.", "error");
  }
};

function Reports() {
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type) => setNotification({ message, type });

  // === AMBIL DATA + STATUS MIDTRANS ===
  useEffect(() => {
    const ambilPenjualan = async () => {
      try {
        const salesSnap = await getDocs(query(collection(db, 'sales'), orderBy('timestamp', 'desc')));
        const transSnap = await getDocs(collection(db, 'transactions'));
        const midtransMap = {};
        transSnap.docs.forEach(doc => {
          const d = doc.data();
          if (d.orderId) midtransMap[d.orderId] = d.status || 'pending';
        });

        const data = salesSnap.docs.map(doc => {
          const d = doc.data();
          const orderId = d.saleId || doc.id;
          return {
            id: doc.id,
            customerName: d.customerName || 'Pembeli Langsung',
            timestamp: d.timestamp,
            items: d.items || [],
            total: d.total || 0,
            cashAmount: d.cashAmount || 0,
            change: d.change || 0,
            paymentMethod: d.paymentMethod || 'cash',
            paymentStatus: d.paymentMethod === 'QRIS' ? (midtransMap[orderId] || 'paid') : 'cash',
          };
        });

        setSales(data);
        setFilteredSales(data);

        const revenue = data.filter(s => s.paymentStatus === 'paid' || s.paymentStatus === 'cash').reduce((sum, s) => sum + s.total, 0);
        const items = data.reduce((sum, s) => sum + (Array.isArray(s.items) ? s.items.reduce((a, i) => a + (i.quantity || 0), 0) : 0), 0);
        setTotalRevenue(revenue);
        setTotalItems(items);
      } catch (err) {
        console.error(err);
        showNotification('Gagal memuat data', 'error');
      } finally {
        setLoading(false);
      }
    };
    ambilPenjualan();
  }, []);

  // === FILTER SEMUA ===
  useEffect(() => {
    let filtered = sales;

    // Filter Tanggal
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    filtered = filtered.filter(item => {
      const date = item.timestamp instanceof Date ? item.timestamp : item.timestamp.toDate();
      const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      switch (dateFilter) {
        case 'today': return itemDate.getTime() === today.getTime();
        case 'week': return date >= new Date(today.setDate(today.getDate() - 7));
        case 'month': return date >= new Date(today.setMonth(today.getMonth() - 1));
        default: return true;
      }
    });

    // Filter Status
    if (statusFilter !== 'all') {
      if (statusFilter === 'paid') filtered = filtered.filter(s => s.paymentStatus === 'paid' || s.paymentStatus === 'cash');
      else if (statusFilter === 'pending') filtered = filtered.filter(s => s.paymentStatus === 'pending');
      else if (statusFilter === 'cancel') filtered = filtered.filter(s => ['cancel', 'expire', 'failed'].includes(s.paymentStatus));
    }

    // Filter Metode
    if (methodFilter !== 'all') {
      filtered = filtered.filter(s => methodFilter === 'cash' ? s.paymentMethod !== 'QRIS' : s.paymentMethod === 'QRIS');
    }

    // Search
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredSales(filtered);
    const revenue = filtered.filter(s => s.paymentStatus === 'paid' || s.paymentStatus === 'cash').reduce((sum, s) => sum + s.total, 0);
    setTotalRevenue(revenue);
  }, [searchTerm, dateFilter, statusFilter, methodFilter, sales]);

  const resetFilter = () => {
    setSearchTerm('');
    setDateFilter('all');
    setStatusFilter('all');
    setMethodFilter('all');
    setShowResetConfirm(false);
  };

  const exportToExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();
      const reportHeader = [
        ['LAPORAN PENJUALAN'], [], 
        ['Tanggal Cetak', format(new Date(), 'dd MMMM yyyy, HH:mm', { locale: id })],
        ['Filter', dateFilter === 'all' ? 'Semua' : dateFilter === 'today' ? 'Hari Ini' : dateFilter === 'week' ? '7 Hari Terakhir' : '30 Hari Terakhir'],
        ['Total Transaksi', filteredSales.length],
        ['Total Pendapatan', `Rp ${formatNumber(totalRevenue)}`],
        [], [], 
      ];

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
          'Tanggal': format(sale.timestamp instanceof Date ? sale.timestamp : sale.timestamp.toDate(), 'dd/MM/yyyy', { locale: id }),
          'Waktu': format(sale.timestamp instanceof Date ? sale.timestamp : sale.timestamp.toDate(), 'HH:mm', { locale: id }),
          'Detail Item': itemsList,
          'Jumlah Item': totalItems,
          'Total': sale.total,
          'Tunai': sale.cashAmount || 0,
          'Kembalian': sale.change || 0,
        };
      });

      const worksheet = XLSX.utils.aoa_to_sheet(reportHeader);
      XLSX.utils.sheet_add_json(worksheet, excelData, { origin: `A${reportHeader.length + 1}`, skipHeader: false });

      worksheet['!cols'] = Array(11).fill({ wch: 15 });
      if (!worksheet['!merges']) worksheet['!merges'] = [];
      worksheet['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } });

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Penjualan');
      const today = format(new Date(), 'yyyy-MM-dd_HHmm');
      XLSX.writeFile(workbook, `Laporan_Penjualan_${today}.xlsx`);
      showNotification('Excel berhasil diunduh!', 'success');
    } catch (error) {
      showNotification('Gagal mengunduh Excel.', 'error');
    }
  };

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
      {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Laporan Penjualan</h1>
        <div className="flex flex-wrap gap-2 relative">
          <button onClick={exportToExcel} className="btn bg-primary-500 text-white hover:bg-primary-600 flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 hover:shadow-lg">
            <MdDownload size={20} />
            <span>Ekspor Excel</span>
          </button>
          <button onClick={() => setShowResetConfirm(true)} className="btn bg-secondary-500 text-white hover:bg-secondary-600 flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 hover:shadow-lg">
            <MdRefresh size={20} />
            <span>Reset</span>
          </button>

          {showResetConfirm && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowResetConfirm(false)}></div>
              <div className="absolute top-12 right-0 bg-white shadow-xl rounded-lg p-4 z-20 border border-gray-200 min-w-[250px]">
                <p className="text-sm text-gray-700 mb-4">Apakah Anda yakin ingin mereset semua filter?</p>
                <div className="flex justify-end space-x-2">
                  <button onClick={() => setShowResetConfirm(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors">Batal</button>
                  <button onClick={resetFilter} className="px-4 py-2 text-sm text-white bg-secondary-500 hover:bg-secondary-600 rounded-md transition-colors">Ya, Reset</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 3 KARTU RINGKASAN — SUDAH DIPINDAH KE ATAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-medium opacity-90">Total Pendapatan</h3>
          <p className="text-3xl font-bold mt-2">{formatRupiah(totalRevenue)}</p>
          <p className="text-xs opacity-75 mt-2">Dari {filteredSales.length} transaksi</p>
        </div>
        <div className="bg-gradient-to-br from-secondary-500 to-secondary-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-medium opacity-90">Total Transaksi</h3>
          <p className="text-3xl font-bold mt-2">{filteredSales.length}</p>
          <p className="text-xs opacity-75 mt-2">Penjualan berhasil</p>
        </div>
        <div className="bg-gradient-to-br from-accent-500 to-accent-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-medium opacity-90">Total Item Terjual</h3>
          <p className="text-3xl font-bold mt-2">{totalItems}</p>
          <p className="text-xs opacity-75 mt-2">Produk terjual</p>
        </div>
      </div>

      {/* FILTER PERIODE */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-2 mb-3">
          <MdDateRange className="text-gray-500" size={20} />
          <h3 className="text-sm font-medium text-gray-700">Filter Periode</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'today', 'week', 'month'].map(t => (
            <button key={t} onClick={() => setDateFilter(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${dateFilter === t ? 'bg-primary-500 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {t === 'all' ? 'Semua' : t === 'today' ? 'Hari Ini' : t === 'week' ? '7 Hari Terakhir' : '30 Hari Terakhir'}
            </button>
          ))}
        </div>
      </div>

      {/* FILTER STATUS & METODE */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Status Pembayaran</h3>
          <div className="flex flex-wrap gap-2">
            {['all', 'paid', 'pending', 'cancel'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === s ? 'bg-primary-500 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {s === 'all' ? 'Semua' : s === 'paid' ? 'Success' : s === 'pending' ? 'Pending' : 'Cancel'}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Metode Pembayaran</h3>
          <div className="flex flex-wrap gap-2">
            {['all', 'cash', 'QRIS'].map(m => (
              <button key={m} onClick={() => setMethodFilter(m)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${methodFilter === m ? 'bg-primary-500 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {m === 'all' ? 'Semua' : m === 'cash' ? 'Tunai' : 'QRIS'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TABEL */}
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
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">No</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID Transaksi</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Pelanggan</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tanggal & Waktu</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Item</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status Pembayaran</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <MdOutlineSearch size={48} className="mb-3" />
                      <p className="text-gray-500 font-medium">Tidak ada data penjualan</p>
                      <p className="text-sm text-gray-400 mt-1">
                        {searchTerm ? 'Coba ubah kata kunci pencarian' : 'Belum ada transaksi untuk filter ini'}
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono font-medium text-gray-900 bg-gray-100 px-2 py-1 rounded">#{sale.id.substring(0, 8)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{sale.customerName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {format(sale.timestamp instanceof Date ? sale.timestamp : sale.timestamp.toDate(), 'dd MMM yyyy', { locale: id })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(sale.timestamp instanceof Date ? sale.timestamp : sale.timestamp.toDate(), 'HH:mm', { locale: id })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {totalItems} item
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <PaymentStatusBadge paymentMethod={sale.paymentMethod} paymentStatus={sale.paymentStatus} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-semibold text-green-600">{formatRupiah(sale.total)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => generateReceiptPDF(sale, showNotification)}
                          className="inline-flex items-center px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 text-sm font-medium shadow-sm hover:shadow-md"
                        >
                          <MdPictureAsPdf size={16} className="mr-1" />
                          PDF
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

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

      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right { animation: slide-in-right 0.3s ease-out; }
      `}</style>
    </div>
  );
}

export default Reports;