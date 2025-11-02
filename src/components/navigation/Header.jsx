import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MdMenu, MdShoppingCart } from 'react-icons/md';
import { useAuth } from '../../contexts/AuthContext';

function Header({ onOpenSidebar }) {
  const { user } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="bg-white shadow-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {/* Mobile menu button */}
            <button
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 transition-colors duration-300 ease-in-out"
              onClick={onOpenSidebar}
            >
              <MdMenu size={24} />
            </button>
            
            {/* Logo - Mobile Only */}
            <div className="md:hidden ml-2">
              <Link to="/" className="text-xl font-bold text-primary-500">
                MiniMarket
              </Link>
            </div>
          </div>
            <div className="flex items-center">
            {/* Profile Dropdown */}
            <div className="ml-3 relative">
              <div>
                <button
                  className="flex items-center max-w-xs rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                  <div className="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center">
                    {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </button>
              </div>
              
              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div 
                  className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none transition-colors duration-300 ease-in-out"
                  onClick={() => setDropdownOpen(false)}
                >
                  <div className="py-1">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {user?.displayName || 'User'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {user?.email}
                      </p>
                    </div>
                    <Link
                      to="/settings"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-300 ease-in-out"
                    >
                      Account Settings
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;