import React, { useState } from 'react';
import { Button, Form, Input, Typography, Card, Row, Col, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { register } from '../api/endpoints/auth';
import { UserOutlined, MailOutlined, PhoneOutlined, LockOutlined } from '@ant-design/icons';

const { Title } = Typography;

// Простая маска и валидация телефона
const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('8')) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  } else if (digits.startsWith('7')) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  } else if (digits.length === 0) {
    return '';
  } else {
    return `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`;
  }
};

const validatePhone = (_: any, value: string) => {
  if (!value) return Promise.resolve(); // необязательное поле

  const clean = value.replace(/\D/g, '');
  if (clean.length === 0) return Promise.resolve();

  // Допустимы только +7 или 8 в начале
  if (!(value.startsWith('+7') || value.startsWith('8'))) {
    return Promise.reject(new Error('Номер должен начинаться с +7 или 8'));
  }

  // Должно быть ровно 11 цифр
  if (clean.length !== 11) {
    return Promise.reject(new Error('Номер должен содержать 11 цифр'));
  }

  return Promise.resolve();
};

const RegisterPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: {
    email: string;
    password: string;
    fullName: string;
    phoneNumber: string;
  }) => {
    setLoading(true);
    try {
      // Очищаем номер от всего, кроме цифр, и приводим к +7
      let cleanPhone = '';
      if (values.phoneNumber) {
        const digits = values.phoneNumber.replace(/\D/g, '');
        if (digits.length === 11) {
          cleanPhone = digits.startsWith('8') ? '+7' + digits.slice(1) : digits;
        }
      }

      await register();
      message.success('Регистрация успешна! Теперь войдите в систему.');
      navigate('/login');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Ошибка регистрации';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Row justify="center">
      <Col xs={24} sm={20} md={12} lg={8}>
        <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <div className="text-center mb-4">
            <div className="inline-block p-3 rounded-full bg-blue-50 mb-3">
              <UserOutlined style={{ fontSize: 28, color: '#3B82F6' }} />
            </div>
            <Title level={3} style={{ marginBottom: 0, color: '#1F2937' }}>
              Регистрация
            </Title>
            <p className="text-gray-500 mt-2">Создайте свой аккаунт</p>
          </div>

          <Form
            name="register"
            onFinish={onFinish}
            layout="vertical"
            requiredMark={false}
          >
            <Form.Item name="fullName" label="ФИО (опционально)">
              <Input
                size="large"
                prefix={<UserOutlined className="text-gray-400" />}
                placeholder="Иванов Иван Иванович"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: 'Пожалуйста, введите email' },
                { type: 'email', message: 'Некорректный email' },
              ]}
            >
              <Input
                size="large"
                prefix={<MailOutlined className="text-gray-400" />}
                placeholder="user@example.com"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            <Form.Item
              name="phoneNumber"
              label="Телефон (опционально)"
              rules={[{ validator: validatePhone }]}
            >
              <Input
                size="large"
                prefix={<PhoneOutlined className="text-gray-400" />}
                placeholder="+7 (999) 123-45-67"
                style={{ borderRadius: 8 }}
                onChange={(e) => {
                  let val = e.target.value;
                  // Разрешаем только цифры, +, пробелы, скобки, дефисы
                  val = val.replace(/[^\d+()\s-]/g, '');
                  if (val.length > 18) return;
                  e.target.value = formatPhone(val);
                }}
                // Для корректного отображения при фокусе/без фокуса
                // Можно также использовать Form.Item getValueFromEvent, но проще через onChange
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="Пароль"
              rules={[
                { required: true, message: 'Пожалуйста, введите пароль' },
                { min: 4, message: 'Пароль должен быть не менее 4 символов' },
              ]}
            >
              <Input.Password
                size="large"
                prefix={<LockOutlined className="text-gray-400" />}
                placeholder="••••••••"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                size="large"
                block
                style={{
                  height: 48,
                  borderRadius: 8,
                  background: '#4F46E5',
                  borderColor: '#4F46E5',
                }}
              >
                Зарегистрироваться
              </Button>
            </Form.Item>

            <div className="text-center mt-2">
              <a
                href="/login"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/login');
                }}
                className="text-indigo-600 hover:text-indigo-800"
              >
                Уже есть аккаунт? Войти
              </a>
            </div>
          </Form>
        </Card>
      </Col>
    </Row>
  );
};

export default RegisterPage;