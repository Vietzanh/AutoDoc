import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { allTools, convertTools, editTools, ToolDefinition } from "@/config/tools";
import { Button } from "./Button";

function AppLogo() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.5L19 9.5V19a2 2 0 01-2 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 3v5a2 2 0 002 2h4" />
      </svg>
    </span>
  );
}

interface NavDropdownProps {
  label: string;
  tools: ToolDefinition[];
}

function NavDropdown({ label, tools }: NavDropdownProps) {
  return (
    <div className="group relative">
      <button
        type="button"
        className="flex h-16 items-center gap-1 border-b-2 border-transparent px-3 text-sm font-semibold text-gray-800 transition group-hover:border-blue-600 group-hover:text-blue-700"
      >
        {label}
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className="invisible absolute left-0 top-full z-30 w-80 translate-y-2 rounded-xl border border-gray-200 bg-white p-3 opacity-0 shadow-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
        <div className="space-y-1">
          {tools.map((tool) => (
            <Link
              key={tool.id}
              to={tool.route}
              className="block rounded-lg px-4 py-3 transition hover:bg-blue-50"
            >
              <span className="block text-sm font-bold text-gray-900">{tool.name}</span>
              <span className="mt-1 block text-xs leading-5 text-gray-500">{tool.description}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
    >
      {children}
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isWorkspacePage = location.pathname === "/organize";
  const isHomePage = location.pathname === "/";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link
                to="/"
                className="flex items-center gap-3 text-xl font-bold text-blue-700"
              >
                <AppLogo />
                AutoDoc
              </Link>

              {user && (
                <nav className="hidden items-center gap-1 lg:flex">
                  <NavDropdown label="Convert tools" tools={convertTools} />
                  <NavDropdown label="Edit PDF tools" tools={editTools} />
                  <NavDropdown label="All tools" tools={allTools} />
                </nav>
              )}
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <span className="hidden text-sm font-medium text-gray-600 sm:block">
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

      <main
        className={
          isWorkspacePage
            ? "flex-1 w-full min-h-0 overflow-hidden"
            : isHomePage
              ? "flex-1 w-full"
              : "flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8"
        }
      >
        {children}
      </main>

      {!isWorkspacePage && (
        <footer className="mt-auto border-t border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-gray-500">
              AutoDoc - PDF Toolkit
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
