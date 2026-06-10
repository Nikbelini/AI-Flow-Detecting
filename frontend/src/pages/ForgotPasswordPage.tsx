import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Form, Input, Button, Alert, Typography,
    Card, Space, message, Result, Divider
} from 'antd';
import {
    MailOutlined, SafetyOutlined, KeyOutlined, CheckCircleOutlined,
    ArrowLeftOutlined, ReloadOutlined
} from '@ant-design/icons';

import {
    forgotPassword, resendOtp, resetPasswordByToken,
    verifyOtpForResetToken
} from '../api/endpoints/auth';
import type { OtpVerifyResponse } from '../api/types/auth';
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
    const [resetToken, setResetToken] = useState<string | null>(null);

    // Локальное состояние для цифр OTP
    const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));

    const navigate = useNavigate();
    const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    // Шаг 1: Отправка кода на email
    const handleSendCode = async (values: { email: string }) => {
        setError(null);
        setIsLoading(true);

        try {
            await forgotPassword(values.email);
            setEmail(values.email);
            setStep('otp');
            setCountdown(60);
            message.success('Код отправлен на вашу почту');
            setTimeout(() => otpInputsRef.current[0]?.focus(), 100);
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Не удалось отправить код';
            setError(errorMsg);
            message.error('Ошибка: ' + errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    // Шаг 2: Верификация OTP
    const handleVerifyOtp = async () => {
        const otp = otpDigits.join('');

        if (!otp || otp.length !== 6) {
            setError('Введите 6-значный код');
            return;
        }

        setError(null);
        setIsLoading(true);

        try {
            const data: OtpVerifyResponse = await verifyOtpForResetToken({
                email,
                otp
            });

            setResetToken(data.resetToken);
            setStep('reset');
            message.success('Код подтверждён');
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Неверный или истёкший код';
            setError(errorMsg);
            message.error('Ошибка: ' + errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    // Шаг 3: Сброс пароля по токену
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

        if (!resetToken) {
            setError('Сессия истекла. Начните заново.');
            setStep('email');
            return;
        }

        setIsLoading(true);

        try {
            await resetPasswordByToken({
                resetToken,
                newPassword: values.newPassword
            });

            setResetToken(null);
            setStep('success');
            message.success('Пароль изменён!');
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Не удалось изменить пароль';
            setError(errorMsg);
            message.error('Ошибка: ' + errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    // Повторная отправка кода
    const handleResendCode = async () => {
        if (countdown > 0 || !email) return;

        setIsLoading(true);
        try {
            await resendOtp(email);
            setCountdown(60);
            message.success('Новый код отправлен');
        } catch {
            message.error('Не удалось отправить код');
        } finally {
            setIsLoading(false);
        }
    };

    // Обработчик изменения одной цифры OTP
    const handleOtpDigitChange = (index: number, value: string) => {
        const digit = value.replace(/\D/g, '').slice(0, 1);
        const newDigits = [...otpDigits];
        newDigits[index] = digit;

        setOtpDigits(newDigits);
        form.setFieldValue('otp', newDigits.join(''));

        if (digit && index < 5) {
            setTimeout(() => {
                otpInputsRef.current[index + 1]?.focus();
            }, 0);
        }

        const otp = newDigits.join('');
        if (otp.length === 6 && /^\d{6}$/.test(otp)) {
            setTimeout(() => handleVerifyOtp(), 150);
        }
    };

    // Обработчик клавиш для OTP
    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
            e.preventDefault();
            const newDigits = [...otpDigits];
            newDigits[index - 1] = '';
            setOtpDigits(newDigits);
            form.setFieldValue('otp', newDigits.join(''));
            otpInputsRef.current[index - 1]?.focus();
        }

        if (e.key === 'ArrowLeft' && index > 0) {
            e.preventDefault();
            otpInputsRef.current[index - 1]?.focus();
        }
        if (e.key === 'ArrowRight' && index < 5) {
            e.preventDefault();
            otpInputsRef.current[index + 1]?.focus();
        }

        if (e.key.length === 1 && !/\d/.test(e.key) &&
            !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
            e.preventDefault();
        }
    };

    // Рендер шага: ввод email
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

    // Рендер шага: ввод OTP
    const renderOtpStep = () => {
        return (
            <Form form={form} layout="vertical">
                <Alert
                    message="Проверьте почту"
                    description={`Мы отправили 6-значный код на ${email}`}
                    type="info"
                    showIcon
                    className="fp-alert"
                />

                {/* Скрытое поле для валидации Ant Design */}
                <Form.Item
                    name="otp"
                    rules={[
                        { required: true, message: 'Введите код' },
                        { len: 6, message: 'Код должен содержать 6 цифр' }
                    ]}
                    style={{ display: 'none' }}
                >
                    <Input />
                </Form.Item>

                <div className="otp-container">
                    {[...Array(6)].map((_, i) => (
                        <Input
                            key={i}
                            ref={(el) => {
                                if (el) {
                                    otpInputsRef.current[i] = (el).input as HTMLInputElement;
                                }
                            }}
                            maxLength={1}
                            className="otp-digit"
                            value={otpDigits[i]}
                            onChange={(e) => {
                                const value = e.target.value;
                                handleOtpDigitChange(i, value);
                            }}
                            onKeyDown={(e) => handleOtpKeyDown(i, e)}
                            onFocus={(e) => {
                                e.target.select();
                                e.currentTarget.closest('.otp-digit')?.classList.add('otp-digit-focused');
                            }}
                            onBlur={(e) => {
                                e.currentTarget.closest('.otp-digit')?.classList.remove('otp-digit-focused');
                            }}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete="one-time-code"
                            data-index={i}
                        />
                    ))}
                </div>

                <Form.Item className="fp-submit">
                    <Button
                        type="primary"
                        htmlType="button"
                        block
                        loading={isLoading}
                        className="fp-button"
                        onClick={handleVerifyOtp}
                        disabled={otpDigits.join('').length !== 6 || isLoading}
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

    // Рендер шага: новый пароль
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
                        validator(_rule: unknown, value: string) {
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

    // Рендер шага: успех
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
            <div className="fp-background">
                <div className="bg-gradient" />
                <div className="bg-shapes">
                    <div className="shape shape-1" />
                    <div className="shape shape-2" />
                </div>
            </div>

            <div className="fp-container">
                <Card className="fp-card" bordered={false}>
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

                    <div className="fp-content">
                        {step === 'email' && renderEmailStep()}
                        {step === 'otp' && renderOtpStep()}
                        {step === 'reset' && renderResetStep()}
                        {step === 'success' && renderSuccessStep()}
                    </div>

                    {step !== 'success' && <Divider className="fp-divider" />}

                    <Space direction="vertical" className="fp-footer align-center" size={4}>
                        <Text type="secondary" className="fp-help">
                            Нужна помощь?{' '}
                            <a href="mailto:support@flowdetect.ru" className="fp-link">
                                support@flowdetect.ru
                            </a>
                        </Text>
                        <Text type="secondary" className="fp-security">
                            Ваши данные защищены
                        </Text>
                    </Space>
                </Card>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;