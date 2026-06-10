import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Alert, Card, Typography, message } from 'antd';
import {
  LockOutlined, EyeOutlined, EyeInvisibleOutlined,
  ArrowRightOutlined, SafetyOutlined, MailOutlined
} from '@ant-design/icons';
import './LoginPage.css';

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role) {
      navigate('/map', { replace: true });
    }
  }, [user, navigate]);

  const onFinish = async (values: { email: string; password: string }) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await login(values.email, values.password);

      if (response?.requireOtp) {
        message.info('🔐 Введите код из письма');
        navigate('/auth/verify-otp', { state: { email: values.email } });
        return;
      }

      message.success('🎉 Добро пожаловать!');
      navigate('/map', { replace: true });
    } catch (err: unknown) {
      let errorMsg = 'Ошибка входа. Проверьте данные. Не удалось войти';
      if (err instanceof Error) errorMsg = err.message;
      message.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      {/* Анимированный фон */}
      <div className="login-background">
        <div className="bg-gradient" />
        <div className="bg-orb orb-1" />
        <div className="bg-orb orb-2" />
      </div>

      <div className="login-content">
        <Card className="login-card" bordered={false}>
          {/* Логотип */}
          <div className="login-header">
            <div className="logo-wrapper">
              <SafetyOutlined className="logo-icon" />
              <span className="ai-badge">AI</span>
            </div>
            <Title level={2} className="login-title">FlowDetect</Title>
            <Text className="login-subtitle">Анализ пассажиропотоков</Text>
          </div>

          {/* Ошибка */}
          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              closable
              className="login-alert"
              afterClose={() => setError(null)}
            />
          )}

          {/* Форма */}
          <Form
            form={form}
            name="login"
            onFinish={onFinish}
            layout="vertical"
            size="large"
            className="login-form"
            disabled={isSubmitting}
            autoComplete="off"
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Введите email' },
                { type: 'email', message: 'Неверный формат' }
              ]}
            >
              <Input
                prefix={<MailOutlined className="input-icon" />}
                placeholder="Email"
                className="login-input"
                autoComplete="email"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Введите пароль' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="input-icon" />}
                placeholder="Пароль"
                className="login-input"
                autoComplete="current-password"
                iconRender={(visible) =>
                  visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
                }
              />
            </Form.Item>

            {/* Забыли пароль */}
            <div className="forgot-row">
              <Link to="/auth/forgot-password" className="forgot-link">
                Забыли пароль?
              </Link>
            </div>

            {/* Кнопка входа — ИСПРАВЛЕНА */}
            <Form.Item className="submit-row">
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={isSubmitting}
                className="login-button"
              >
                {isSubmitting ? (
                  <span className="btn-loading">
                    <span className="spinner" />
                    Вход...
                  </span>
                ) : (
                  <span className="btn-content">
                    Войти
                    <ArrowRightOutlined className="btn-arrow" />
                  </span>
                )}
              </Button>
            </Form.Item>
          </Form>

          {/* Футер */}
          <div className="login-footer">
            <Text className="footer-text">
              Нет аккаунта?{' '}
              <Link to="/registration" className="footer-link">
                Регистрация
              </Link>
            </Text>
          </div>
        </Card>

        {/* Копирайт */}
        <Text className="login-copyright">
          © {new Date().getFullYear()} FlowDetect
        </Text>
      </div>
    </div>
  );
};

export default LoginPage;