import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, Typography, Button, Divider, Alert } from 'antd';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (!user) {
    return (
      <Alert 
        message="Не авторизован" 
        description="Пожалуйста, войдите в систему" 
        type="warning" 
        showIcon 
      />
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
      <Card title="Мой профиль" bordered={false}>
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div style={{ 
            width: 80, 
            height: 80, 
            borderRadius: '50%', 
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: 'white',
            fontSize: 24,
            fontWeight: 600
          }}>
            {user.fullName?.split(' ').map(n => n[0]).join('').toUpperCase()}
          </div>
          <Title level={4} style={{ margin: 0 }}>{user.fullName}</Title>
          <Text type="secondary">{user.email}</Text>
        </div>

        <Divider />

        <div style={{ marginBottom: 16 }}>
          <Text strong>Роль:</Text>
          <div style={{ marginTop: 4 }}>
            <Text code>{user.role}</Text>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <Text strong>ID пользователя:</Text>
          <div style={{ marginTop: 4 }}>
            <Text code>{user.id}</Text>
          </div>
        </div>

        <Divider />

        <Button 
          type="primary" 
          danger 
          block 
          onClick={handleLogout}
          style={{ height: 44 }}
        >
          Выйти из аккаунта
        </Button>
      </Card>
    </div>
  );
};

export default ProfilePage;