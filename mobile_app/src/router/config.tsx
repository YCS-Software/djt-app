
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
import OwnerLayout from "../components/OwnerLayout";
import OwnerDashboardPage from "../pages/owner/dashboard/page";
import OwnerStationsPage from "../pages/owner/stations/page";
import OwnerTransactionsPage from "../pages/owner/transactions/page";
import OwnerProfilePage from "../pages/owner/profile/page";
import CreateStationPage from "../pages/owner/create-station/page";
import StationDetailPage from "../pages/owner/station-detail/page";
import MachineProfilePage from "../pages/owner/machine-profile/page";

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

  // Owner console (EV station owner)
  {
    element: <OwnerLayout />,
    children: [
      {
        path: "/owner",
        element: <OwnerDashboardPage />,
      },
      {
        path: "/owner/stations",
        element: <OwnerStationsPage />,
      },
      {
        path: "/owner/transactions",
        element: <OwnerTransactionsPage />,
      },
      {
        path: "/owner/profile",
        element: <OwnerProfilePage />,
      },
      {
        path: "/owner/stations/new",
        element: <CreateStationPage />,
      },
      {
        path: "/owner/stations/:stationId",
        element: <StationDetailPage mode="profile" />,
      },
      {
        path: "/owner/stations/:stationId/manage",
        element: <StationDetailPage mode="manage" />,
      },
      {
        path: "/owner/machines/:machineId",
        element: <MachineProfilePage />,
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
