import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Alert, Typography, 
    Card, Space, message,  Result, Divider } from 'antd';
import { MailOutlined, SafetyOutlined, KeyOutlined, CheckCircleOutlined,
  ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';

import { forgotPassword, verifyOtpForPasswordReset, 
  resetPassword, resendOtp 
} from '../api/endpoints/auth';
import './ForgotPasswordPage.css';

const { Title, Text } = Typography;

type FlowStep = 'email' | 'otp' | 'reset' | 'success';

const ForgotPasswordPage: React.FC = () => {
  const [form] = Form.useForm();
  const [step, setStep] = useState<FlowStep>('email');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [email, setEmail] = useState('');
  
  const navigate = useNavigate();
  
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 🔹 Шаг 1: Отправка кода на email
  const handleSendCode = async (values: { email: string }) => {
    setError(null);
    setIsLoading(true);
    
    try {
      await forgotPassword(values.email);  // ← Ваш API-эндпоинт
      
      setEmail(values.email);
      setStep('otp');
      setCountdown(60);
      message.success('📩 Код отправлен на вашу почту');
      
      // Фокус на первом поле OTP
      setTimeout(() => otpInputsRef.current[0]?.focus(), 100);
      
    } catch (err: any) {
      const errorMsg = err.message || 'Не удалось отправить код';
      setError(errorMsg);
      message.error('Ошибка: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔹 Шаг 2: Верификация OTP
  const handleVerifyOtp = async () => {
    const otp = form.getFieldValue('otp');
    
    if (!otp || otp.length !== 6) {
      setError('Введите 6-значный код');
      return;
    }
    
    setError(null);
    setIsLoading(true);
    
    try {
      await verifyOtpForPasswordReset({ email, otp });  // ← Ваш API-эндпоинт
      
      setStep('reset');
      message.success('✅ Код подтверждён');
      
    } catch (err: any) {
      const errorMsg = err.message || 'Неверный или истёкший код';
      setError(errorMsg);
      message.error('Ошибка: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔹 Шаг 3: Сброс пароля
  const handleResetPassword = async (values: { newPassword: string; confirmPassword: string }) => {
    setError(null);
    
    if (values.newPassword !== values.confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    
    if (values.newPassword.length < 8) {
      setError('Пароль должен содержать минимум 8 символов');
      return;
    }
    
    const otp = form.getFieldValue('otp');
    setIsLoading(true);
    
    try {
      await resetPassword({ email, otp, newPassword: values.newPassword });
      
      setStep('success');
      message.success('🎉 Пароль изменён!');
      
    } catch (err: any) {
      const errorMsg = err.message || 'Не удалось изменить пароль';
      setError(errorMsg);
      message.error('Ошибка: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔹 Повторная отправка кода
  const handleResendCode = async () => {
    if (countdown > 0 || !email) return;
    
    setIsLoading(true);
    try {
      await resendOtp(email);
      setCountdown(60);
      message.success('📩 Новый код отправлен');
    } catch {
      message.error('Не удалось отправить код');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = String(value).replace(/\D/g, '').slice(-1);
    const currentOtp = form.getFieldValue('otp') || '';
    const newOtp = currentOtp.substring(0, index) + digit + currentOtp.substring(index + 1);
    
    form.setFieldValue('otp', newOtp);
    
    // Авто-переход к следующему полю
    if (digit && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
    
    // Авто-верификация при вводе 6 цифр
    if (newOtp.length === 6 && digit) {
      handleVerifyOtp();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !e.currentTarget.value && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const renderEmailStep = () => (
    <Form
      form={form}
      onFinish={handleSendCode}
      layout="vertical"
      size="large"
      disabled={isLoading}
    >
      <Form.Item
        name="email"
        rules={[
          { required: true, message: 'Введите email' },
          { type: 'email', message: 'Некорректный формат email' }
        ]}
      >
        <Input 
          prefix={<MailOutlined className="input-icon" />} 
          placeholder="example@mail.ru" 
          className="fp-input"
          autoComplete="email"
          autoFocus
        />
      </Form.Item>

      <Form.Item className="fp-submit">
        <Button 
          type="primary" 
          htmlType="submit" 
          block 
          loading={isLoading}
          className="fp-button"
        >
          Отправить код <ArrowLeftOutlined rotate={180} style={{ marginLeft: 8 }} />
        </Button>
      </Form.Item>
    </Form>
  );

  const renderOtpStep = () => {
    const otpValue = form.getFieldValue('otp') || '';
    
    return (
      <Form form={form} layout="vertical">
        <Alert
          message="Проверьте почту"
          description={`Мы отправили 6-значный код на ${email}`}
          type="info"
          showIcon
          className="fp-alert"
        />

        {/* Кастомный OTP: 6 полей */}
        <Form.Item label="Код подтверждения" className="otp-label">
          <div className="otp-container">
            {[...Array(6)].map((_, i) => (
              <Input
                key={i}
                ref={(el) => { 
                  if (el?.input) {
                    otpInputsRef.current[i] = el.input as HTMLInputElement;
                  }
                }}
                maxLength={1}
                className="otp-digit"
                value={(otpValue[i] || '')}
                onChange={(e) => {
                  const input = e.target as HTMLInputElement;
                  handleOtpChange(i, input.value);
                }}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                inputMode="numeric"
                pattern="[0-9]*"
              />
            ))}
          </div>
          {/* Скрытое поле для Form.Item */}
          <input type="hidden" name="otp" value={otpValue} />
        </Form.Item>

        <Form.Item className="fp-submit">
          <Button 
            type="primary" 
            htmlType="button"
            block 
            loading={isLoading}
            className="fp-button"
            onClick={handleVerifyOtp}
            disabled={otpValue.length !== 6}
          >
            Подтвердить код <SafetyOutlined style={{ marginLeft: 8 }} />
          </Button>
        </Form.Item>

        <Space className="fp-resend" size={4}>
          <Button 
            type="link" 
            onClick={handleResendCode} 
            disabled={countdown > 0 || isLoading}
            className="fp-resend-btn"
          >
            {countdown > 0 
              ? `Отправить ещё раз через ${countdown}с` 
              : 'Отправить код ещё раз'}
          </Button>
          {countdown > 0 && <ReloadOutlined spin style={{ marginLeft: 4 }} />}
        </Space>
      </Form>
    );
  };

  const renderResetStep = () => (
    <Form
      form={form}
      onFinish={handleResetPassword}
      layout="vertical"
      size="large"
      disabled={isLoading}
    >
      <Form.Item
        name="newPassword"
        label="Новый пароль"
        rules={[
          { required: true, message: 'Введите пароль' },
          { min: 8, message: 'Минимум 8 символов' },
          { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: 'Используйте заглавные, строчные буквы и цифры' }
        ]}
        help="Пароль должен содержать заглавные и строчные буквы, а также цифры"
      >
        <Input.Password 
          prefix={<KeyOutlined className="input-icon" />} 
          placeholder="••••••••" 
          className="fp-input"
          autoComplete="new-password"
        />
      </Form.Item>

      <Form.Item
        name="confirmPassword"
        label="Подтвердите пароль"
        dependencies={['newPassword']}
        rules={[
          { required: true, message: 'Подтвердите пароль' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('newPassword') === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error('Пароли не совпадают'));
            },
          }),
        ]}
      >
        <Input.Password 
          prefix={<KeyOutlined className="input-icon" />} 
          placeholder="••••••••" 
          className="fp-input"
          autoComplete="new-password"
        />
      </Form.Item>

      <Form.Item className="fp-submit">
        <Button 
          type="primary" 
          htmlType="submit" 
          block 
          loading={isLoading}
          className="fp-button"
        >
          Сменить пароль <CheckCircleOutlined style={{ marginLeft: 8 }} />
        </Button>
      </Form.Item>
    </Form>
  );

  const renderSuccessStep = () => (
    <Result
      status="success"
      title="Пароль успешно изменён!"
      subTitle="Теперь вы можете войти в систему с новым паролем"
      extra={[
        <Button 
          type="primary" 
          key="login" 
          onClick={() => navigate('/login')}
          className="fp-button"
        >
          Войти в систему
        </Button>
      ]}
      className="fp-result"
    />
  );

  const stepTitles: Record<FlowStep, { title: string; subtitle: string }> = {
    email: {
      title: 'Восстановление пароля',
      subtitle: 'Введите email для получения кода подтверждения'
    },
    otp: {
      title: 'Введите код',
      subtitle: `Код отправлен на ${email}`
    },
    reset: {
      title: 'Новый пароль',
      subtitle: 'Придумайте надёжный пароль для вашего аккаунта'
    },
    success: {
      title: 'Готово!',
      subtitle: 'Ваш пароль успешно изменён'
    }
  };

  return (
    <div className="forgot-password-page">
      {/* Фон */}
      <div className="fp-background">
        <div className="bg-gradient" />
        <div className="bg-shapes">
          <div className="shape shape-1" />
          <div className="shape shape-2" />
        </div>
      </div>

      {/* Карточка */}
      <div className="fp-container">
        <Card className="fp-card" bordered={false}>
          
          {/* Хедер */}
          <div className="fp-header">
            <Link to="/login" className="fp-back-link">
              <ArrowLeftOutlined /> Назад ко входу
            </Link>
            
            <div className="fp-logo">
              <SafetyOutlined className="logo-icon" />
            </div>
            <Title level={3} className="fp-title">{stepTitles[step].title}</Title>
            <Text className="fp-subtitle">{stepTitles[step].subtitle}</Text>
          </div>

          {/* Ошибка */}
          {error && (
            <Alert 
              message="Ошибка" 
              description={error} 
              type="error" 
              showIcon 
              closable 
              className="fp-alert"
            />
          )}

          {/* Контент шага */}
          <div className="fp-content">
            {step === 'email' && renderEmailStep()}
            {step === 'otp' && renderOtpStep()}
            {step === 'reset' && renderResetStep()}
            {step === 'success' && renderSuccessStep()}
          </div>

          {/* Футер */}
          {step !== 'success' && <Divider className="fp-divider" />}
          
          <Space direction="vertical" className="fp-footer align-center" size={4}>
            <Text type="secondary" className="fp-help">
              Нужна помощь?{' '}
              <a href="mailto:support@flowdetect.ru" className="fp-link">
                support@flowdetect.ru
              </a>
            </Text>
            <Text type="secondary" className="fp-security">
              🔒 Ваши данные защищены
            </Text>
          </Space>
          
        </Card>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;