import React from "react";
import "./ClientLayout.css";
import { Outlet } from "react-router-dom";
const ClientLayout = () => {
  return (
    <div>
      <Outlet />
    </div>
  );
};

export default ClientLayout;
