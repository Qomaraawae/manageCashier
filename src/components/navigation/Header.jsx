import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MdMenu } from 'react-icons/md';
import { useAuth } from '../../contexts/AuthContext';

function Header({ onOpenSidebar }) {
  const { user } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-700/30 sticky top-0 z-10 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {/* Mobile menu button */}
            <button
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 dark:focus:ring-primary-400 transition-colors duration-300 ease-in-out"
              onClick={onOpenSidebar}
            >
              <MdMenu size={24} />
            </button>

            {/* Logo - Mobile Only */}
            <div className="md:hidden ml-2">
              <Link to="/" className="text-xl font-bold text-primary-500 dark:text-primary-400">
                StoreCashier
              </Link>
            </div>
          </div>

          <div className="flex items-center">
            {/* Profile Dropdown */}
            <div className="ml-3 relative">
              <div>
                <button
                  className="flex items-center max-w-xs rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-colors"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                  <div className="w-8 h-8 bg-primary-500 dark:bg-primary-600 text-white rounded-full flex items-center justify-center font-medium">
                    {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </button>
              </div>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div
                  className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 dark:ring-gray-700 focus:outline-none transition-all duration-200"
                  onClick={() => setDropdownOpen(false)}
                >
                  <div className="py-1">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {user?.displayName || 'User'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {user?.email}
                      </p>
                    </div>
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