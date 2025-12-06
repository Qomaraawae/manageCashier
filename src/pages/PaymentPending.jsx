// src/pages/PaymentPending.jsx
import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { format } from 'date-fns';
import id from 'date-fns/locale/id';
import { MdAccessTime, MdWhatsApp, MdCopyAll, MdRefresh } from 'react-icons/md';

const formatRupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

function PaymentPending() {
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPending = async () => {
    setRefreshing(true);
    try {
      const transSnap = await getDocs(query(collection(db, 'transactions'), where('status', '==', 'pending'), orderBy('createdAt', 'desc')));
      const salesSnap = await getDocs(collection(db, 'sales'));

      const salesMap = {};
      salesSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.saleId) salesMap[data.saleId] = data;
      });

      const data = transSnap.docs.map(doc => {
        const d = doc.data();
        const sale = salesMap[d.orderId] || {};
        return {
          id: doc.id,
          orderId: d.orderId,
          amount: d.total,
          customerName: sale.customerName || 'Pembeli QRIS',
          items: sale.items || [],
          createdAt: d.createdAt,
        };
      });

      setPendingTransactions(data);
    } catch (err) {
      console.error(err);
      alert('Gagal memuat data pending');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Order ID disalin!');
  };

  const openWA = (orderId, amount) => {
    const message = `Halo kak, transaksi QRIS kamu dengan ID *${orderId}* sebesar *${formatRupiah(amount)}* masih belum dibayar.\n\nMohon segera selesaikan pembayaran ya kak, terima kasih!\n\nScan ulang QRIS di kasir atau klik link pembayaran kembali.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        <p className="mt-4 text-gray-600">Memuat transaksi pending...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <MdAccessTime className="text-yellow-600" size={32} />
            Pembayaran QRIS Pending
          </h1>
          <p className="text-gray-600 mt-1">Total: {pendingTransactions.length} transaksi belum dibayar</p>
        </div>
        <button
          onClick={fetchPending}
          disabled={refreshing}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg flex items-center gap-2 shadow-lg transition-all"
        >
          <MdRefresh className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {pendingTransactions.length === 0 ? (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-12 text-center">
          <MdAccessTime size={64} className="mx-auto text-green-600 mb-4" />
          <h3 className="text-xl font-semibold text-green-800">Semua pembayaran sudah lunas!</h3>
          <p className="text-green-700 mt-2">Tidak ada transaksi QRIS yang pending saat ini.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {pendingTransactions.map((trx) => (
            <div key={trx.id} className="bg-white border-2 border-yellow-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full">PENDING</span>
                    <code className="text-lg font-bold text-gray-800">#{trx.orderId}</code>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {format(trx.createdAt.toDate(), 'dd MMMM yyyy, HH:mm', { locale: id })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-red-600">{formatRupiah(trx.amount)}</p>
                  <p className="text-sm text-gray-500">{trx.items.length} item</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-800">{trx.customerName}</p>
                    {trx.items.length > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        {trx.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(trx.orderId)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
                    >
                      <MdCopyAll /> Copy ID
                    </button>
                    <button
                      onClick={() => openWA(trx.orderId, trx.amount)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm shadow-md"
                    >
                      <MdWhatsApp size={20} /> Ingatkan WA
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PaymentPending;
