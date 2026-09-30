import { lazy, Suspense } from "react";
import { AuthBoundary } from "./auth";
import { Loading } from "./components";

const Shell = lazy(() => import("./Shell"));

export default function App() {
  return (
    <AuthBoundary>
      <Suspense fallback={<Loading />}>
        <Shell />
      </Suspense>
    </AuthBoundary>
  );
}
