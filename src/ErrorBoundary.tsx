import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureError } from "./telemetry";

export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    captureError("react_boundary", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="fatal-page" role="alert">
          <div className="fatal-card">
            <span className="eyebrow">RAÍZES DO FUTURO</span>
            <h1>Não foi possível abrir esta tela.</h1>
            <p>Recarregue o sistema. Se o problema continuar, a ocorrência ficará registrada para análise técnica.</p>
            <button className="primary" onClick={() => location.reload()}>
              Recarregar sistema
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
