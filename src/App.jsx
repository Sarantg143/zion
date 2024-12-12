import { Suspense } from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";

import Login from "./Authentication/LoginPage/Login";
import Register from "./Authentication/RegisterPage/Register";
import ErrorPage from "./pages/404Page/ErrorPage";
import ClientLayout from "./pages/Client/ClientLayout";
import ClientDashboard from "./pages/Client/ClientDashboard/ClientDashboard";
import ProfilePage from "./pages/Client/ProfilePage/ProfilePage";
import AdminLayout from "./pages/Admin/AdminLayout";
import AdminDashboard from "./pages/Admin/AdminDashboard/AdminDashboard";
import EventManagement from "./pages/Admin/Event/EventManagement";

export default function App() {
  return (
    <>
      <Suspense fallback={<h1>Loading..</h1>}>
        <Router>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            

            {/* Client Page */}
            <Route path="client" element={<ClientLayout />}>
              <Route index element={<ClientDashboard />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Admin Pages */}
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="event" element={<EventManagement/>}/>
            </Route>

            <Route path="*" element={<ErrorPage />} />
          </Routes>
        </Router>
      </Suspense>
    </>
  );
}


// const RootLayout = () => {
//   return (
//     <>
//     </>
//   )
// }