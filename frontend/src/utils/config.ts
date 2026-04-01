export interface RouteConfig {
  path: string;
  title: string;
  children?: RouteConfig[];
  public?: boolean;
}

export const appRoutes: RouteConfig[] = [
  { path: "/login", title: "Войти", public: true },

  { path: "/products", title: "Справо" },
  { path: "/catalog", title: "Каталог" },
  { path: "/components", title: "Справочник (Компонентов)" },
];
