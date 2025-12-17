import { createContext, useContext, useState, type ReactNode } from "react";
import type { User, UserRoles } from "../utils/types/user";
import { getCurrentUser, login as apiLogin, logout as apiLogout } from "../api/endpoints/auth";

type AuthContextType = {
    user: User | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    isLoading: boolean;
    checkAuth: () => Promise<void>; // Добавляем метод для ручной проверки
};

const isValidRole = (role: string): role is UserRoles => {
    return role === 'USER';
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Метод для ручной проверки авторизации
    const checkAuth = async () => {
        setIsLoading(true);
        try {
            const userData = await getCurrentUser();
            
            if (!userData.role) {
                setUser(null);
                return;
            }

            if (!isValidRole(userData.role)) {
                setUser(null);
                return;
            }

            const safeUser: User = {
                id: userData.id,
                email: userData.email,
                fullName: userData.fullName,
                role: userData.role,
            };

            setUser(safeUser);
        } catch (err) {
            console.warn('Не удалось загрузить пользователя:', err);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (username: string, password: string) => {
        setIsLoading(true);
        try {
            await apiLogin(username, password);
            await checkAuth(); // Проверяем после успешного логина
        } catch (err: any) {         
            setIsLoading(false);
            if (err.response?.status === 401) {
                throw new Error('Неверный логин или пароль');
            } else if (err.message) {
                throw new Error(err.message);
            } else {
                throw new Error('Ошибка при входе в систему');
            }
        }
    };

    const logout = async () => {
        try {
            await apiLogout();
        } catch (err) {
            console.warn('⚠️ Ошибка при выходе:', err);
        } finally {
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            login, 
            logout, 
            isLoading,
            checkAuth 
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};