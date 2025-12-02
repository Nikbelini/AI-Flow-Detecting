import { Navigate, Route, Routes } from "react-router-dom";
import { Container } from "react-bootstrap";;
import ProtectedRoute from "./utils/ProtectedRoute.tsx";
// import LoginPage from "./pages/Login.tsx";
import { AuthProvider } from './context/AuthContext';

const App = () => {
    return (
        <Container className="p-3" fluid>
            <AuthProvider>
                {/* <Header /> */}
                <Routes>
                  {/* Защищённые руты */}
                    <Route element={<ProtectedRoute />}>
                        {/* <Route index element={<ProductPage />} />
                        <Route path="/products" element={<ProductPage />} />
                        <Route path="/products/catalog" element={<ProductCatalogPage />} />
                        <Route path="/components" element={<ComponentCatalogPage />} /> */}
                    </Route>

                    {/* Если зайдут на несуществующий путь — редирект на главную */}
                    <Route path="*" element={<Navigate to="/" replace />} />

                    {/* Аутентификация */}
                    {/* <Route path="/login" element={<LoginPage />} /> */}
                    {/* <Route path="/unauthorized" element={<UnauthorizedPage />} /> */}
                </Routes>
            </AuthProvider>
        </Container>
    );
};

export default App;
