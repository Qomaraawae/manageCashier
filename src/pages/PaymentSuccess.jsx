// src/pages/PaymentSuccess.jsx
import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MdCheckCircle, MdAccessTime, MdError } from "react-icons/md";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const orderId = searchParams.get("order_id");
  const statusCode = searchParams.get("status_code");
  const transactionStatus = searchParams.get("transaction_status");

  // Auto redirect ke kasir setelah 6 detik
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/cashier", { replace: true });
    }, 6000);
    return () => clearTimeout(timer);
  }, [navigate]);

  const getStatusInfo = () => {
    if (statusCode === "200" && (transactionStatus === "settlement" || transactionStatus === "capture")) {
      return { title: "Pembayaran Berhasil!", desc: "Transaksi telah selesai.", color: "text-green-600", icon: <MdCheckCircle size={80} /> };
    }
    if (statusCode === "201" && transactionStatus === "pending") {
      return { title: "Menunggu Pembayaran", desc: "Silakan selesaikan pembayaran di aplikasi.", color: "text-yellow-600", icon: <MdAccessTime size={80} /> };
    }
    return { title: "Pembayaran Dibatalkan", desc: "Transaksi dibatalkan atau gagal.", color: "text-red-600", icon: <MdError size={80} /> };
  };

  const status = getStatusInfo();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center">
        <div className={`mx-auto mb-6 ${status.color}`}>
          {status.icon}
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          {status.title}
        </h1>
        <p className="text-lg text-gray-600 mb-6">
          {status.desc}
        </p>
        {orderId && (
          <div className="bg-gray-100 rounded-xl p-4 mb-8 font-mono text-sm">
            Order ID: <span className="font-bold text-indigo-600">{orderId}</span>
          </div>
        )}
        <p className="text-gray-500 mb-8">
          Anda akan diarahkan kembali ke kasir dalam beberapa detik...
        </p>
        <button
          onClick={() => navigate("/cashier", { replace: true })}
          className="w-full py-4 bg-indigo-600 text-white text-lg font-bold rounded-xl hover:bg-indigo-700 transition shadow-lg"
        >
          Kembali ke Kasir
        </button>
      </div>
    </div>
  );
}