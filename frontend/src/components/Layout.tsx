import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <Link to="/dashboard" className="logo">
            <div className="logo-circle">S</div>
            <span>shareIT</span>
          </Link>
          <nav className="nav-links">
            <Link to="/dashboard" className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}>
              Dashboard
            </Link>
            <Link to="/projects" className={`nav-link ${location.pathname.startsWith('/projects') ? 'active' : ''}`}>
              Projects
            </Link>
            <Link to="/profile" className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`}>
              Profile
            </Link>
            <span className="user-email">{user?.email}</span>
            <button onClick={logout} className="btn btn-secondary btn-sm">
              Logout
            </button>
          </nav>
        </div>
      </header>
      <main className="main-content">{children}</main>
    </div>
  );
}

