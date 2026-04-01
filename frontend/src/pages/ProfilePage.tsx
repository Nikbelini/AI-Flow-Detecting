// src/pages/ProfilePage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Card, Typography, Button, Divider, Alert, Tabs,
  Form, Input, Modal, Descriptions, Tag, List,
  message, Popconfirm, Space, Tooltip, Spin
} from 'antd';
import {
  UserOutlined, SafetyOutlined, DeleteOutlined,
  LockOutlined, MobileOutlined, ClockCircleOutlined,
  EditOutlined, CheckOutlined, CloseOutlined,
  LogoutOutlined, LaptopOutlined, GlobalOutlined,
  ReloadOutlined, WarningOutlined, UnlockOutlined
} from '@ant-design/icons';
import {
  getMe, updateProfile, requestConfirmation,
  confirmEmailAndEnable2fa, disableTwoFactor,
  changePassword, deleteAccount,
  getSecurityPolicy, updateSecurityPolicy,
  getDeviceSessions, revokeSession, revokeAllOtherSessions, logoutAllSessions
} from '../api/endpoints/user';
import type {
  UserUpdate, ChangePassword, PolicyUpdate, 
  SecurityPolicyDto, DeviceSessionDto
} from '../api/types/user';
import './ProfilePage.css';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

type ProfileTab = 'profile' | 'security' | 'policy' | 'sessions';

