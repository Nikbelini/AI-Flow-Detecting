import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User, UserRoles } from "../utils/types/user";
import { getCurrentUser, login as apiLogin, logout as apiLogout } from "../api/endpoints/auth";

type AuthContextType = {
    user: User | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    isLoading: boolean;
};

const isValidRole = (role: string): role is UserRoles => {
    return role === 'USER';
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
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

        fetchUser();
    }, []);

    const login = async (username: string, password: string) => {
        try {
            await apiLogin(username, password);
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const userData = await getCurrentUser();

            if (!userData.role) {
                throw new Error('Отсутствует роль в ответе');
            }

            if (!isValidRole(userData.role)) {
                throw new Error('Недопустимая роль');
            }

            const safeUser: User = {
                id: userData.id,
                email: userData.email,
                fullName: userData.fullName,
                role: userData.role,
            };

            setUser(safeUser);
            
        } catch (err: any) {         
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
        <AuthContext.Provider value={{ user, login, logout, isLoading }}>
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