// src/pages/PaymentCancel.jsx
import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { format } from 'date-fns';
import id from 'date-fns/locale/id';
import { MdCancel, MdRefresh } from 'react-icons/md';

const formatRupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

function PaymentCancel() {
  const [failedTransactions, setFailedTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFailed = async () => {
    try {
      const transSnap = await getDocs(
        query(collection(db, 'transactions'),
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
    }
  };

  useEffect(() => {
    fetchFailed();
  }, []);

  const getStatusLabel = (status) => {
    if (status === 'expire') return { label: 'Kadaluarsa', color: 'bg-gray-500' };
    if (status === 'cancel') return { label: 'Dibatalkan', color: 'bg-orange-500' };
    return { label: 'Gagal', color: 'bg-red-600' };
  };

  if (loading) return <div className="p-8 text-center">Memuat...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <MdCancel className="text-red-600" size={32} />
            Pembayaran QRIS Gagal / Dibatalkan
          </h1>
          <p className="text-gray-600 mt-1">Total: {failedTransactions.length} transaksi gagal</p>
        </div>
        <button onClick={fetchFailed} className="bg-gray-600 hover:bg-gray-700 text-white px-5 py-3 rounded-lg flex items-center gap-2">
          <MdRefresh /> Refresh
        </button>
      </div>

      {failedTransactions.length === 0 ? (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-12 text-center">
          <MdCancel size={64} className="mx-auto text-blue-600 mb-4" />
          <h3 className="text-xl font-semibold text-blue-800">Tidak ada pembayaran gagal</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {failedTransactions.map((trx) => {
            const statusInfo = getStatusLabel(trx.status);
            return (
              <div key={trx.id} className="bg-white border-l-4 border-red-500 rounded-r-xl p-6 shadow-md">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className={`${statusInfo.color} text-white text-xs px-3 py-1 rounded-full font-bold`}>
                        {statusInfo.label}
                      </span>
                      <code className="text-lg font-bold">#{trx.orderId}</code>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {format(trx.createdAt.toDate(), 'dd MMMM yyyy, HH:mm', { locale: id })}
                    </p>
                    <p className="font-medium mt-2">{trx.customerName}</p>
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
