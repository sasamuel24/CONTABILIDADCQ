import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { login, getMe } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

interface LoginPageProps {
  onLogin: (email: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const navigate = useNavigate();
  const { login: setUserAuth } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      
      // Obtener datos del usuario
      const user = await getMe();
      setUserAuth(user);
      
      // Redirigir según el rol del usuario
      const userRole = user.role;
      
      if (userRole === 'admin' || userRole === 'fact') {
        navigate('/global');
      } else if (userRole === 'responsable') {
        navigate('/responsable');
      } else if (userRole === 'contabilidad') {
        navigate('/contabilidad');
      } else if (userRole === 'tesoreria') {
        navigate('/tesoreria');
      } else if (userRole === 'direccion') {
        navigate('/centro-documental');
      } else {
        navigate('/no-autorizado');
      }
      
      onLogin(email);
    } catch (err) {
      // Mensaje específico para error de credenciales
      let message = 'Error al iniciar sesión';
      
      if (err instanceof Error) {
        // Si el mensaje contiene "incorrect" o "invalid", es un error de credenciales
        const errorMsg = err.message.toLowerCase();
        if (errorMsg.includes('incorrect') || 
            errorMsg.includes('invalid') || 
            errorMsg.includes('unauthorized') ||
            errorMsg.includes('no autorizado')) {
          message = 'Email o contraseña incorrectos. Por favor, verifica tus credenciales.';
        } else {
          message = err.message;
        }
      }
      
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-8"
      style={{
        fontFamily: "'Neutra Text', 'Montserrat', sans-serif",
        backgroundImage: `url('/fonts/plameras beige.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-12">
          <div className="w-60 h-10 rounded-lg flex items-center justify-center" style={{backgroundColor: '#00829a'}}>
            <span className="text-white font-bold">SISTEMA DE FACTURAS CAFÉ QUINDÍO</span>
          </div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-gray-900 mb-2">¡Bienvenido!</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Email Input */}
          <div>
            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
              onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(20, 170, 184, 0.5)'}
              onBlur={(e) => e.target.style.boxShadow = ''}
              required
              disabled={isLoading}
            />
          </div>

          {/* Password Input */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent pr-12"
              onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(20, 170, 184, 0.5)'}
              onBlur={(e) => e.target.style.boxShadow = ''}
              required
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 transition-colors"
              style={{
                color: showPassword ? '#00829a' : undefined
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#00829a'}
              onMouseLeave={(e) => e.currentTarget.style.color = showPassword ? '#00829a' : '#6b7280'}
              disabled={isLoading}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {/* Remember me */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
                style={{accentColor: '#14aab8'}}
                disabled={isLoading}
              />
              <span className="text-gray-700">Recordarme</span>
            </label>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            className="w-full text-white py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              backgroundColor: '#00829a'
            }}
            onMouseEnter={(e) => {
              if (!isLoading) e.currentTarget.style.backgroundColor = '#14aab8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#00829a';
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Iniciando sesión...</span>
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
