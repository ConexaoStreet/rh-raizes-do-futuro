import { Component, type ReactNode } from "react";

export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="fatal-page" role="alert">
          <div className="fatal-card">
            <span className="eyebrow">CENTRAL TÉCNICA</span>
            <h1>Não foi possível abrir esta tela.</h1>
            <p>Recarregue a Central de T.I. para tentar novamente.</p>
            <button className="primary-button" onClick={() => location.reload()}>
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
