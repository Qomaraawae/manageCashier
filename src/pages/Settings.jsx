import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';

function Settings() {
  const [storeName, setStoreName] = useState('Toko Sembako Jaya');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Ambil pengaturan dari Firestore
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const user = auth.currentUser;
        if (!user) throw new Error('Login diperlukan.');

        const settingsRef = doc(db, 'settings', user.uid);
        const snap = await getDoc(settingsRef);

        if (snap.exists() && snap.data().storeName) {
          setStoreName(snap.data().storeName);
        }
        setError(null);
      } catch (err) {
        console.error('Gagal memuat pengaturan:', err);
        setError('Gagal memuat pengaturan.');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Simpan pengaturan
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!storeName.trim()) {
      setError('Nama toko tidak boleh kosong.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Login diperlukan.');

      const settingsRef = doc(db, 'settings', user.uid);
      await setDoc(settingsRef, { storeName: storeName.trim() }, { merge: true });

      setSuccessMessage('Pengaturan berhasil disimpan!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Gagal menyimpan:', err);
      setError(err.message || 'Gagal menyimpan pengaturan.');
    } finally {
      setSubmitting(false);
    }
  };

  // Animasi
  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  return (
    <motion.div
      className="p-6 animate-fade-in"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.4 }}
    >
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Pengaturan Toko</h1>

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

      {loading ? (
        <p className="text-gray-500">Memuat pengaturan...</p>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-md">
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nama Toko <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Contoh: Toko Sembako Jaya"
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
              required
            />
            <p className="mt-2 text-xs text-gray-500">
              Nama ini akan muncul di nota dan laporan.
            </p>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={submitting}
              className="w-full btn bg-primary-500 text-white hover:bg-primary-600 disabled:bg-gray-400 py-3 rounded-lg font-medium transition"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
          </div>
        </form>
      )}
    </motion.div>
  );
}

export default Settings;