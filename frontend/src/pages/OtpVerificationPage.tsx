import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
    Form, Input, Button, Alert, Typography, Card, message,
    Space, Result, Spin
} from 'antd';
import { SafetyOutlined, ReloadOutlined } from '@ant-design/icons';

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

    // ⏱ Таймер для повторной отправки
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

            message.success('✅ Код подтверждён!');

            // Редирект в зависимости от типа
            if (otpType === 'FORGOT_PASSWORD') {
                navigate('/auth/reset-password', { state: { email } });
            } else {
                navigate('/hr-department/dashboard', { replace: true });
            }
        } catch (err: any) {
            setError(err.message || 'Неверный код подтверждения');
            message.error('Неверный код или он истёк');
        }
    };

    const handleResend = async () => {
        if (!email || isResending) return;

        setIsResending(true);
        try {
            await resendOtp(email);
            message.success('Новый код отправлен на вашу почту');
            setCountdown(60); // блокировка на 60 сек
            form.resetFields();
        } catch (err: any) {
            message.error(err.message || 'Ошибка отправки кода');
        } finally {
            setIsResending(false);
        }
    };

    // 🛡 Защита от прямого захода
    if (!tempToken && !email) {
        return (
            <div style={{ padding: 40 }}>
                <Result
                    status="warning"
                    title="Доступ запрещён"
                    subTitle="Пройдите авторизацию сначала"
                    extra={
                        <Button type="primary" onClick={() => navigate('/login')}>
                            На страницу входа
                        </Button>
                    }
                />
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '20px'
        }}>
            <Card style={{ width: '100%', maxWidth: 420, borderRadius: 12 }} bordered={false}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <SafetyOutlined style={{ fontSize: 48, color: '#667eea' }} />
                    <Title level={3} style={{ marginTop: 12, marginBottom: 8 }}>Подтверждение</Title>
                    <Text type="secondary">
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
                        style={{ marginBottom: 16 }}
                    />
                )}

                <Form
                    form={form}
                    name="otp"
                    onFinish={onFinish}
                    layout="vertical"
                    disabled={isLoading}
                >
                    <Form.Item
                        name="otp"
                        rules={[
                            { required: true, message: 'Введите код' },
                            { len: 6, message: 'Код должен содержать 6 цифр' },
                            { pattern: /^\d+$/, message: 'Только цифры' }
                        ]}
                    >
                        <Form.Item
                            name="otp"
                            rules={[
                                { required: true, message: 'Введите код' },
                                { len: 6, message: 'Код должен содержать 6 цифр' },
                                { pattern: /^\d+$/, message: 'Только цифры' }
                            ]}
                        >
                            <OTP
                                length={6}
                                size="large"
                                autoFocus
                            />
                        </Form.Item>
                    </Form.Item>

                    <Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            block
                            loading={isLoading}
                            style={{
                                background: '#667eea',
                                borderColor: '#667eea',
                                height: 44,
                                fontSize: 16
                            }}
                        >
                            {isLoading ? <Spin size="small" /> : 'Подтвердить код'}
                        </Button>
                    </Form.Item>
                </Form>

                <Space direction="vertical" style={{ width: '100%', alignItems: 'center' }} size="middle">
                    <Button
                        type="link"
                        onClick={handleResend}
                        disabled={countdown > 0 || isResending || !email}
                        icon={<ReloadOutlined />}
                    >
                        {countdown > 0
                            ? `Отправить повторно через ${countdown} сек`
                            : 'Отправить код ещё раз'}
                    </Button>

                    <Text type="secondary">
                        <Link to="/login">← Вернуться ко входу</Link>
                    </Text>
                </Space>
            </Card>
        </div>
    );
};

export default OtpVerificationPage;