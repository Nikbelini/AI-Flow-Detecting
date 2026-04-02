import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Spin, Typography } from "antd";
import { LogoutOutlined } from "@ant-design/icons";

const { Text } = Typography;

const LogoutCallback = () => {
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(true);

  useEffect(() => {
    const performLogout = async () => {
      try {
        await logout();
      } catch (err) {
        console.warn('⚠️ Ошибка при выходе:', err);
      } finally {
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsLoggingOut(false);
      }
    };

    performLogout();
  }, [logout]);

  useEffect(() => {
    if (!isLoggingOut) {
      window.location.replace('/auth/login?loggedout=true');
    }
  }, [isLoggingOut]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '48px',
          borderRadius: '20px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          minWidth: '320px',
        }}
      >
        <Spin size="large" style={{ marginBottom: 24 }} />
        
        <div style={{ fontSize: 18, color: '#1f2937', fontWeight: 600, marginBottom: 8 }}>
          <LogoutOutlined style={{ marginRight: 8, color: '#ef4444' }} />
          Выход из системы...
        </div>
        
        <Text type="secondary" style={{ fontSize: 14 }}>
          Пожалуйста, подождите
        </Text>

        {/* Прогресс-бар (опционально) */}
        <div
          style={{
            width: '100%',
            height: '4px',
            background: '#e5e7eb',
            borderRadius: '2px',
            marginTop: 24,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: isLoggingOut ? '100%' : '0%',
              height: '100%',
              background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
              transition: 'width 0.5s ease-in-out',
              animation: isLoggingOut ? 'shrink 0.5s ease-in-out forwards' : 'none',
            }}
          />
        </div>

        <style>{`
          @keyframes shrink {
            from { width: 100%; }
            to { width: 0%; }
          }
        `}</style>
      </div>
    </div>
  );
};

export default LogoutCallback;