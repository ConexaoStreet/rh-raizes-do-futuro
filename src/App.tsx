import { lazy, Suspense } from "react";
import { AuthBoundary } from "./auth";
import { Loading } from "./components";
import { useLocation } from "react-router-dom";
import { SiteStatusProvider, useSiteStatus } from "./site-status";
import MaintenanceNotice from "./MaintenanceNotice";

const Shell = lazy(() => import("./Shell"));
const LiveMaintenance = lazy(() => import("./LiveMaintenance"));

export default function App() {
  return (
    <SiteStatusProvider>
      <SiteContent />
    </SiteStatusProvider>
  );
}

function SiteContent() {
  const location = useLocation();
  const { data } = useSiteStatus();
  return (
    <>
      {data && location.pathname === "/ao-vivo" && (
        <MaintenanceNotice maintenance={data.maintenance} />
      )}
      {location.pathname === "/ao-vivo" ? (
        <Suspense fallback={<Loading />}>
          <LiveMaintenance />
        </Suspense>
      ) : (
        <AuthBoundary>
          <Suspense fallback={<Loading />}>
            <Shell />
          </Suspense>
        </AuthBoundary>
      )}
    </>
  );
}
