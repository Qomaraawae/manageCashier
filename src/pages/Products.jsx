import { useEffect, useState, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { MdSearch, MdClose, MdNavigateBefore, MdNavigateNext, MdFirstPage, MdLastPage } from 'react-icons/md';

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

// KOMPONEN PAGINATION
const Pagination = ({ currentPage, totalPages, itemsPerPage, totalItems, onPageChange, onItemsPerPageChange }) => {
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pageNumbers.push(i);
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pageNumbers.push(i);
      } else {
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pageNumbers.push(i);
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      }
    }

    return pageNumbers;
  };

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-6 py-4 bg-gray-50 border-t border-gray-200">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Tampilkan</span>
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={15}>15</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
        <span className="text-sm text-gray-600">data per halaman</span>
      </div>

      <div className="text-sm text-gray-600">
        Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} dari {totalItems} produk
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className={`p-2 rounded-lg transition-colors ${currentPage === 1
            ? 'text-gray-400 cursor-not-allowed'
            : 'text-gray-600 hover:bg-gray-200'
            }`}
        >
          <MdFirstPage size={20} />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`p-2 rounded-lg transition-colors ${currentPage === 1
            ? 'text-gray-400 cursor-not-allowed'
            : 'text-gray-600 hover:bg-gray-200'
            }`}
        >
          <MdNavigateBefore size={20} />
        </button>

        {getPageNumbers().map((page, index) => (
          <button
            key={index}
            onClick={() => typeof page === 'number' && onPageChange(page)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${currentPage === page
              ? 'bg-primary-500 text-white'
              : page === '...'
                ? 'text-gray-400 cursor-default'
                : 'text-gray-600 hover:bg-gray-200'
              }`}
            disabled={page === '...'}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`p-2 rounded-lg transition-colors ${currentPage === totalPages
            ? 'text-gray-400 cursor-not-allowed'
            : 'text-gray-600 hover:bg-gray-200'
            }`}
        >
          <MdNavigateNext size={20} />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className={`p-2 rounded-lg transition-colors ${currentPage === totalPages
            ? 'text-gray-400 cursor-not-allowed'
            : 'text-gray-600 hover:bg-gray-200'
            }`}
        >
          <MdLastPage size={20} />
        </button>
      </div>
    </div>
  );
};

function Products() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: '',
    barcode: '',
    category: 'Makanan',
    image: null,
  });
  const [previewImage, setPreviewImage] = useState(null);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // State untuk filter dan pencarian
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  // State untuk pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Ref untuk form edit
  const formRef = useRef(null);

  // Daftar kategori yang tersedia
  const categories = [
    'Semua',
    'Makanan',
    'Minuman',
    'Snack',
    'Lainnya'
  ];

  // Fungsi untuk scroll ke form
  const scrollToForm = () => {
    if (formRef.current) {
      formRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest'
      });
    }
  };

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
        setFilteredProducts(productsData);
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

  // Filter produk berdasarkan pencarian dan kategori
  useEffect(() => {
    let filtered = products;

    // Filter berdasarkan kategori
    if (selectedCategory !== 'Semua') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    // Filter berdasarkan pencarian nama produk
    if (searchQuery) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
    setCurrentPage(1); // Reset ke halaman pertama saat filter berubah
  }, [searchQuery, selectedCategory, products]);

  // Hitung data untuk halaman saat ini
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

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
    const { name, price, stock, category, image } = formData;

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
        barcode: formData.barcode || '',
        category,
        imageUrl,
      };

      let newDoc;
      if (editId) {
        const productRef = doc(db, 'products', editId);
        await updateDoc(productRef, productData);
        const updatedProducts = products.map(p => p.id === editId ? { id: editId, ...productData } : p);
        setProducts(updatedProducts);
        setFilteredProducts(updatedProducts);
        setSuccessMessage('Produk berhasil diperbarui!');
      } else {
        newDoc = await addDoc(collection(db, 'products'), productData);
        const updatedProducts = [...products, { id: newDoc.id, ...productData }];
        setProducts(updatedProducts);
        setFilteredProducts(updatedProducts);
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
    if (window.confirm('Apakah Anda yakin ingin menghapus produk ini?')) {
      try {
        await deleteDoc(doc(db, 'products', id));
        const updatedProducts = products.filter(product => product.id !== id);
        setProducts(updatedProducts);
        setFilteredProducts(updatedProducts);
        setSuccessMessage('Produk berhasil dihapus!');
        setError(null);
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        console.error('Gagal menghapus produk:', err);
        setError('Gagal menghapus produk. Coba lagi.');
      }
    }
  };

  // Mulai edit produk dengan auto scroll ke form
  const startEdit = (product) => {
    if (previewImage) {
      URL.revokeObjectURL(previewImage);
    }
    setFormData({
      name: product.name,
      price: product.price.toString(),
      stock: product.stock.toString(),
      barcode: product.barcode || '',
      category: product.category || 'Lainnya',
      image: null,
    });
    setPreviewImage(product.imageUrl || null);
    setEditId(product.id);

    // Scroll ke form setelah state update
    setTimeout(() => {
      scrollToForm();
    }, 100);
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

      {/* Form Tambah/Edit Produk dengan ref */}
      <div ref={formRef} className="mb-8 bg-white p-6 rounded-lg shadow scroll-mt-4">
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
              {categories.filter(cat => cat !== 'Semua').map((cat) => (
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
              className="btn bg-primary-500 text-white hover:bg-primary-600 px-4 py-2 rounded-lg"
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
                className="btn bg-gray-500 text-white hover:bg-gray-600 px-4 py-2 rounded-lg"
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
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Daftar Produk</h2>

          {/* Filter Kategori dan Pencarian */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Filter Kategori */}
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedCategory === cat
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Bar */}
            <div className="relative flex-1 sm:max-w-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MdSearch className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Cari produk..."
                className="input pl-10 w-full bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent px-4 py-2"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <MdClose className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
          </div>
        </div>

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
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                      <span className="ml-2">Memuat produk...</span>
                    </div>
                  </td>
                </tr>
              ) : currentProducts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <MdSearch size={48} className="mb-3" />
                      <p className="text-gray-500 font-medium">Tidak ada produk ditemukan</p>
                      <p className="text-sm text-gray-400 mt-1">
                        {searchQuery ? 'Coba ubah kata kunci pencarian' : 'Belum ada produk untuk kategori ini'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors duration-150">
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
                      <span className={`font-medium ${product.stock <= 5 ? 'text-orange-500' : product.stock === 0 ? 'text-red-500' : 'text-gray-700'}`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.barcode || 'T/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => startEdit(product)}
                        className="text-primary-500 hover:text-primary-600 mr-4 transition-colors"
                        aria-label={`Edit ${product.name}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="text-red-500 hover:text-red-600 transition-colors"
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

        {/* Pagination Component */}
        {!loading && filteredProducts.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            totalItems={filteredProducts.length}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        )}
      </div>
    </div>
  );
}

export default Products;