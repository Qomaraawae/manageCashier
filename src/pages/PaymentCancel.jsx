import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { format } from 'date-fns';
import id from 'date-fns/locale/id';
import { MdCancel, MdRefresh, MdErrorOutline } from 'react-icons/md';

const formatRupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

function PaymentCancel() {
  const [failedTransactions, setFailedTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFailed = useCallback(async () => {
    setRefreshing(true);
    try {
      const transSnap = await getDocs(
        query(
          collection(db, 'transactions'),
          where('status', 'in', ['failed', 'cancel', 'expire']),
          orderBy('createdAt', 'desc')
        )
      );

      const salesSnap = await getDocs(collection(db, 'sales'));
      const salesMap = {};
      salesSnap.docs.forEach(doc => {
        const d = doc.data();
        if (d.saleId) salesMap[d.saleId] = d;
      });

      const data = transSnap.docs.map(doc => {
        const d = doc.data();
        const sale = salesMap[d.orderId] || {};
        return {
          id: doc.id,
          orderId: d.orderId,
          amount: d.total,
          status: d.status,
          customerName: sale.customerName || 'Pembeli QRIS',
          items: sale.items || [],
          createdAt: d.createdAt,
        };
      });

      setFailedTransactions(data);
    } catch (err) {
      console.error(err);
      alert('Gagal memuat data gagal');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFailed();
  }, [fetchFailed]);

  const getStatusLabel = (status) => {
    const statusMap = {
      expire: { label: 'Kadaluarsa', color: 'bg-gray-500', icon: '🕐' },
      cancel: { label: 'Dibatalkan', color: 'bg-orange-500', icon: '❌' },
      failed: { label: 'Gagal', color: 'bg-red-600', icon: '⚠️' }
    };
    return statusMap[status] || statusMap.failed;
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        <p className="mt-4 text-gray-600">Memuat transaksi gagal...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <MdCancel className="text-red-600" size={32} />
            Pembayaran QRIS Gagal / Dibatalkan
          </h1>
          <p className="text-gray-600 mt-1">Total: {failedTransactions.length} transaksi gagal</p>
        </div>
        <button
          onClick={fetchFailed}
          disabled={refreshing}
          className="bg-gray-600 hover:bg-gray-700 text-white px-5 py-3 rounded-lg flex items-center gap-2 transition"
        >
          <MdRefresh className={refreshing ? 'animate-spin' : ''} size={20} />
          {refreshing ? 'Memuat...' : 'Refresh'}
        </button>
      </div>

      {failedTransactions.length === 0 ? (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-12 text-center">
          <MdErrorOutline size={64} className="mx-auto text-green-600 mb-4" />
          <h3 className="text-xl font-semibold text-green-800">Tidak ada pembayaran gagal</h3>
          <p className="text-green-700 mt-2">Semua transaksi berjalan dengan baik.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {failedTransactions.map((trx) => {
            const statusInfo = getStatusLabel(trx.status);
            return (
              <div key={trx.id} className="bg-white border-l-4 border-red-500 rounded-r-xl p-6 shadow-md hover:shadow-lg transition">
                <div className="flex justify-between items-start flex-wrap gap-4">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`${statusInfo.color} text-white text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1`}>
                        <span>{statusInfo.icon}</span> {statusInfo.label}
                      </span>
                      <code className="text-lg font-bold">#{trx.orderId}</code>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {trx.createdAt?.toDate ? format(trx.createdAt.toDate(), 'dd MMMM yyyy, HH:mm', { locale: id }) : 'Tanggal tidak tersedia'}
                    </p>
                    <p className="font-medium mt-2">{trx.customerName}</p>
                    {trx.items.length > 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        {trx.items.slice(0, 2).map(i => `${i.quantity}x ${i.name}`).join(', ')}
                        {trx.items.length > 2 && ` +${trx.items.length - 2} lainnya`}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-red-600">{formatRupiah(trx.amount)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PaymentCancel;