import { createContext, useContext, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';

// Константы (в секундах)
const INACTIVITY_TIMEOUT = 12 * 60 * 60;      // 720 минут
const ABSOLUTE_TIMEOUT = 12 * 60 * 60;   // 12 часов

type ActivityContextType = {
  lastActive: number | null;
};

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

export const ActivityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
    const navigate = useNavigate();

  const handleLogout = useCallback(() => {
    console.log('🔒 Автоматический выход из-за таймаута');
    navigate("/auth/logout");
  }, [logout]);

  useEffect(() => {
    if (!user) return;

    let inactivityTimer: any;
    let absoluteTimer: any;

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        console.log('⏰ Таймаут неактивности (30 мин) — выход');
        handleLogout();
      }, INACTIVITY_TIMEOUT * 1000);
    };

    // Абсолютный таймер (12 часов с момента входа)
    absoluteTimer = setTimeout(() => {
      console.log('⏰ Абсолютный таймаут (12 часов) — выход');
      handleLogout();
    }, ABSOLUTE_TIMEOUT * 1000);

    // События активности
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    activityEvents.forEach(event =>
      window.addEventListener(event, resetInactivityTimer, true)
    );

    // Запуск первого таймера
    resetInactivityTimer();

    return () => {
      clearTimeout(inactivityTimer);
      clearTimeout(absoluteTimer);
      activityEvents.forEach(event =>
        window.removeEventListener(event, resetInactivityTimer, true)
      );
    };
  }, [user, handleLogout]);

  // Пока не используем lastActive в UI
  return (
    <ActivityContext.Provider value={{ lastActive: user ? Date.now() : null }}>
      {children}
    </ActivityContext.Provider>
  );
};

export const useActivity = (): ActivityContextType => {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error('useActivity must be used within ActivityProvider');
  }
  return context;
};