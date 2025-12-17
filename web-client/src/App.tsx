import { Navigate, Route, Routes } from "react-router-dom";
import { Container, Row, Col } from "react-bootstrap";
// import ProtectedRoute from "./utils/ProtectedRoute.tsx";
import { AuthProvider } from './context/AuthContext'; // Пока отключаем

// Компоненты страниц
import NavigationHeader from './components/NavigationHeader';
import MapComponent from './pages/Map/Map';
import AnalyticsPage from './pages/AnalyticsPage';
import SimulationPage from './pages/SimulationPage';
import ScenariosPage from './pages/ScenariosPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from "./pages/RegisterPage";

const App = () => {
    return (
        <div className="App">
            {/* Навигационная панель */}
            <NavigationHeader />
            
            {/* Основной контейнер с горизонтальной компоновкой */}
            <Container fluid className="p-0">
                <Row className="g-0">
                    {/* Боковая панель (если нужна) */}
                    {/* <Col md={2} className="bg-light border-end">
                        <Sidebar />
                    </Col> */}
                    
                    {/* Основное содержимое */}
                    <Col className="p-3">
                        {/* Пока без авторизации */}
                        <AuthProvider>
                            <Routes>
                                {/* Публичные роуты - пока без защиты */}
                                
                                {/* Главная страница - переадресация на карту */}
                                <Route path="/" element={<Navigate to="/map" replace />} />
                                
                                {/* Карта в реальном времени (существующий функционал) */}
                                <Route path="/map" element={<MapComponent />} />
                                
                                {/* Новые страницы для аналитики */}
                                <Route path="/login" element={<LoginPage />} />
                                <Route path="/registration" element={<RegisterPage />} />

                                <Route path="/analytics" element={<AnalyticsPage />} />
                                <Route path="/simulation" element={<SimulationPage />} />
                                <Route path="/scenarios" element={<ScenariosPage />} />
                                
                                {/* Редирект для несуществующих путей */}
                                <Route path="*" element={<Navigate to="/map" replace />} />
                            </Routes>
                        </AuthProvider>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default App;