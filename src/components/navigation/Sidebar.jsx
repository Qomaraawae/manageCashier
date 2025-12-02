import { Link, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { 
  MdDashboard, 
  MdPointOfSale, 
  MdInventory, 
  MdShoppingBag, 
  MdInsights, 
  MdSettings, 
  MdClose 
} from 'react-icons/md'
import { useAuth } from '../../contexts/AuthContext'

function Sidebar({ isOpen, onClose }) {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const sidebarRef = useRef(null)

  // State untuk swipe gesture
  const [touchStart, setTouchStart] = useState(null)
  const [touchCurrent, setTouchCurrent] = useState(null)
  const [translateX, setTranslateX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [startTime, setStartTime] = useState(null)

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <MdDashboard size={24} /> },
    { name: 'Cashier', path: '/cashier', icon: <MdPointOfSale size={24} /> },
    { name: 'Products', path: '/products', icon: <MdShoppingBag size={24} /> },
    { name: 'Reports', path: '/reports', icon: <MdInsights size={24} /> },
    { name: 'Settings', path: '/settings', icon: <MdSettings size={24} /> },
  ]

  // Reset translateX saat sidebar ditutup
  useEffect(() => {
    if (!isOpen) {
      setTranslateX(0)
      setIsDragging(false)
    }
  }, [isOpen])

  // Touch event handlers untuk mobile
  const onTouchStart = (e) => {
    // Hanya aktifkan swipe di mobile
    if (window.innerWidth >= 768) return
    
    setTouchStart(e.targetTouches[0].clientX)
    setTouchCurrent(e.targetTouches[0].clientX)
    setStartTime(Date.now())
    setIsDragging(true)
  }

  const onTouchMove = (e) => {
    // Hanya aktifkan swipe di mobile
    if (!touchStart || !isDragging || window.innerWidth >= 768) return
    
    const currentTouch = e.targetTouches[0].clientX
    const diff = currentTouch - touchStart

    // Geser bebas, tapi hanya ke kiri (nilai negatif)
    if (diff <= 0) {
      setTranslateX(diff)
    } else {
      // Resistance effect saat geser ke kanan
      setTranslateX(diff * 0.3)
    }
    
    setTouchCurrent(currentTouch)
  }

  const onTouchEnd = () => {
    // Hanya aktifkan swipe di mobile
    if (!touchStart || !touchCurrent || !isDragging || window.innerWidth >= 768) {
      setIsDragging(false)
      setTranslateX(0)
      return
    }

    const distance = touchCurrent - touchStart
    const duration = Date.now() - startTime
    const velocity = Math.abs(distance) / duration // px per ms

    // Tutup sidebar jika:
    // 1. Digeser lebih dari 40% lebar sidebar, ATAU
    // 2. Velocity tinggi (swipe cepat ke kiri)
    const sidebarWidth = sidebarRef.current?.offsetWidth || 320
    const threshold = sidebarWidth * 0.4

    if (distance < -threshold || (velocity > 0.5 && distance < 0)) {
      onClose()
    }

    setTranslateX(0)
    setIsDragging(false)
    setTouchStart(null)
    setTouchCurrent(null)
    setStartTime(null)
  }

  // Mouse event handlers untuk desktop
  const onMouseDown = (e) => {
    // Hanya aktifkan di mobile
    if (window.innerWidth >= 768) return
    
    setTouchStart(e.clientX)
    setTouchCurrent(e.clientX)
    setStartTime(Date.now())
    setIsDragging(true)
  }

  const onMouseMove = (e) => {
    if (!touchStart || !isDragging || window.innerWidth >= 768) return
    
    const currentPos = e.clientX
    const diff = currentPos - touchStart

    // Geser bebas, tapi hanya ke kiri (nilai negatif)
    if (diff <= 0) {
      setTranslateX(diff)
    } else {
      // Resistance effect saat geser ke kanan
      setTranslateX(diff * 0.3)
    }
    
    setTouchCurrent(currentPos)
  }

  const onMouseUp = () => {
    if (!touchStart || !touchCurrent || !isDragging || window.innerWidth >= 768) {
      setIsDragging(false)
      setTranslateX(0)
      return
    }

    const distance = touchCurrent - touchStart
    const duration = Date.now() - startTime
    const velocity = Math.abs(distance) / duration

    const sidebarWidth = sidebarRef.current?.offsetWidth || 320
    const threshold = sidebarWidth * 0.4

    if (distance < -threshold || (velocity > 0.5 && distance < 0)) {
      onClose()
    }

    setTranslateX(0)
    setIsDragging(false)
    setTouchStart(null)
    setTouchCurrent(null)
    setStartTime(null)
  }

  // Attach mouse events ke document saat dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging, touchStart, touchCurrent])

  const handleLogout = async (e) => {
    e.preventDefault()
    await logout()
    // Hanya close jika di mobile
    if (window.innerWidth < 768) {
      onClose()
    }
  }

  // Hitung opacity backdrop berdasarkan posisi sidebar
  const getBackdropOpacity = () => {
    if (!isDragging || translateX >= 0) return 0.75
    const sidebarWidth = sidebarRef.current?.offsetWidth || 320
    const progress = Math.max(0, 1 + (translateX / sidebarWidth))
    return 0.75 * progress
  }

  return (
    <>
      {/* Mobile Sidebar Backdrop - Hanya tampil di mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 md:hidden transition-opacity duration-200" 
          style={{
            opacity: getBackdropOpacity()
          }}
          onClick={onClose}
          aria-hidden="true"
        ></div>
      )}
      
      {/* Sidebar */}
      <aside 
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl
          md:sticky md:top-0 md:h-screen md:translate-x-0
          ${isDragging ? '' : 'transition-transform duration-300 ease-out'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          transform: isOpen && window.innerWidth < 768
            ? `translateX(${translateX}px)` 
            : undefined
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
      >
        {/* Logo and close button */}
        <div className="flex items-center justify-between p-4 border-b">
          <Link 
            to="/" 
            className="flex items-center space-x-2" 
            onClick={() => window.innerWidth < 768 && onClose()}
          >
            <span className="text-xl md:text-2xl font-bold text-primary-500">MiniMarket</span>
          </Link>
          {/* Tombol close hanya tampil di mobile */}
          <button 
            className="p-2 md:hidden text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <MdClose size={24} />
          </button>
        </div>
        
        {/* Navigation Links */}
        <nav className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center p-3 rounded-lg transition-colors text-sm md:text-base ${
                    pathname === item.path 
                      ? 'bg-primary-500 text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => window.innerWidth < 768 && onClose()}
                >
                  <div className="flex items-center w-full">
                    {item.icon}
                    <span className="ml-3 md:ml-4 flex-1">{item.name}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        
        {/* User Info & Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
          <div className="flex items-center mb-3 md:mb-4">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm md:text-base font-semibold flex-shrink-0">
              {user?.displayName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm md:text-base font-medium text-gray-700 truncate">
                {user?.displayName || 'User'}
              </p>
              <p className="text-xs md:text-sm text-gray-500 truncate">
                {user?.email}
              </p>
            </div>
          </div>
          <button
            className="w-full py-2 md:py-3 px-4 btn btn-outline text-red-500 hover:bg-red-50 text-sm md:text-base rounded-lg transition-colors"
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar