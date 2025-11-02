// BillingStore.js
import { create } from 'zustand';
import { db } from '../firebase';
import {
  collection,
  getDocs,
  addDoc,
  Timestamp,
  query,
  where,
} from 'firebase/firestore';
import toast from 'react-hot-toast';

const useBillingStore = create((set, get) => ({
  products: [],
  cart: [],
  total: 0,
  search: '',
  paymentMethod: 'cash',

  fetchProducts: async () => {
    try {
      const snapshot = await getDocs(collection(db, 'products'));
      const products = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      set({ products });
    } catch (error) {
      console.error('Gagal mengambil produk:', error);
      toast.error('Gagal mengambil data produk.');
    }
  },

  setSearch: (value) => set({ search: value }),

  addToCart: (product) => {
    const { cart } = get();
    const existingProduct = cart.find((item) => item.id === product.id);

    let updatedCart;
    if (existingProduct) {
      updatedCart = cart.map((item) =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      updatedCart = [...cart, { ...product, quantity: 1 }];
    }

    set({
      cart: updatedCart,
      total: updatedCart.reduce(
        (acc, item) => acc + item.price * item.quantity,
        0
      ),
    });
  },

  removeFromCart: (id) => {
    const { cart } = get();
    const updatedCart = cart.filter((item) => item.id !== id);
    set({
      cart: updatedCart,
      total: updatedCart.reduce(
        (acc, item) => acc + item.price * item.quantity,
        0
      ),
    });
  },

  clearCart: () => set({ cart: [], total: 0 }),

  setPaymentMethod: (method) => set({ paymentMethod: method }),

  scanBarcode: (barcode) => {
    const { products, addToCart } = get();

    if (!products || products.length === 0) {
      toast.error('Data produk tidak tersedia. Silakan muat ulang halaman.');
      return;
    }

    const found = products.find((product) => product.barcode === barcode);

    if (found) {
      addToCart(found);
      toast.success(`Produk "${found.name}" ditambahkan`);
    } else {
      toast.error('Produk dengan barcode tersebut tidak ditemukan');
    }
  },

  checkout: async () => {
    const { cart, total, paymentMethod, clearCart } = get();

    if (cart.length === 0) {
      toast.error('Keranjang kosong');
      return;
    }

    try {
      const transaction = {
        items: cart,
        total,
        paymentMethod,
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'transactions'), transaction);

      toast.success('Transaksi berhasil');
      clearCart();
    } catch (error) {
      console.error('Checkout gagal:', error);
      toast.error('Terjadi kesalahan saat checkout');
    }
  },
}));

export default useBillingStore;
