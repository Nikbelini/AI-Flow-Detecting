import { createContext, useContext, useState, type ReactNode, useCallback, useEffect } from "react";
import type { User, UserRoles } from "../api/types/user";
import {
    getCurrentUser,
    login as apiLogin,
    logout as apiLogout,
    verifyOtpForToken,
    resendOtp
} from "../api/endpoints/auth";
import type { AuthResponse, OtpVerifyPayload } from "../api/types/auth";

type AuthContextType = {
    user: User | null;
    login: (email: string, password: string) => Promise<AuthResponse>;
    verifyOtp: (payload: OtpVerifyPayload) => Promise<AuthResponse>;
    resendOtp: (email: string) => Promise<void>;
    logout: () => Promise<void>;
    isLoading: boolean;
    tempToken: string | null;
    setTempToken: (token: string | null) => void;
    checkAuth: () => Promise<void>;
    refreshUser: () => Promise<void>;
};

const isValidRole = (role: string): role is UserRoles => {
    return ['USER', 'ADMIN', 'MODERATOR'].includes(role?.toUpperCase());
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [tempToken, setTempToken] = useState<string | null>(null);

    const checkAuth = useCallback(async () => {
        setIsLoading(true);
        try {
            const userData = await getCurrentUser();
            if (!userData?.role || !isValidRole(userData.role)) {
                setUser(null);
                return;
            }
            setUser({
                id: userData.id,
                email: userData.email,
                fullName: userData.fullName,
                role: userData.role.toUpperCase() as UserRoles,

                emailConfirmed: userData.emailConfirmed ?? false,
                twoFactorEnabled: userData.twoFactorEnabled ?? false,
                accountLocked: userData.accountLocked ?? false,
                failedAttempts: userData.failedAttempts ?? 0,
                lockUntil: userData.lockUntil ?? null,
                lastPasswordChangeAt: userData.lastPasswordChangeAt ?? null,
                lastLoginAt: userData.lastLoginAt ?? null,
                createdAt: userData.createdAt,
            });
        } catch {
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);


    const refreshUser = useCallback(async () => {
        try {
            const userData = await getCurrentUser();
            if (!userData?.role || !isValidRole(userData.role)) {
                setUser(null);
                return;
            }
            setUser({
                id: userData.id,
                email: userData.email,
                fullName: userData.fullName,
                role: userData.role.toUpperCase() as UserRoles,

                emailConfirmed: userData.emailConfirmed ?? false,
                twoFactorEnabled: userData.twoFactorEnabled ?? false,
                accountLocked: userData.accountLocked ?? false,
                failedAttempts: userData.failedAttempts ?? 0,
                lockUntil: userData.lockUntil ?? null,
                lastPasswordChangeAt: userData.lastPasswordChangeAt ?? null,
                lastLoginAt: userData.lastLoginAt ?? null,
                createdAt: userData.createdAt,
            });
        } catch {
            setUser(null);
        }
    }, []);

    const login = async (email: string, password: string): Promise<AuthResponse> => {
        setIsLoading(true);
        try {
            const response = await apiLogin({ email, password });

            if (response.requireOtp && response.tempToken) {
                setTempToken(response.tempToken);
                return response;
            }

            await checkAuth();
            return response;
        } catch (err: any) {
            if (err.response?.status === 401) {
                throw new Error('Неверный email или пароль');
            }
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const verifyOtp = async (payload: OtpVerifyPayload): Promise<AuthResponse> => {
        setIsLoading(true);
        try {
            const payloadWithToken = {
                ...payload,
                tempToken: payload.tempToken || tempToken || undefined,
            };

            const response = await verifyOtpForToken(payloadWithToken);

            if (response.requireOtp && response.tempToken) {
                setTempToken(response.tempToken);
                return response;
            }

            await checkAuth();
            return response;
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOtp = async (email: string) => {
        await resendOtp(email);
    };

    const logout = async () => {
        try {
            await apiLogout();
        } catch {
            // ignore
        } finally {
            setUser(null);
            setTempToken(null);
        }
    };

    return (
        <AuthContext.Provider value={{
            user, login, verifyOtp, resendOtp: handleResendOtp, logout, 
            isLoading, tempToken, setTempToken, checkAuth, refreshUser
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