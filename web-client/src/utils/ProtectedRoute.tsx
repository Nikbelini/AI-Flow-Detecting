import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "react-bootstrap";

const ProtectedPickerRoute: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "100vh" }}>
        <Spinner animation="border" />
      </div>
    );
  }

  // Если пользователь не авторизован или не ADMIN — редирект на логин
  if (!user || user.role !== 'USER') {
    return <Navigate to="/login" replace />;
  }

  // Если всё ок — рендерим дочерний маршрут (Outlet)
  return <Outlet />;
};

export default ProtectedPickerRoute;