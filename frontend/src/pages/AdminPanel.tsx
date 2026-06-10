import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Card, Table, Button, Input, Select, Modal,
  Form, message, Popconfirm, Tag, Space, Tooltip,
  Typography, Drawer, Alert
} from 'antd';
import {
  UserAddOutlined, SearchOutlined, ReloadOutlined,
  LockOutlined, UnlockOutlined, DeleteOutlined,
  KeyOutlined, SafetyOutlined, EyeOutlined, WarningOutlined
} from '@ant-design/icons';
import {
  adminGetUsers, adminCreateUser, adminDeleteUser,
  adminLockUser, adminUnlockUser, adminChangeRole,
  adminResetPassword, adminGetPolicy, adminUpdatePolicy
} from '../api/endpoints/admin';
import type {
  UserGetResponse, PolicyUpdate, UserCreateRequest,
  UserListResponse
} from '../api/types/user';
import './AdminPanel.css';

const { Title, Text } = Typography;
const { Option } = Select;

const AdminPanel: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserGetResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('USER');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  // Модальные окна
  const [createModal, setCreateModal] = useState(false);
  const [policyDrawer, setPolicyDrawer] = useState<{
    visible: boolean;
    userId: number | null
  }>({ visible: false, userId: null });
  const [resetModal, setResetModal] = useState<{
    visible: boolean;
    userId: number | null;
    email: string
  }>({ visible: false, userId: null, email: '' });

  // Формы
  const [createForm] = Form.useForm<UserCreateRequest>();
  const [policyForm] = Form.useForm<PolicyUpdate>();
  const [resetForm] = Form.useForm<{
    password: string;
    confirmPassword: string
  }>();

  // Проверка прав доступа
  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      message.error('Доступ запрещён');
      navigate('/map', { replace: true });
    }
  }, [user, navigate]);

  // Загрузка пользователей
  const loadUsers = async () => {
    setTableLoading(true);
    try {
      const data: UserListResponse = await adminGetUsers(
        roleFilter,
        search || undefined,
        pagination.current - 1,
        pagination.pageSize
      );
      setUsers(data.content);
      setPagination(prev => ({
        ...prev,
        total: data.totalElements
      }));
    } catch (err: unknown) {
      let errorMsg = 'Ошибка загрузки пользователей';
      if (err instanceof Error) errorMsg = err.message;
      message.error(errorMsg);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadUsers();
    }
  }, [roleFilter, pagination.current, pagination.pageSize]);

  // Поиск
  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    loadUsers();
  };

  // Создание пользователя
  const handleCreateUser = async (values: UserCreateRequest) => {
    setLoading(true);
    try {
      await adminCreateUser(values);
      message.success('Пользователь создан');
      setCreateModal(false);
      createForm.resetFields();
      loadUsers();
    } catch (err: unknown) {
      let errorMsg = 'Ошибка создания';
      if (err instanceof Error) errorMsg = err.message;
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Удаление
  const handleDeleteUser = async (id: number) => {
    setLoading(true);
    try {
      await adminDeleteUser(id);
      message.success('Пользователь удалён');
      loadUsers();
    } catch {
      message.error('Ошибка удаления');
    } finally {
      setLoading(false);
    }
  };

  // Блокировка/разблокировка — ИСПРАВЛЕНО
  const handleToggleLock = async (id: number, locked: boolean) => {
    setLoading(true);
    try {
      if (locked) {
        await adminLockUser(id);
        message.success('Пользователь заблокирован');
      } else {
        await adminUnlockUser(id);
        message.success('Пользователь разблокирован');
      }
      // Обновляем список сразу после операции
      await loadUsers();
    } catch (err: unknown) {
      let errorMsg = 'Ошибка операции';
      if (err instanceof Error) errorMsg = err.message;
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Смена роли — ИСПРАВЛЕНО
  const handleChangeRole = async (id: number, role: string) => {
    setLoading(true);
    try {
      // Приводим роль к верхнему регистру для бэкенда
      await adminChangeRole(id, role.toUpperCase());
      message.success('Роль изменена');
      loadUsers();
    } catch {
      message.error('Ошибка смены роли');
    } finally {
      setLoading(false);
    }
  };

  // Сброс пароля
  const handleResetPassword = async () => {
    setLoading(true);
    try {
      const values = await resetForm.validateFields();
      if (values.password !== values.confirmPassword) {
        message.error('Пароли не совпадают');
        return;
      }
      if (resetModal.userId) {
        await adminResetPassword(resetModal.userId, values.password);
        message.success('Пароль сброшен');
        setResetModal({ visible: false, userId: null, email: '' });
        resetForm.resetFields();
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.error('Заполните все поля');
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Ошибка сброса пароля';
        message.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Политики
  const openPolicyDrawer = async (userId: number) => {
    setLoading(true);
    try {
      const policy = await adminGetPolicy(userId);
      policyForm.setFieldsValue({
        passwordExpirationDays: policy.passwordExpirationDays,
        maxFailedAttempts: policy.maxFailedAttempts,
        lockDurationSeconds: policy.lockDurationSeconds
      });
      setPolicyDrawer({ visible: true, userId });
    } catch {
      message.error('Ошибка загрузки политик');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePolicy = async () => {
    setLoading(true);
    try {
      const values = await policyForm.validateFields();
      if (policyDrawer.userId) {
        await adminUpdatePolicy(policyDrawer.userId, values);
        message.success('Политики обновлены');
        setPolicyDrawer({ visible: false, userId: null });
      }
    } catch {
      message.error('Ошибка обновления политик');
    } finally {
      setLoading(false);
    }
  };

  // Если не админ — показываем заглушку
  if (user?.role !== 'ADMIN') {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Alert
          message="Доступ запрещён"
          description="Только администраторы могут управлять пользователями"
          type="error"
          showIcon
          action={
            <Button type="primary" onClick={() => navigate('/map')}>
              На главную
            </Button>
          }
        />
      </div>
    );
  }

  // Колонки таблицы
  const columns = [
    {
      title: 'Пользователь',
      key: 'user',
      width: 220,
      render: (_rule: unknown, record: UserGetResponse) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.fullName || '—'}</Text>
          <Text type="secondary" copyable>{record.email}</Text>
          {record.lastLoginAt && (
            <Text style={{ fontSize: 11 }}>
              Вход: {new Date(record.lastLoginAt).toLocaleDateString('ru-RU')}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Роль',
      key: 'role',
      width: 120,
      render: (_rule: unknown, record: UserGetResponse) => (
        <Select
          size="small"
          value={record.role}
          style={{ width: '100%' }}
          onChange={(value) => handleChangeRole(record.id, value)}
          disabled={record.role === 'ADMIN' && user?.email === record.email}
          loading={loading}
        >
          <Option value="USER">USER</Option>
          <Option value="ADMIN">ADMIN</Option>
          <Option value="LoGISTIC">LoGISTIC</Option>
          <Option value="OTHER">OTHER</Option>
        </Select>
      ),
    },
    {
      title: 'Статус',
      key: 'status',
      width: 180,
      render: (_rule: unknown, record: UserGetResponse) => (
        <Space direction="vertical" size={4}>
          {/* Основной статус */}
          <Tag
            color={
              record.accountLocked ? 'red' :
                record.emailConfirmed ? 'green' : 'orange'
            }
            style={{ fontWeight: 500 }}
          >
            {record.accountLocked ? (
              <><LockOutlined /> Заблокирован</>
            ) : record.emailConfirmed ? (
              <><EyeOutlined /> Активен</>
            ) : (
              <><WarningOutlined /> Не подтверждён</>
            )}
          </Tag>

          {/* Информация о временной блокировке */}
          {record.accountLocked && record.lockUntil && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              До: {new Date(record.lockUntil).toLocaleString('ru-RU')}
            </Text>
          )}

          {/* 2FA индикатор */}
          {record.twoFactorEnabled && (
            <Tag color="blue" style={{ fontSize: 11 }}>
              <SafetyOutlined /> 2FA
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 240,
      fixed: 'right' as const,
      render: (_rule: unknown, record: UserGetResponse) => (
        <Space wrap size={[0, 8]}>
          {/* Блокировка/разблокировка */}
          <Tooltip title={record.accountLocked ? 'Разблокировать' : 'Заблокировать'}>
            <Button
              size="small"
              type={record.accountLocked ? 'default' : 'primary'}
              danger={!record.accountLocked}
              icon={record.accountLocked ? <UnlockOutlined /> : <LockOutlined />}
              onClick={() => handleToggleLock(record.id, !record.accountLocked)}
              disabled={record.email === user?.email || loading}
              loading={loading}
            />
          </Tooltip>

          {/* Сброс пароля */}
          <Tooltip title="Сбросить пароль">
            <Button
              size="small"
              icon={<KeyOutlined />}
              onClick={() => setResetModal({
                visible: true,
                userId: record.id,
                email: record.email
              })}
              disabled={loading}
            />
          </Tooltip>

          {/* Политики */}
          <Tooltip title="Политики безопасности">
            <Button
              size="small"
              icon={<SafetyOutlined />}
              onClick={() => openPolicyDrawer(record.id)}
              disabled={loading}
            />
          </Tooltip>

          {/* Удаление */}
          <Popconfirm
            title="Удалить пользователя?"
            description="Это действие нельзя отменить"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
            disabled={loading}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={record.email === user?.email || loading}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="admin-panel">
      {/* Заголовок */}
      <Card
        title={
          <Space align="center">
            <Title level={4} style={{ margin: 0 }}>
              Управление пользователями
            </Title>
            <Tag color="purple">{users.length} пользователей</Tag>
          </Space>
        }
        extra={
          <Space wrap>
            <Input
              placeholder="Поиск по email..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 200 }}
              allowClear
              size="middle"
            />
            <Select
              value={roleFilter}
              onChange={setRoleFilter}
              style={{ width: 120 }}
              size="middle"
            >
              <Option value="USER">USER</Option>
              <Option value="ADMIN">ADMIN</Option>
              <Option value="LoGISTIC">LoGISTIC</Option>
              <Option value="OTHER">OTHER</Option>
            </Select>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadUsers}
              loading={tableLoading}
              size="middle"
            >
              Обновить
            </Button>
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={() => setCreateModal(true)}
              size="middle"
            >
              Создать
            </Button>
          </Space>
        }
      >
        {/* Таблица пользователей */}
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={tableLoading}
          pagination={{
            ...pagination,
            onChange: (page, pageSize) =>
              setPagination(prev => ({ ...prev, current: page, pageSize })),
            showSizeChanger: true,
            showTotal: (total) => `Всего: ${total}`,
            pageSizeOptions: ['10', '20', '50']
          }}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* Модальное окно: создание пользователя */}
      <Modal
        title="Создать пользователя"
        open={createModal}
        onCancel={() => {
          setCreateModal(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        confirmLoading={loading}
        okText="Создать"
        cancelText="Отмена"
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateUser}
          initialValues={{ role: 'USER' }}
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Введите email' },
              { type: 'email', message: 'Неверный формат' }
            ]}
          >
            <Input placeholder="user@example.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Пароль"
            rules={[
              { required: true, message: 'Введите пароль' },
              { min: 8, message: 'Минимум 8 символов' }
            ]}
            extra="Пароль должен содержать минимум 8 символов"
          >
            <Input.Password placeholder="••••••••" />
          </Form.Item>
          <Form.Item
            name="fullName"
            label="Полное имя"
            rules={[{ required: true, message: 'Введите имя' }]}
          >
            <Input placeholder="Иван Иванов" />
          </Form.Item>
          <Form.Item name="role" label="Роль">
            <Select>
              <Option value="USER">USER</Option>
              <Option value="ADMIN">ADMIN</Option>
              <Option value="LoGISTIC">LoGISTIC</Option>
              <Option value="OTHER">OTHER</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно: сброс пароля */}
      <Modal
        title={`Сброс пароля: ${resetModal.email}`}
        open={resetModal.visible}
        onCancel={() => {
          setResetModal({ visible: false, userId: null, email: '' });
          resetForm.resetFields();
        }}
        onOk={handleResetPassword}
        confirmLoading={loading}
        okText="Сбросить"
        cancelText="Отмена"
      >
        <Form form={resetForm} layout="vertical">
          <Alert
            message="Пользователь сможет войти с новым паролем"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form.Item
            name="password"
            label="Новый пароль"
            rules={[
              { required: true, message: 'Введите пароль' },
              { min: 8, message: 'Минимум 8 символов' }
            ]}
          >
            <Input.Password placeholder="••••••••" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Подтвердите пароль"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Подтвердите пароль' },
              ({ getFieldValue }) => ({
                validator: (_, value) => !value || getFieldValue('password') === value
                  ? Promise.resolve()
                  : Promise.reject('Пароли не совпадают')
              })
            ]}
          >
            <Input.Password placeholder="••••••••" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer: политики безопасности */}
      <Drawer
        title={
          <Space>
            <SafetyOutlined />
            Политики безопасности
          </Space>
        }
        placement="right"
        width={400}
        open={policyDrawer.visible}
        onClose={() => setPolicyDrawer({ visible: false, userId: null })}
        extra={
          <Button
            type="primary"
            onClick={handleUpdatePolicy}
            loading={loading}
          >
            Сохранить
          </Button>
        }
      >
        <Form form={policyForm} layout="vertical">
          <Alert
            message="Изменения применяются немедленно"
            description="Новые настройки будут использованы при следующем входе пользователя"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
          <Form.Item
            name="passwordExpirationDays"
            label="Срок действия пароля (дни)"
            tooltip="Через сколько дней потребовать смену пароля"
          >
            <Input type="number" min={1} max={365} />
          </Form.Item>
          <Form.Item
            name="maxFailedAttempts"
            label="Макс. попыток входа"
            tooltip="После скольких неудачных попыток блокировать аккаунт"
          >
            <Input type="number" min={1} max={10} />
          </Form.Item>
          <Form.Item
            name="lockDurationSeconds"
            label="Длительность блокировки (секунды)"
            tooltip="На сколько секунд блокировать аккаунт после превышения попыток"
          >
            <Input type="number" min={60} max={86400} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default AdminPanel;