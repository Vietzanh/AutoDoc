import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "./Button";

interface NavLinkProps {
  to: string;
  children: React.ReactNode;
  className?: string;
}

function NavLink({ to, children, className = "" }: NavLinkProps) {
  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors ${className}`}
    >
      {children}
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top navigation bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-6">
              <Link
                to="/"
                className="flex items-center gap-2 text-lg font-bold text-blue-600"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                AutoDoc
              </Link>

              {user && (
                <nav className="hidden sm:flex items-center gap-1">
                  <NavLink to="/">Dashboard</NavLink>
                  <NavLink to="/reconstruct">Reconstruct</NavLink>
                  <NavLink to="/combine">Combine</NavLink>
                  <NavLink to="/split">Split</NavLink>
                  <NavLink to="/organize">Organize</NavLink>
                  <NavLink to="/reorder">Reorder</NavLink>
                  <NavLink to="/page-numbers">Page Numbers</NavLink>
                  <NavLink to="/crop">Crop</NavLink>
                </nav>
              )}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <span className="text-sm text-gray-600 hidden sm:block">
                    {user.username}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                  >
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <NavLink to="/login">Login</NavLink>
                  <NavLink to="/register">Register</NavLink>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      {user && (
        <nav className="sm:hidden bg-white border-b border-gray-200 px-4 py-2 flex gap-2 overflow-x-auto">
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/reconstruct">Reconstruct</NavLink>
          <NavLink to="/combine">Combine</NavLink>
          <NavLink to="/split">Split</NavLink>
          <NavLink to="/organize">Organize</NavLink>
          <NavLink to="/reorder">Reorder</NavLink>
          <NavLink to="/page-numbers">Page Numbers</NavLink>
          <NavLink to="/crop">Crop</NavLink>
        </nav>
      )}

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            AutoDoc — PDF Toolkit
          </p>
        </div>
      </footer>
    </div>
  );
}
