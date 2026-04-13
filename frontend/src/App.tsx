import { Navigate, Route, Routes } from "react-router-dom";
import { Container, Row, Col } from "react-bootstrap";
import { AuthProvider } from './context/AuthContext';

// Компоненты
import NavigationHeader from './components/NavigationHeader';
import MapComponent from './pages/Map/Map';
import AnalyticsPage from './pages/AnalyticsPage';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from "./utils/ProtectedRoute";
import OtpVerificationPage from "./pages/OtpVerificationPage";
import ProfilePage from "./pages/ProfilePage";
import LogoutCallback from "./pages/LogoutCallback";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import RegistrationPage from "./pages/RegistrationPage";
import AdminPanel from "./pages/AdminPanel";
import OptimalRoutePage from "./pages/Map/OptimalRoutePage";

const App = () => {
    return (
        <AuthProvider>
            <Routes>
                {/* 🔓 ПУБЛИЧНЫЕ маршруты — без защиты */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/registration" element={<RegistrationPage />} />
                <Route path="/auth/verify-otp" element={<OtpVerificationPage />} />
                <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
                
                {/* 🗺️ КАРТА — публичная, но с хедером */}
                <Route path="/map" element={
                    <MainLayout>
                        <MapComponent/>
                    </MainLayout>
                } />

                {/* 🔐 ЗАЩИЩЁННЫЕ маршруты — только для авторизованных */}
                <Route path="/" element={
                    <ProtectedRoute>
                        <MainLayout>
                            <Navigate to="/map" replace />
                        </MainLayout>
                    </ProtectedRoute>
                } />

                <Route path="/analytics" element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        <MainLayout>
                            <AnalyticsPage />
                        </MainLayout>
                    </ProtectedRoute>
                } />

                  <Route
                  path="/admin" 
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminPanel />
                    </ProtectedRoute>
                  } />

                <Route path="/route-build" element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'USER']}>
                        <MainLayout>
                            <OptimalRoutePage />
                        </MainLayout>
                    </ProtectedRoute>
                } />

                <Route path="/profile" element={
                    <ProtectedRoute>
                        <MainLayout>
                            <ProfilePage />
                        </MainLayout>
                    </ProtectedRoute>
                } />

                <Route path="/logout" element={
                    <ProtectedRoute>
                        <MainLayout>
                            <LogoutCallback />
                        </MainLayout>
                    </ProtectedRoute>
                } />

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/map" replace />} />
            </Routes>
        </AuthProvider>
    );
};

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <div className="App">
            <NavigationHeader />
            <Container fluid className="p-0">
                <Row className="g-0">
                    <Col className="p-3">
                        {children}
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default App;