import { Link, Navigate, useParams } from "react-router-dom";
import { Shield } from "lucide-react";
import { useAuth } from "./auth";
import { EntityPage, specs } from "./entities";

export default function EntitySettings() {
  const { entity = "" } = useParams();
  const { can } = useAuth();
  const spec = specs[entity];
  if (!spec || ["colaboradores", "feedbacks"].includes(entity)) {
    return <Navigate to="/" replace />;
  }
  if (!can(spec.permission)) {
    return (
      <div className="empty">
        <Shield />
        <h1>Você não tem permissão.</h1>
        <Link to="/">Voltar</Link>
      </div>
    );
  }
  return <EntityPage spec={spec} />;
}
