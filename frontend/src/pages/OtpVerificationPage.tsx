import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
    Form, Input, Button, Alert, Typography, Card, message,
    Space, Result, Spin
} from 'antd';
import { SafetyOutlined, ReloadOutlined } from '@ant-design/icons';
import './OtpVerificationPage.css';

const { Title, Text } = Typography;
const { OTP } = Input;

interface LocationState {
    email?: string;
    type?: 'LOGIN' | 'FORGOT_PASSWORD';
}

const OtpVerificationPage: React.FC = () => {
    const [form] = Form.useForm();
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(0);
    const [isResending, setIsResending] = useState(false);

    const { verifyOtp, resendOtp, isLoading, tempToken } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state as LocationState | undefined;

    const email = state?.email || '';
    const otpType = state?.type || 'LOGIN';

    // Таймер для повторной отправки
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const onFinish = async (values: { otp: string }) => {
        setError(null);
        try {
            await verifyOtp({
                otp: values.otp,
                type: otpType,
                ...(email && { email })
            });

            message.success('Код подтверждён!');

            // Редирект в зависимости от типа
            if (otpType === 'FORGOT_PASSWORD') {
                navigate('/auth/reset-password', { state: { email } });
            } else {
                navigate('/hr-department/dashboard', { replace: true });
            }
        } catch (err: any) {
            setError(err.message || 'Неверный код подтверждения');
            message.error('Неверный код или он истёк');
            form.resetFields(['otp']);
        }
    };

    const handleResend = async () => {
        if (!email || isResending) return;

        setIsResending(true);
        try {
            await resendOtp(email);
            message.success('Новый код отправлен на вашу почту');
            setCountdown(60);
            form.resetFields(['otp']);
            setTimeout(() => {
                const firstInput = document.querySelector('.otp-input') as HTMLInputElement;
                firstInput?.focus();
            }, 100);
        } catch (err: any) {
            message.error(err.message || 'Ошибка отправки кода');
        } finally {
            setIsResending(false);
        }
    };

    // Защита от прямого захода
    if (!tempToken && !email) {
        return (
            <div className="otp-protected-wrapper">
                <Result
                    status="warning"
                    title="Доступ запрещён"
                    subTitle="Пройдите авторизацию сначала"
                    extra={
                        <Button type="primary" onClick={() => navigate('/login')} className="otp-button">
                            На страницу входа
                        </Button>
                    }
                />
            </div>
        );
    }

    return (
        <div className="otp-page-wrapper">
            <div className="otp-background">
                <div className="bg-gradient" />
                <div className="bg-orb orb-1" />
                <div className="bg-orb orb-2" />
            </div>

            <div className="otp-content">
                <Card className="otp-card" bordered={false}>
                    <div className="card-accent-bar" />
                    
                    <div className="otp-header">
                        <div className="logo-wrapper">
                            <SafetyOutlined className="logo-icon" />
                        </div>
                        <Title level={3} className="otp-title">Подтверждение</Title>
                        <Text className="otp-subtitle">
                            Введите 6-значный код из письма на <br />
                            <strong>{email}</strong>
                        </Text>
                    </div>

                    {error && (
                        <Alert
                            message="Ошибка"
                            description={error}
                            type="error"
                            showIcon
                            closable
                            className="otp-alert"
                            afterClose={() => setError(null)}
                        />
                    )}

                    <Form
                        form={form}
                        name="otp"
                        onFinish={onFinish}
                        layout="vertical"
                        disabled={isLoading}
                        className="otp-form"
                        autoComplete="off"
                    >
                        <Form.Item
                            name="otp"
                            rules={[
                                { required: true, message: 'Введите код' },
                                { len: 6, message: 'Код должен содержать 6 цифр' },
                                { pattern: /^\d+$/, message: 'Только цифры' }
                            ]}
                            className="otp-form-item"
                        >
                            <OTP
                                length={6}
                                size="large"
                                autoFocus
                                className="otp-component"
                            />
                        </Form.Item>

                        <Form.Item className="otp-submit">
                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                loading={isLoading}
                                className="otp-button"
                            >
                                {isLoading ? (
                                    <span className="btn-loading">
                                        <Spin size="small" /> Проверка...
                                    </span>
                                ) : (
                                    'Подтвердить код'
                                )}
                            </Button>
                        </Form.Item>
                    </Form>

                    <Space direction="vertical" className="otp-footer" size="middle">
                        <Button
                            type="link"
                            onClick={handleResend}
                            disabled={countdown > 0 || isResending || !email}
                            className="otp-resend-btn"
                            icon={<ReloadOutlined spin={isResending} />}
                        >
                            {countdown > 0
                                ? `Отправить повторно через ${countdown} сек`
                                : 'Отправить код ещё раз'}
                        </Button>

                        <Text type="secondary" className="otp-back-link">
                            <Link to="/login">← Вернуться ко входу</Link>
                        </Text>
                    </Space>
                </Card>

                <Text className="otp-copyright">
                    © {new Date().getFullYear()} FlowDetect
                </Text>
            </div>
        </div>
    );
};

export default OtpVerificationPage;