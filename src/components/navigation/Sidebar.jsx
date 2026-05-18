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
import { useTheme } from '../../contexts/ThemeContext' // Import useTheme
import { MdDarkMode, MdLightMode } from 'react-icons/md' // Import icons for dark mode

function Sidebar({ isOpen, onClose }) {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme() // Get theme and toggle function
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
  ]

  // Reset saat sidebar ditutup
  useEffect(() => {
    if (!isOpen) {
      setTranslateX(0)
      setIsDragging(false)
    }
  }, [isOpen])

  // Touch event handlers untuk mobile
  const onTouchStart = (e) => {
    if (window.innerWidth >= 768) return

    setTouchStart(e.targetTouches[0].clientX)
    setTouchCurrent(e.targetTouches[0].clientX)
    setStartTime(Date.now())
    setIsDragging(true)
  }

  const onTouchMove = (e) => {
    if (!touchStart || !isDragging || window.innerWidth >= 768) return

    const currentTouch = e.targetTouches[0].clientX
    const diff = currentTouch - touchStart

    if (diff <= 0) {
      setTranslateX(diff)
    } else {
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

  const onMouseDown = (e) => {
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

    if (diff <= 0) {
      setTranslateX(diff)
    } else {
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
    if (window.innerWidth < 768) {
      onClose()
    }
  }

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
          className="fixed inset-0 z-40 bg-gray-600 md:hidden transition-opacity duration-200 dark:bg-gray-900 dark:bg-opacity-75"
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
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-xl
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
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <Link
            to="/"
            className="flex items-center space-x-2"
            onClick={() => window.innerWidth < 768 && onClose()}
          >
            <span className="text-xl md:text-2xl font-bold text-primary-500 dark:text-primary-400">StoreCashier</span>
          </Link>
          {/* Tombol close hanya tampil di mobile */}
          <button
            className="p-2 md:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <MdClose size={24} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center p-3 rounded-lg transition-colors text-sm md:text-base ${pathname === item.path
                    ? 'bg-primary-500 dark:bg-primary-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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

        {/* User Info & Dark Mode Toggle & Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          {/* User Info */}
          <div className="flex items-center mb-3 md:mb-4">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-primary-500 dark:bg-primary-600 text-white rounded-full flex items-center justify-center text-sm md:text-base font-semibold flex-shrink-0">
              {user?.displayName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm md:text-base font-medium text-gray-700 dark:text-gray-200 truncate">
                {user?.displayName || 'User'}
              </p>
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 truncate">
                {user?.email}
              </p>
            </div>
          </div>

          {/* Dark Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            className="w-full mb-3 py-2 md:py-2.5 px-4 rounded-lg transition-all duration-200 flex items-center justify-between group
              bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
              text-gray-700 dark:text-gray-200"
          >
            <div className="flex items-center">
              {theme === 'dark' ? (
                <MdLightMode size={20} className="text-yellow-500" />
              ) : (
                <MdDarkMode size={20} className="text-gray-600" />
              )}
              <span className="ml-3 text-sm md:text-base">
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </span>
            </div>
          </button>

          {/* Logout Button */}
          <button
            className="w-full py-2 md:py-3 px-4 btn btn-outline text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm md:text-base rounded-lg transition-colors"
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