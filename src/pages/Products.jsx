import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Fungsi untuk memformat angka ke Rupiah
const formatRupiah = (value) => {
  if (isNaN(value) || value < 0) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
};

// Fungsi untuk mengunggah gambar ke Cloudinary
const uploadImageToCloudinary = async (file) => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dm1zqexxt';
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'adminCashier';

  console.log('Menggunakan Cloud Name:', cloudName);
  console.log('Menggunakan Upload Preset:', uploadPreset);

  if (!cloudName || !uploadPreset) {
    throw new Error('Konfigurasi Cloudinary tidak lengkap. Pastikan VITE_CLOUDINARY_CLOUD_NAME dan VITE_CLOUDINARY_UPLOAD_PRESET di file .env.');
  }

  if (!file) {
    throw new Error('Tidak ada file gambar yang dipilih.');
  }

  // Validasi tipe dan ukuran file
  if (!file.type.startsWith('image/')) {
    throw new Error('File harus berupa gambar (JPG, PNG, dll.).');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran gambar tidak boleh melebihi 5MB.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Cloudinary error:', errorData);
      throw new Error(`Gagal mengunggah gambar: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.secure_url;
  } catch (err) {
    console.error('Error unggah gambar:', err);
    throw err;
  }
};

function Products() {
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: '',
    barcode: '',
    category: 'Makanan', // Tambahan field kategori dengan default value
    image: null,
  });
  const [previewImage, setPreviewImage] = useState(null);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Daftar kategori yang tersedia
  const categories = [
    'Makanan',
    'Minuman',
    'Snack',
    'Lainnya'
  ];

  // Ambil daftar produk dari Firestore
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productsRef = collection(db, 'products');
        const snapshot = await getDocs(productsRef);
        const productsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProducts(productsData);
        setError(null);
      } catch (err) {
        console.error('Gagal mengambil produk:', err);
        setError('Gagal memuat daftar produk.');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Tangani perubahan input form
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Tangani perubahan input gambar
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (previewImage) {
        URL.revokeObjectURL(previewImage);
      }
      setFormData((prev) => ({ ...prev, image: file }));
      setPreviewImage(URL.createObjectURL(file));
    }
  };

  // Tambah atau edit produk
  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, price, stock, barcode, category, image } = formData;

    if (!name || !price || !stock || !category) {
      setError('Nama, harga, stok, dan kategori wajib diisi.');
      return;
    }

    if (parseInt(price) <= 0 || parseInt(stock) < 0) {
      setError('Harga harus lebih dari 0 dan stok tidak boleh negatif.');
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl = editId ? products.find(p => p.id === editId)?.imageUrl || '' : '';
      if (image) {
        try {
          imageUrl = await uploadImageToCloudinary(image);
        } catch (uploadErr) {
          console.warn('Gambar gagal diunggah, menyimpan produk tanpa gambar:', uploadErr);
          setError('Gambar gagal diunggah, tetapi produk tetap disimpan.');
        }
      }

      const productData = {
        name,
        price: parseInt(price),
        stock: parseInt(stock),
        barcode: barcode || '',
        category, // Tambahan field kategori
        imageUrl,
      };

      let newDoc;
      if (editId) {
        const productRef = doc(db, 'products', editId);
        await updateDoc(productRef, productData);
        setProducts(products.map(p => p.id === editId ? { id: editId, ...productData } : p));
        setSuccessMessage('Produk berhasil diperbarui!');
      } else {
        newDoc = await addDoc(collection(db, 'products'), productData);
        setProducts([...products, { id: newDoc.id, ...productData }]);
        setSuccessMessage('Produk berhasil ditambahkan!');
      }

      if (previewImage) {
        URL.revokeObjectURL(previewImage);
      }
      setFormData({ name: '', price: '', stock: '', barcode: '', category: 'Makanan', image: null });
      setPreviewImage(null);
      setEditId(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Gagal menyimpan produk:', err);
      setError(err.message || 'Gagal menyimpan produk. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  // Hapus produk
  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'products', id));
      setProducts(products.filter(product => product.id !== id));
      setSuccessMessage('Produk berhasil dihapus!');
      setError(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Gagal menghapus produk:', err);
      setError('Gagal menghapus produk. Coba lagi.');
    }
  };

  // Mulai edit produk
  const startEdit = (product) => {
    if (previewImage) {
      URL.revokeObjectURL(previewImage);
    }
    setFormData({
      name: product.name,
      price: product.price.toString(),
      stock: product.stock.toString(),
      barcode: product.barcode || '',
      category: product.category || 'Lainnya', // Tambahan field kategori
      image: null,
    });
    setPreviewImage(product.imageUrl || null);
    setEditId(product.id);
  };

  return (
    <div className="animate-fade-in p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Kelola Produk</h1>

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

      {/* Form Tambah/Edit Produk */}
      <div className="mb-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {editId ? 'Edit Produk' : 'Tambah Produk'}
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nama Produk</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Masukkan nama produk"
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Nama produk"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Kategori</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Kategori produk"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Harga</label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleInputChange}
              placeholder="Masukkan harga"
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Harga produk"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Stok</label>
            <input
              type="number"
              name="stock"
              value={formData.stock}
              onChange={handleInputChange}
              placeholder="Masukkan stok"
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Stok produk"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Kode Barcode (opsional)</label>
            <input
              type="text"
              name="barcode"
              value={formData.barcode}
              onChange={handleInputChange}
              placeholder="Masukkan kode barcode"
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Kode barcode"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Gambar Produk (opsional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Unggah gambar produk"
            />
            {previewImage && (
              <img
                src={previewImage}
                alt="Pratinjau gambar produk"
                className="mt-2 w-24 h-24 sm:w-32 sm:h-32 object-cover rounded"
              />
            )}
          </div>
          <div className="sm:col-span-2 flex space-x-4">
            <button
              type="submit"
              className="btn bg-primary-500 text-white hover:bg-primary-600"
              aria-label={editId ? 'Simpan perubahan produk' : 'Tambah produk'}
              disabled={submitting}
            >
              {submitting ? 'Menyimpan...' : editId ? 'Simpan' : 'Tambah'}
            </button>
            {editId && (
              <button
                type="button"
                onClick={() => {
                  if (previewImage) {
                    URL.revokeObjectURL(previewImage);
                  }
                  setFormData({ name: '', price: '', stock: '', barcode: '', category: 'Makanan', image: null });
                  setPreviewImage(null);
                  setEditId(null);
                }}
                className="btn bg-gray-500 text-white hover:bg-gray-600"
                aria-label="Batal edit produk"
              >
                Batal
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Daftar Produk */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <h2 className="p-6 text-lg font-semibold text-gray-900">Daftar Produk</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gambar
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nama
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kategori
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Harga
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stok
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Barcode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                    Memuat produk...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                    Tidak ada produk ditemukan.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded"
                          onError={(e) => (e.target.src = 'https://via.placeholder.com/50')}
                        />
                      ) : (
                        <span className="text-gray-500">T/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {product.category || 'Lainnya'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatRupiah(product.price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.stock}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.barcode || 'T/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => startEdit(product)}
                        className="text-primary-500 hover:text-primary-600 mr-4"
                        aria-label={`Edit ${product.name}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="text-red-500 hover:text-red-600"
                        aria-label={`Hapus ${product.name}`}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Products;