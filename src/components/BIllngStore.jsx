// BillingStore.js (versi + QRIS)
import { create } from 'zustand';
import { db, functions } from '../firebase';
import {
  collection,
  addDoc,
  Timestamp,
  getDocs,
  doc,
  onSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';

const useBillingStore = create((set, get) => ({
  products: [],
  cart: [],
  total: 0,
  search: '',
  paymentMethod: 'cash',

  // === TAMBAHAN UNTUK QRIS ===
  isWaitingPayment: false,
  currentTransactionId: null,
  unsubscribeListener: null,

  fetchProducts: async () => { /* sama seperti sebelumnya */ },

  setSearch: (value) => set({ search: value }),

  addToCart: (product) => { /* sama */ },

  removeFromCart: (id) => { /* sama */ },

  clearCart: () => set({ cart: [], total: 0, isWaitingPayment: false }),

  setPaymentMethod: (method) => set({ paymentMethod: method }),

  // === FUNGSI BARU: Checkout dengan QRIS ===
  checkoutWithQRIS: async () => {
    const { cart, total, clearCart } = get();

    if (cart.length === 0) {
      toast.error('Keranjang kosong');
      return;
    }

    set({ isWaitingPayment: true });

    try {
      // 1. Buat order number
      const orderId = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-6)}`;

      // 2. Panggil Cloud Function buat QR
      const createQRIS = httpsCallable(functions, 'createQRIS');
      const result = await createQRIS({ amount: total, orderId });

      if (!result.data.success) throw new Error('Gagal buat QR');

      toast.loading('Menunggu pembayaran QRIS...', { id: 'qris' });

      // 3. Simpan transaksi sementara (status: pending)
      const tempTransaction = {
        orderId,
        items: cart,
        total,
        paymentMethod: 'qris',
        status: 'pending',
        xenditId: result.data.xenditId,
        createdAt: Timestamp.now(),
      };
      const docRef = await addDoc(collection(db, 'transactions'), tempTransaction);
      set({ currentTransactionId: docRef.id });

      // 4. Listener real-time sampai dibayar
      const unsub = onSnapshot(doc(db, 'transactions', docRef.id), (snap) => {
        const data = snap.data();
        if (data?.status === 'paid') {
          toast.success('Pembayaran QRIS berhasil!', { id: 'qris' });
          clearCart();
          set({ 
            isWaitingPayment: false, 
            currentTransactionId: null,
            unsubscribeListener: null 
          });
          // Print struk otomatis
          window.print();
        }
      });

      set({ unsubscribeListener: unsub });

    } catch (error) {
      console.error(error);
      toast.error('Gagal proses QRIS: ' + error.message);
      set({ isWaitingPayment: false });
    }
  },

  // === Checkout TUNAI (tetap seperti semula) ===
  checkout: async () => {
    const { cart, total, clearCart } = get();

    if (cart.length === 0) {
      toast.error('Keranjang kosong');
      return;
    }

    try {
      const transaction = {
        items: cart,
        total,
        paymentMethod: 'cash',
        status: 'paid',
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'transactions'), transaction);
      toast.success('Transaksi tunai berhasil');
      clearCart();
      window.print(); // print struk
    } catch (error) {
      toast.error('Checkout gagal');
    }
  },

  scanBarcode: (barcode) => { /* sama */ },
}));

export default useBillingStore;