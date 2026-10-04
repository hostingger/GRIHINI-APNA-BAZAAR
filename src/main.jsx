import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";

import App from "./App.jsx";
import "./index.css";

const AdminDashboard = lazy(() =>
  import("./admin/AdminDashboard.jsx")
);

function Root() {
  const path =
    window.location.pathname.toLowerCase();

  if (
    path === "/admin" ||
    path.startsWith("/admin/")
  ) {
    return (
      <Suspense
        fallback={
          <div className="admin-loading">
            Loading Admin Panel...
          </div>
        }
      >
        <AdminDashboard />
      </Suspense>
    );
  }

  return <App />;
}

const rootElement =
  document.getElementById("root");

if (!rootElement) {
  throw new Error(
    'Root element "#root" not found.'
  );
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);