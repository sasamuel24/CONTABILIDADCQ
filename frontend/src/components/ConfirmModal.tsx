import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'info',
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  showCancel = false
}: ConfirmModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 200);
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    handleClose();
  };

  const getConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: CheckCircle,
          iconColor: '#00829a',
          bgGradient: 'linear-gradient(135deg, #e0f5f7 0%, #ffffff 100%)',
          borderColor: '#00829a'
        };
      case 'error':
        return {
          icon: AlertCircle,
          iconColor: '#ef4444',
          bgGradient: 'linear-gradient(135deg, #fee2e2 0%, #ffffff 100%)',
          borderColor: '#ef4444'
        };
      case 'warning':
        return {
          icon: AlertCircle,
          iconColor: '#f59e0b',
          bgGradient: 'linear-gradient(135deg, #fef3c7 0%, #ffffff 100%)',
          borderColor: '#f59e0b'
        };
      default:
        return {
          icon: Info,
          iconColor: '#00829a',
          bgGradient: 'linear-gradient(135deg, #e0f5f7 0%, #ffffff 100%)',
          borderColor: '#00829a'
        };
    }
  };

  const config = getConfig();
  const IconComponent = config.icon;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        opacity: isAnimating ? 1 : 0,
        transition: 'opacity 200ms ease-in-out'
      }}
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-md mx-4"
        style={{
          transform: isAnimating ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
          opacity: isAnimating ? 1 : 0,
          transition: 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Card */}
        <div
          className="rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: '#ffffff',
            border: `2px solid ${config.borderColor}`,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}
        >
          {/* Header with gradient */}
          <div
            className="p-6 relative"
            style={{
              background: config.bgGradient
            }}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1 rounded-full transition-all"
              style={{
                color: config.iconColor,
                opacity: 0.6
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.6';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon with animation */}
            <div className="flex justify-center mb-4">
              <div
                className="rounded-full p-3"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  animation: 'bounce 1s ease-in-out'
                }}
              >
                <IconComponent
                  className="w-12 h-12"
                  style={{
                    color: config.iconColor,
                    strokeWidth: 2.5
                  }}
                />
              </div>
            </div>

            {/* Title */}
            <h3
              className="text-center text-xl font-bold mb-2"
              style={{
                fontFamily: "'Neutra Text Bold', 'Montserrat', sans-serif",
                color: '#1f2937'
              }}
            >
              {title}
            </h3>

            {/* Message */}
            <p
              className="text-center whitespace-pre-line"
              style={{
                fontFamily: "'Neutra Text Book', 'Montserrat', sans-serif",
                color: '#4b5563',
                fontSize: '0.95rem',
                lineHeight: '1.6'
              }}
            >
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="p-6 bg-gray-50 flex gap-3 justify-end">
            {showCancel && (
              <button
                onClick={handleClose}
                className="px-6 py-2.5 rounded-lg transition-all"
                style={{
                  fontFamily: "'Neutra Text Demi', 'Montserrat', sans-serif",
                  fontSize: '0.9rem',
                  border: '2px solid #d1d5db',
                  color: '#6b7280',
                  backgroundColor: 'white'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#9ca3af';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }}
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={handleConfirm}
              className="px-8 py-2.5 rounded-lg transition-all"
              style={{
                fontFamily: "'Neutra Text Bold', 'Montserrat', sans-serif",
                fontSize: '0.9rem',
                backgroundColor: config.iconColor,
                color: 'white',
                border: 'none',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.backgroundColor = type === 'success' ? '#14aab8' : config.iconColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                e.currentTarget.style.backgroundColor = config.iconColor;
              }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>

      {/* Keyframe animation for bounce effect */}
      <style>{`
        @keyframes bounce {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>,
    document.body
  );
}
