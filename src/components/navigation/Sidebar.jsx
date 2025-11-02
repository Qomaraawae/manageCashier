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
  const [touchEnd, setTouchEnd] = useState(null)
  const [translateX, setTranslateX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // Minimum jarak swipe untuk menutup sidebar (dalam px)
  const minSwipeDistance = 50

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
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
    setIsDragging(true)
  }

  const onTouchMove = (e) => {
    if (!touchStart) return
    
    const currentTouch = e.targetTouches[0].clientX
    const diff = touchStart - currentTouch

    // Hanya izinkan swipe ke kiri (menutup)
    if (diff > 0) {
      setTranslateX(-diff)
      setTouchEnd(currentTouch)
    } else {
      setTranslateX(0)
    }
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setIsDragging(false)
      setTranslateX(0)
      return
    }

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance

    if (isLeftSwipe) {
      onClose()
    }

    setTranslateX(0)
    setIsDragging(false)
    setTouchStart(null)
    setTouchEnd(null)
  }

  // Mouse event handlers untuk desktop
  const onMouseDown = (e) => {
    // Hanya aktifkan di mobile (md:hidden)
    if (window.innerWidth >= 768) return
    
    setTouchEnd(null)
    setTouchStart(e.clientX)
    setIsDragging(true)
  }

  const onMouseMove = (e) => {
    if (!touchStart || !isDragging || window.innerWidth >= 768) return
    
    const currentPos = e.clientX
    const diff = touchStart - currentPos

    // Hanya izinkan swipe ke kiri (menutup)
    if (diff > 0) {
      setTranslateX(-diff)
      setTouchEnd(currentPos)
    } else {
      setTranslateX(0)
    }
  }

  const onMouseUp = () => {
    if (!touchStart || !touchEnd || window.innerWidth >= 768) {
      setIsDragging(false)
      setTranslateX(0)
      return
    }

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance

    if (isLeftSwipe) {
      onClose()
    }

    setTranslateX(0)
    setIsDragging(false)
    setTouchStart(null)
    setTouchEnd(null)
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
  }, [isDragging, touchStart, touchEnd])

  const handleLogout = async (e) => {
    e.preventDefault()
    await logout()
    onClose()
  }

  return (
    <>
      {/* Mobile Sidebar Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 md:hidden" 
          onClick={onClose}
          aria-hidden="true"
        ></div>
      )}
      
      {/* Sidebar */}
      <aside 
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[95vw] bg-white shadow-xl transform duration-300 ease-in-out md:relative md:translate-x-0 md:w-64 ${
          isDragging ? '' : 'transition-transform'
        } ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
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
            onClick={onClose}
          >
            <span className="text-2xl font-bold text-primary-500">MiniMarket</span>
          </Link>
          <button 
            className="p-2 md:hidden text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <MdClose size={24} />
          </button>
        </div>

        {/* Instruksi Swipe (hanya tampil di mobile) */}
        {isOpen && (
          <div className="p-3 bg-blue-50 border-b border-blue-100 md:hidden">
            <p className="text-xs text-blue-600 text-center">
              💡 Geser ke kiri untuk menutup
            </p>
          </div>
        )}
        
        {/* Navigation Links */}
        <nav className="p-4">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center p-3 rounded-lg transition-colors text-base ${
                    pathname === item.path 
                      ? 'bg-primary-500 text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={onClose}
                >
                  <div className="flex items-center w-full">
                    {item.icon}
                    <span className="ml-4 flex-1">{item.name}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        
        {/* User Info & Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center text-base">
              {user?.displayName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="ml-4 flex-1 min-w-0">
              <p className="text-base font-medium text-gray-700 truncate">{user?.displayName || 'User'}</p>
              <p className="text-sm text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            className="w-full py-3 px-4 btn btn-outline text-red-500 hover:bg-red-50 text-base rounded-lg"
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>

        {/* Indikator Drag (hanya tampil saat dragging di mobile) */}
        {isDragging && isOpen && (
          <div className="fixed bottom-24 left-4 right-4 bg-blue-100 border border-blue-300 rounded-lg p-3 text-center shadow-lg md:hidden z-60 animate-pulse">
            <p className="text-sm font-medium text-blue-700">
              {Math.abs(translateX) > minSwipeDistance 
                ? '✅ Lepas untuk menutup' 
                : '👆 Geser lebih jauh'}
            </p>
            <div className="mt-2 w-full bg-blue-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-blue-600 h-full transition-all duration-100"
                style={{ 
                  width: `${Math.min((Math.abs(translateX) / minSwipeDistance) * 100, 100)}%` 
                }}
              />
            </div>
          </div>
        )}
      </aside>
    </>
  )
}

export default Sidebar