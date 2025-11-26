
import type { RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import Wallet from "../pages/wallet/page";
import Charging from "../pages/charging/page";
import Profile from "../pages/profile/page";
import Login from "../pages/Login";
import Signup from "../pages/Signup";
import Layout from "../components/Layout";
import RootRedirect from "../components/RootRedirect";

const routes: RouteObject[] = [
  // Root route - redirect based on auth status
  {
    path: "/",
    element: <RootRedirect />,
  },
  
  // Login route (no layout/navigation)
  {
    path: "/login",
    element: <Login />,
  },
  
  // Signup route (no layout/navigation)
  {
    path: "/signup",
    element: <Signup />,
  },
  
  // Protected routes with layout and navigation
  {
    element: <Layout />,
    children: [
      {
        path: "/home",
        element: <Home />,
      },
      {
        path: "/wallet",
        element: <Wallet />,
      },
      {
        path: "/charging",
        element: <Charging />,
      },
      {
        path: "/profile",
        element: <Profile />,
      },
    ],
  },
  
  // 404 Not Found
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;
