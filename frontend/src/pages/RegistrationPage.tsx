import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Alert, Card, Typography, message } from 'antd';
import {
    LockOutlined, EyeOutlined, EyeInvisibleOutlined, UserOutlined,
    MailOutlined, SafetyOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import './RegistrationPage.css';
import type { RegisterRequest, RegisterResponse } from '../api/types/user';
import { register } from '../api/endpoints/auth';

const { Title, Text } = Typography;

const RegistrationPage: React.FC = () => {
    const [form] = Form.useForm();
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const navigate = useNavigate();

    const onFinish = async (values: RegisterRequest) => {
        setError(null);
        setIsSubmitting(true);

        try {
            const data: RegisterResponse = await register(values);

            if (!data.success) {
                throw new Error(data.message || 'Ошибка регистрации');
            }

            setIsSuccess(true);
            message.success('✅ Аккаунт создан! Теперь войдите в систему');

            // Через 2 секунды — редирект на логин с переданным email
            setTimeout(() => {
                navigate('/login', {
                    replace: true,
                    state: { registeredEmail: values.email }
                });
            }, 2000);

        } catch (err: any) {
            console.error('Registration error:', err);

            // Обработка ошибок от API
            const errorMsg = err.message || err.response?.data?.message || 'Не удалось создать аккаунт';
            setError(errorMsg);
            message.error(errorMsg);

        } finally {
            setIsSubmitting(false);
        }
    };

    // Экран успеха
    if (isSuccess) {
        return (
            <div className="reg-page-wrapper">
                <div className="reg-background">
                    <div className="bg-gradient" />
                    <div className="bg-orb orb-1" />
                </div>

                <div className="reg-content">
                    <Card className="reg-card reg-card-success" bordered={false}>
                        <div className="success-icon">
                            <CheckCircleOutlined />
                        </div>
                        <Title level={3} className="success-title">Готово!</Title>
                        <Text className="success-text">
                            Аккаунт успешно создан.<br />
                            Перенаправляем на вход...
                        </Text>
                        <div className="success-email">
                            <MailOutlined /> {form.getFieldValue('email')}
                        </div>
                        <Button
                            type="primary"
                            className="goto-login-btn"
                            onClick={() => navigate('/login')}
                        >
                            Перейти ко входу
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }

    // Форма регистрации
    return (
        <div className="reg-page-wrapper">
            {/* Фон */}
            <div className="reg-background">
                <div className="bg-gradient" />
                <div className="bg-orb orb-1" />
                <div className="bg-orb orb-2" />
            </div>

            <div className="reg-content">
                <Card className="reg-card" bordered={false}>
                    {/* Логотип */}
                    <div className="reg-header">
                        <div className="logo-wrapper">
                            <SafetyOutlined className="logo-icon" />
                            <span className="ai-badge">AI</span>
                        </div>
                        <Title level={2} className="reg-title">Регистрация</Title>
                        <Text className="reg-subtitle">Создайте аккаунт за 30 секунд</Text>
                    </div>

                    {/* Ошибка */}
                    {error && (
                        <Alert
                            message={error}
                            type="error"
                            showIcon
                            closable
                            className="reg-alert"
                            afterClose={() => setError(null)}
                        />
                    )}

                    {/* Форма */}
                    <Form
                        form={form}
                        name="registration"
                        onFinish={onFinish}
                        layout="vertical"
                        size="large"
                        className="reg-form"
                        disabled={isSubmitting}
                        autoComplete="off"
                    >
                        {/* Имя */}
                        <Form.Item
                            name="fullName"
                            rules={[
                                { required: true, message: 'Введите ваше имя' },
                                { min: 2, message: 'Минимум 2 символа' }
                            ]}
                        >
                            <Input
                                prefix={<UserOutlined className="input-icon" />}
                                placeholder="Ваше имя"
                                className="reg-input"
                                autoComplete="name"
                            />
                        </Form.Item>

                        {/* Email */}
                        <Form.Item
                            name="email"
                            rules={[
                                { required: true, message: 'Введите email' },
                                { type: 'email', message: 'Неверный формат email' }
                            ]}
                        >
                            <Input
                                prefix={<MailOutlined className="input-icon" />}
                                placeholder="Email"
                                className="reg-input"
                                autoComplete="email"
                            />
                        </Form.Item>

                        {/* Пароль */}
                        <Form.Item
                            name="password"
                            rules={[
                                { required: true, message: 'Введите пароль' },
                                { min: 6, message: 'Минимум 6 символов' }
                            ]}
                            className="password-item"
                        >
                            <Input.Password
                                prefix={<LockOutlined className="input-icon" />}
                                placeholder="Пароль (мин. 6 символов)"
                                className="reg-input"
                                autoComplete="new-password"
                                iconRender={(visible) =>
                                    visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
                                }
                            />
                        </Form.Item>

                        {/* Кнопка */}
                        <Form.Item className="submit-row">
                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                loading={isSubmitting}
                                className="reg-button"
                            >
                                {isSubmitting ? (
                                    <span className="btn-loading">
                                        <span className="spinner" /> Создание...
                                    </span>
                                ) : (
                                    <span className="btn-content">
                                        Создать аккаунт
                                    </span>
                                )}
                            </Button>
                        </Form.Item>
                    </Form>

                    {/* Футер */}
                    <div className="reg-footer align-center">
                        <Text className="footer-text">
                            Уже есть аккаунт?{' '}
                            <Link to="/login" className="footer-link">
                                Войти
                            </Link>
                        </Text>
                        <Text className="reg-security">
                            🔒 Данные шифруются и защищены
                        </Text>
                    </div>
                </Card>

                {/* Копирайт */}
                <Text className="reg-copyright">
                    © {new Date().getFullYear()} FlowDetect
                </Text>
            </div>
        </div>
    );
};

export default RegistrationPage;