const ProfilePage: React.FC = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [policy, setPolicy] = useState<SecurityPolicyDto | null>(null);
  const [sessions, setSessions] = useState<DeviceSessionDto[]>([]);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [otpModal, setOtpModal] = useState<{ 
    visible: boolean; 
    action: 'confirm' | 'disable2fa' | null 
  }>({ visible: false, action: null });
  const [otpValue, setOtpValue] = useState('');

  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [policyForm] = Form.useForm();

  // Refs для предотвращения повторных запросов
  const sessionsLoadedRef = useRef(false);
  const policyLoadedRef = useRef(false);
  const profileLoadedRef = useRef(false);
  const mountedRef = useRef(true);

  const loadProfile = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const data = await getMe();
      if (mountedRef.current) {
        profileForm.setFieldsValue({ fullName: data.fullName, email: data.email });
        await refreshUser?.();
        profileLoadedRef.current = true;
      }
    } catch {
      if (mountedRef.current) {
        message.error('Ошибка загрузки профиля');
      }
    }
  }, [profileForm, refreshUser]);

  const loadPolicy = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const data = await getSecurityPolicy();
      if (mountedRef.current) {
        setPolicy(data);
        policyForm.setFieldsValue({
          passwordExpirationDays: data.passwordExpirationDays,
          maxFailedAttempts: data.maxFailedAttempts,
          lockDurationSeconds: data.lockDurationSeconds
        });
        policyLoadedRef.current = true;
      }
    } catch {
      // Политики могут быть недоступны — это нормально
    }
  }, [policyForm]);

  // Загрузка сессий — теперь без deviceId, всё через JWT
  const loadSessions = useCallback(async () => {
    if (!mountedRef.current) return;
    
    if (mountedRef.current) {
      setSessionsLoading(true);
      setSessionsError(null);
    }
    
    try {
      // Запрос идёт с заголовком Authorization: Bearer <token>
      // sessionId извлекается на бэкенде из токена
      const data = await getDeviceSessions();
      
      if (mountedRef.current) {
        setSessions(Array.isArray(data) ? data : []);
        sessionsLoadedRef.current = true;
      }
    } catch (err: any) {
      if (mountedRef.current) {
        const errorMsg = err?.response?.status === 401 
          ? 'Сессия истекла. Пожалуйста, войдите снова.'
          : err?.response?.status === 404
          ? 'Эндпоинт не найден. Проверьте конфигурацию сервера.'
          : 'Не удалось загрузить сессии. Проверьте соединение.';
        setSessionsError(errorMsg);
        setSessions([]);
      }
    } finally {
      if (mountedRef.current) {
        setSessionsLoading(false);
      }
    }
  }, []);

  // Единственный useEffect с правильными зависимостями
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    
    // Загружаем данные ТОЛЬКО если ещё не загружены
    if (!profileLoadedRef.current) loadProfile();
    if (!policyLoadedRef.current) loadPolicy();
    if (!sessionsLoadedRef.current) loadSessions();
  }, [user?.id, loadProfile, loadPolicy, loadSessions]);

  // Обновление формы при изменении user
  useEffect(() => {
    if (user?.fullName || user?.email) {
      profileForm.setFieldsValue({
        fullName: user.fullName,
        email: user.email
      });
    }
  }, [user, profileForm]);

  // ================= ОБРАБОТЧИКИ =================

  const handleUpdateProfile = async (values: UserUpdate) => {
    setLoading(true);
    try {
      await updateProfile(values);
      await refreshUser?.();
      message.success('Профиль обновлён');
    } catch (err: any) {
      message.error(err.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestConfirmation = async () => {
    try {
      await requestConfirmation();
      message.info('Код отправлен на почту');
      setOtpModal({ visible: true, action: 'confirm' });
    } catch (err: any) {
      message.error(err.message || 'Ошибка отправки кода');
    }
  };

  const handleConfirmOtp = async () => {
    if (!otpValue.trim() || otpValue.length !== 6) {
      message.error('Введите 6-значный код');
      return;
    }
    setLoading(true);
    try {
      if (otpModal.action === 'confirm') {
        await confirmEmailAndEnable2fa(otpValue);
        message.success('Почта подтверждена. 2FA включена');
      } else if (otpModal.action === 'disable2fa') {
        await disableTwoFactor(otpValue);
        message.success('2FA отключена');
      }
      setOtpModal({ visible: false, action: null });
      setOtpValue('');
      await refreshUser?.();
    } catch (err: any) {
      message.error(err.message || 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2fa = () => {
    setOtpModal({ visible: true, action: 'disable2fa' });
  };

  const handleChangePassword = async (values: ChangePassword) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('Пароли не совпадают');
      return;
    }
    setLoading(true);
    try {
      await changePassword(values);
      passwordForm.resetFields();
      message.success('Пароль изменён');
    } catch (err: any) {
      message.error(err.message || 'Ошибка смены пароля');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePolicy = async (values: PolicyUpdate) => {
    setLoading(true);
    try {
      await updateSecurityPolicy(values);
      await loadPolicy();
      message.success('Политики обновлены');
    } catch (err: any) {
      message.error(err.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await revokeSession(sessionId);
      message.success('Сессия завершена');
      await loadSessions();
    } catch {
      message.error('Ошибка завершения сессии');
    }
  };

  const handleRevokeAllOther = async () => {
    try {
      await revokeAllOtherSessions();
      message.success('Все другие сессии завершены');
      await loadSessions();
    } catch {
      message.error('Ошибка');
    }
  };

  const handleLogoutAll = async () => {
    try {
      await logoutAllSessions();
      await logout();
      navigate('/login', { replace: true });
      message.success('Вы вышли из всех устройств');
    } catch {
      message.error('Ошибка выхода');
    }
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      await deleteAccount();
      await logout();
      navigate('/login', { replace: true });
      message.success('Аккаунт удалён');
    } catch (err: any) {
      message.error(err.message || 'Ошибка удаления');
      setLoading(false);
    }
  };

  // Если нет пользователя — показываем заглушку
  if (!user) {
    return (
      <div className="profile-wrapper">
        <Alert
          message="Требуется авторизация"
          description="Пожалуйста, войдите в систему для доступа к профилю"
          type="warning"
          showIcon
          className="mb-4"
          action={
            <Button type="primary" size="small" onClick={() => navigate('/login')}>
              Войти
            </Button>
          }
        />
      </div>
    );
  }

  // Статус аккаунта
  const statusConfig = () => {
    if (user.accountLocked) return { color: 'red' as const, text: 'Заблокирован', icon: <CloseOutlined /> };
    if (!user.emailConfirmed) return { color: 'orange' as const, text: 'Не подтверждён', icon: <WarningOutlined /> };
    if (user.twoFactorEnabled) return { color: 'green' as const, text: '2FA активна', icon: <SafetyOutlined /> };
    return { color: 'blue' as const, text: 'Активен', icon: <CheckOutlined /> };
  };
  const status = statusConfig();

  // ================= РЕНДЕР ВКЛАДОК =================

  const renderProfileTab = () => (
    <div className="tab-content">
      <Title level={4} className="tab-title">
        <UserOutlined /> Личные данные
      </Title>
      
      <Form form={profileForm} onFinish={handleUpdateProfile} layout="vertical" className="mb-4">
        <Form.Item name="fullName" label="Полное имя" rules={[{ required: true, message: 'Введите имя' }]}>
          <Input prefix={<UserOutlined />} placeholder="Иван Иванов" size="large" />
        </Form.Item>
        <Form.Item name="email" label="Email">
          <Input prefix={<MobileOutlined />} disabled size="large" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} icon={<EditOutlined />} size="large">
            Сохранить изменения
          </Button>
        </Form.Item>
      </Form>

      <Divider />

      <Descriptions column={1} bordered size="middle">
        <Descriptions.Item label="Роль">
          <Tag color="purple">{user.role}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Email подтверждён">
          {user.emailConfirmed ? (
            <Tag color="green"><CheckOutlined /> Да</Tag>
          ) : (
            <Tag color="orange"><WarningOutlined /> Нет</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Двухфакторная аутентификация">
          {user.twoFactorEnabled ? (
            <Tag color="green"><SafetyOutlined /> Включена</Tag>
          ) : (
            <Tag>Отключена</Tag>
          )}
        </Descriptions.Item>
      </Descriptions>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="tab-content">
      <Title level={4} className="tab-title">
        <LockOutlined /> Безопасность
      </Title>

      <Card size="small" title="Смена пароля" className="security-card mb-3">
        <Form form={passwordForm} onFinish={handleChangePassword} layout="vertical">
          <Form.Item name="oldPassword" label="Текущий пароль" rules={[{ required: true, message: 'Введите пароль' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="••••••••" size="large" />
          </Form.Item>
          <Form.Item name="newPassword" label="Новый пароль" rules={[{ required: true, min: 8, message: 'Минимум 8 символов' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="••••••••" size="large" />
          </Form.Item>
          <Form.Item name="confirmPassword" label="Подтвердите пароль" dependencies={['newPassword']} rules={[
            { required: true, message: 'Подтвердите пароль' },
            ({ getFieldValue }) => ({
              validator: (_, value) => !value || getFieldValue('newPassword') === value 
                ? Promise.resolve() 
                : Promise.reject(new Error('Пароли не совпадают'))
            })
          ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="••••••••" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} size="large">
              <LockOutlined /> Сменить пароль
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card size="small" title="Двухфакторная аутентификация" className="security-card">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div className="flex-center" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <Text strong>Статус:</Text>
            <Tag color={user.twoFactorEnabled ? 'green' : 'default'} style={{ fontSize: 13 }}>
              {user.twoFactorEnabled ? 'Включена' : 'Отключена'}
            </Tag>
          </div>
          
          {!user.emailConfirmed ? (
            <Button type="primary" onClick={handleRequestConfirmation} loading={loading} size="large" block>
              Подтвердить почту и включить 2FA
            </Button>
          ) : user.twoFactorEnabled ? (
            <Button danger onClick={handleDisable2fa} size="large" block>
              <UnlockOutlined /> Отключить 2FA
            </Button>
          ) : null}
          
          <Text type="secondary" style={{ fontSize: 13, textAlign: 'center' }}>
            {user.emailConfirmed 
              ? 'При входе потребуется код из почты' 
              : 'Подтвердите почту для активации защиты'}
          </Text>
        </Space>
      </Card>
    </div>
  );

  const renderPolicyTab = () => (
    <div className="tab-content">
      <Title level={4} className="tab-title">
        <SafetyOutlined /> Политики безопасности
      </Title>
      
      {policy ? (
        <Form form={policyForm} onFinish={handleUpdatePolicy} layout="vertical" className="policy-card">
          <Form.Item name="passwordExpirationDays" label="Срок действия пароля (дни)" tooltip="Через сколько дней пароль потребует смены">
            <Input type="number" min={1} max={365} size="large" />
          </Form.Item>
          <Form.Item name="maxFailedAttempts" label="Макс. попыток входа" tooltip="После скольких неудачных попыток аккаунт блокируется">
            <Input type="number" min={1} max={10} size="large" />
          </Form.Item>
          <Form.Item name="lockDurationSeconds" label="Длительность блокировки (секунды)" tooltip="На сколько секунд блокируется аккаунт">
            <Input type="number" min={60} max={86400} size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} size="large">
              <SafetyOutlined /> Сохранить политики
            </Button>
          </Form.Item>
        </Form>
      ) : (
        <Alert 
          message="Политики недоступны" 
          description="Управление политиками доступно только администраторам" 
          type="info" 
          showIcon 
          className="mb-4"
        />
      )}
    </div>
  );

  // Вкладка сессий
  const renderSessionsTab = () => (
    <div className="tab-content">
      <Title level={4} className="tab-title">
        <LaptopOutlined /> Активные сессии
      </Title>
      
      <Alert
        message="Управление устройствами"
        description="Здесь отображаются все устройства, с которых выполнен вход. Вы можете завершить любую сессию."
        type="info" 
        showIcon 
        className="mb-4"
      />

      {sessionsLoading ? (
        <div className="flex-center" style={{ padding: '48px 24px' }}>
          <Spin size="large" tip="Загрузка сессий..." />
        </div>
      ) : sessionsError ? (
        <div className="sessions-empty">
          <WarningOutlined style={{ fontSize: 48, color: 'var(--warning)', marginBottom: 16 }} />
          <Text strong className="sessions-empty-title">Не удалось загрузить</Text>
          <Text type="secondary" className="sessions-empty-desc">{sessionsError}</Text>
          <Button 
            type="primary" 
            onClick={loadSessions} 
            icon={<ReloadOutlined />} 
            className="mt-3"
            loading={sessionsLoading}
          >
            Повторить
          </Button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="sessions-empty">
          <LaptopOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <Text strong className="sessions-empty-title">Нет активных сессий</Text>
          <Text type="secondary" className="sessions-empty-desc">
            После входа с других устройств они появятся здесь
          </Text>
        </div>
      ) : (
        <List
          itemLayout="horizontal"
          dataSource={sessions}
          className="sessions-list"
          renderItem={(session) => (
            <List.Item
              actions={[
                session.currentSession ? (
                  <Tag color="blue" style={{ fontSize: 12 }}>
                    <CheckOutlined /> Текущее
                  </Tag>
                ) : (
                  <Popconfirm
                    title="Завершить сессию?"
                    description="Пользователь будет разлогинен на этом устройстве"
                    onConfirm={() => handleRevokeSession(session.sessionId)}
                    okText="Да" 
                    cancelText="Нет"
                    okButtonProps={{ danger: true }}
                  >
                    <Button danger size="small">Завершить</Button>
                  </Popconfirm>
                )
              ]}
            >
              <List.Item.Meta
                avatar={
                  <div style={{ 
                    width: 48, height: 48, borderRadius: 12, 
                    background: 'var(--accent-gradient)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: 20
                  }}>
                    <LaptopOutlined />
                  </div>
                }
                title={
                  <Space align="center" style={{ flexWrap: 'wrap' }}>
                    <Text strong style={{ fontSize: 15 }}>{session.deviceName}</Text>
                    {session.currentSession && <Tag color="green" style={{ fontSize: 11 }}>Активно</Tag>}
                    <Tag color={session.country === 'LOCAL' ? 'default' : 'blue'} style={{ fontSize: 11 }}>
                      <GlobalOutlined /> {session.country}
                    </Tag>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      <GlobalOutlined /> {session.ip}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      <ClockCircleOutlined /> Активность: {new Date(session.lastActiveAt).toLocaleString('ru-RU')}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {session.browser} на {session.os}
                    </Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}

      {sessions.length > 0 && (
        <>
          <Divider />
          <Space wrap>
            <Tooltip title="Завершить все сессии, кроме текущей">
              <Button 
                onClick={handleRevokeAllOther} 
                disabled={sessions.filter(s => !s.currentSession).length === 0 || sessionsLoading}
                icon={<LogoutOutlined />}
              >
                Завершить другие
              </Button>
            </Tooltip>
            <Popconfirm
              title="Выйти из всех устройств?"
              description="Вы будете разлогинены на всех устройствах, включая текущее"
              onConfirm={handleLogoutAll}
              okText="Да, выйти везде" 
              cancelText="Отмена"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<LogoutOutlined />}>
                Выйти везде
              </Button>
            </Popconfirm>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadSessions}
              loading={sessionsLoading}
            >
              Обновить
            </Button>
          </Space>
        </>
      )}
    </div>
  );

  // ================= ОСНОВНОЙ РЕНДЕР =================

  return (
    <div className="profile-wrapper">
      <Card className="profile-header-card" bordered={false}>
        <Space align="center" style={{ width: '100%' }}>
          <div className="profile-avatar-large">
            {user.fullName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
          </div>
          <div className="profile-header-info">
            <Title level={3} className="profile-header-name" style={{ margin: 0 }}>
              {user.fullName || 'Пользователь'}
            </Title>
            <Text className="profile-header-email">{user.email}</Text>
            <div className="profile-header-tags">
              <Tag color={status.color} icon={status.icon}>{status.text}</Tag>
              {user.twoFactorEnabled && (
                <Tag color="green" icon={<SafetyOutlined />}>2FA</Tag>
              )}
              <Tag color="purple">{user.role}</Tag>
            </div>
          </div>
        </Space>
      </Card>

      <Card className="profile-card" bordered={false}>
        <Tabs 
          activeKey={activeTab} 
          onChange={(k) => setActiveTab(k as ProfileTab)} 
          centered
          size="large"
        >
          <TabPane tab={<span><UserOutlined /> Профиль</span>} key="profile">
            {renderProfileTab()}
          </TabPane>
          <TabPane tab={<span><LockOutlined /> Безопасность</span>} key="security">
            {renderSecurityTab()}
          </TabPane>
          <TabPane tab={<span><SafetyOutlined /> Политики</span>} key="policy">
            {renderPolicyTab()}
          </TabPane>
          <TabPane tab={<span><LaptopOutlined /> Сессии {sessions.length > 0 && `(${sessions.length})`}</span>} key="sessions">
            {renderSessionsTab()}
          </TabPane>
        </Tabs>

        <Divider />

        <div className="danger-zone">
          <Title level={5} className="danger-title">
            <DeleteOutlined /> Опасная зона
          </Title>
          <Text className="danger-text">
            Удаление аккаунта необратимо. Все ваши данные, настройки и сессии будут безвозвратно удалены.
          </Text>
          <Popconfirm
            title="Удалить аккаунт?"
            description="Это действие нельзя отменить. Вы уверены?"
            onConfirm={handleDeleteAccount}
            okText="Удалить" 
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />} loading={loading} size="large">
              Удалить аккаунт
            </Button>
          </Popconfirm>
        </div>

        <Divider />
        
        <Button 
          block 
          onClick={logout} 
          icon={<LogoutOutlined />} 
          size="large"
          className="logout-button"
        >
          Выйти из аккаунта
        </Button>
      </Card>

      <Modal
        title={
          <Space>
            <SafetyOutlined style={{ color: 'var(--accent-primary)' }} />
            {otpModal.action === 'confirm' ? 'Подтверждение' : 'Отключение 2FA'}
          </Space>
        }
        open={otpModal.visible}
        onOk={handleConfirmOtp}
        onCancel={() => { setOtpModal({ visible: false, action: null }); setOtpValue(''); }}
        okText="Подтвердить"
        cancelText="Отмена"
        confirmLoading={loading}
        centered
        closable={!loading}
      >
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 16 }}>
          {otpModal.action === 'confirm' 
            ? 'Введите код из письма для подтверждения почты и включения 2FA'
            : 'Введите код из письма для отключения 2FA'}
        </Text>
        
        <div className="otp-input-wrapper">
          <Input
            className="otp-input"
            value={otpValue}
            onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            autoFocus
            onPressEnter={handleConfirmOtp}
            disabled={loading}
            placeholder="000000"
          />
        </div>
        
        <Text type="secondary" className="otp-hint">
          Код отправлен на <strong>{user.email}</strong>
        </Text>
        
        <Button 
          type="link" 
          size="small" 
          onClick={handleRequestConfirmation}
          disabled={loading}
          style={{ display: 'block', margin: '12px auto 0' }}
        >
          <ReloadOutlined /> Отправить код повторно
        </Button>
      </Modal>
    </div>
  );
};

export default ProfilePage;