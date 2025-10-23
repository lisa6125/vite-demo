import { lazy } from "react";
import { createBrowserRouter, Outlet } from "react-router";

const Root = () => <Outlet />;

const routesConfig = [
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: lazy(() => import("../Pages/Empty")) },
      {
        path: "calendar",
        Component: lazy(() => import("../Pages/Calendar")),
      },
    ],
  },
];

export const router = createBrowserRouter(routesConfig);
