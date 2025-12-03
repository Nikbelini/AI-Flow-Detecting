// src/App.tsx
import { Navigate, Route, Routes } from "react-router-dom";
import { Container } from "react-bootstrap";
// import ProtectedRoute from "./utils/ProtectedRoute.tsx";
// import { AuthProvider } from './context/AuthContext'; // Пока отключаем
import MapComponent from './pages/Map/Map';

const App = () => {
    return (
        <Container className="p-3" fluid>
            {/* Пока без авторизации */}
            {/* <AuthProvider> */}
                <Routes>
                    {/* Публичные роуты - пока без защиты */}
                    <Route path="/" element={<MapComponent />} />
                    <Route path="/map" element={<MapComponent />} />
                    
                    {/* Редирект для несуществующих путей */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            {/* </AuthProvider> */}
        </Container>
    );
};

export default App;