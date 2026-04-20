import { Dashboard } from '../components/Dashboard';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function FacturacionPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Dashboard
      userName={user?.nombre || 'Usuario'}
      onLogout={handleLogout}
    />
  );
}
