import React, { createContext, useContext, useState, useEffect } from 'react';
import { AlertCircle, HelpCircle, Info } from 'lucide-react';

interface ModalConfig {
  type: 'alert' | 'confirm' | 'prompt';
  message: string;
  defaultValue?: string;
  resolve: (value: any) => void;
}

interface ModalContextType {
  alert: (message: string) => Promise<void>;
  confirm: (message: string) => Promise<boolean>;
  prompt: (message: string, defaultValue?: string) => Promise<string | null>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function useModals() {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useModals must be used within a ModalProvider');
  return context;
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalConfig | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const alert = (message: string) => {
    return new Promise<void>((resolve) => {
      setModal({ type: 'alert', message, resolve });
    });
  };

  const confirm = (message: string) => {
    return new Promise<boolean>((resolve) => {
      setModal({ type: 'confirm', message, resolve });
    });
  };

  const prompt = (message: string, defaultValue = '') => {
    return new Promise<string | null>((resolve) => {
      setInputValue(defaultValue);
      setModal({ type: 'prompt', message, defaultValue, resolve });
    });
  };

  const handleClose = (value: any) => {
    if (modal) {
      modal.resolve(value);
      setModal(null);
      setInputValue('');
    }
  };

  useEffect(() => {
    if (!modal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose(modal.type === 'confirm' ? false : null);
      } else if (e.key === 'Enter' && modal.type !== 'prompt') {
        e.preventDefault();
        handleClose(modal.type === 'confirm' ? true : undefined);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modal, inputValue]);

  const getIcon = () => {
    if (!modal) return null;
    switch (modal.type) {
      case 'alert':
        return (
          <div style={{ ...styles.iconWrapper, backgroundColor: 'var(--red-tint)', color: 'var(--red)' }}>
            <AlertCircle size={24} />
          </div>
        );
      case 'confirm':
        return (
          <div style={{ ...styles.iconWrapper, backgroundColor: 'var(--tint)', color: 'var(--accent)' }}>
            <HelpCircle size={24} />
          </div>
        );
      case 'prompt':
        return (
          <div style={{ ...styles.iconWrapper, backgroundColor: 'var(--green-tint)', color: 'var(--green)' }}>
            <Info size={24} />
          </div>
        );
    }
  };

  return (
    <ModalContext.Provider value={{ alert, confirm, prompt }}>
      {children}
      {modal && (
        <div style={styles.overlay}>
          <div style={styles.modal} className="stack">
            <div style={styles.header}>
              {getIcon()}
              <div style={styles.title}>
                {modal.type === 'alert' && 'System Alert'}
                {modal.type === 'confirm' && 'Confirm Action'}
                {modal.type === 'prompt' && 'Input Required'}
              </div>
            </div>
            
            <div style={styles.message}>{modal.message}</div>
            
            {modal.type === 'prompt' && (
              <div style={styles.inputWrapper}>
                <input
                  autoFocus
                  style={{
                    ...styles.input,
                    borderColor: isFocused ? 'var(--accent)' : 'var(--border)',
                    outline: 'none',
                    boxShadow: isFocused ? '0 0 0 4px var(--tint)' : 'none',
                  }}
                  value={inputValue}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleClose(inputValue);
                    }
                  }}
                />
              </div>
            )}

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 24, marginBottom: 0, gap: 12 }}>
              {modal.type !== 'alert' && (
                <button
                  className="ghost"
                  style={styles.cancelBtn}
                  onClick={() => handleClose(modal.type === 'confirm' ? false : null)}
                >
                  Cancel
                </button>
              )}
              <button
                style={styles.confirmBtn}
                onClick={() => {
                  if (modal.type === 'prompt') {
                    handleClose(inputValue);
                  } else {
                    handleClose(modal.type === 'confirm' ? true : undefined);
                  }
                }}
              >
                {modal.type === 'alert' ? 'OK' : 'Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    animation: 'modal-fade-in 0.2s ease-out',
  },
  modal: {
    backgroundColor: 'var(--panel)',
    border: '1px solid rgba(240, 240, 240, 0.8)',
    borderRadius: '28px',
    padding: '28px',
    width: '90%',
    maxWidth: '440px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    animation: 'modal-zoom-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  iconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '12px',
  },
  title: {
    fontWeight: 800,
    fontSize: '16px',
    color: 'var(--text)',
    letterSpacing: '-0.3px',
  },
  message: {
    fontSize: '14px',
    color: 'var(--muted)',
    lineHeight: '1.6',
    margin: '8px 0 16px 0',
  },
  inputWrapper: {
    width: '100%',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    background: 'var(--panel2)',
    border: '2px solid var(--border)',
    padding: '12px 16px',
    borderRadius: '16px',
    fontSize: '14px',
    color: 'var(--text)',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  cancelBtn: {
    background: 'transparent',
    color: 'var(--muted)',
    border: '1px solid var(--border)',
    padding: '10px 22px',
    borderRadius: '999px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  confirmBtn: {
    background: 'linear-gradient(135deg, var(--black) 0%, #333 100%)',
    color: 'white',
    border: 'none',
    padding: '10px 24px',
    borderRadius: '999px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.15s',
  },
};
