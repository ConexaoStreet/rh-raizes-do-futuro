import type { ReactNode } from "react";
import { ArrowUpRight, LogOut, RefreshCw } from "lucide-react";
import { Brand } from "./auth";
import { ThemeToggle } from "./theme";
import { tiNavigation, tiViewTitles, type TiView } from "./navigation";

type TiShellProps = {
  view: TiView;
  fullName: string;
  roles: string[];
  busy: boolean;
  rhSite: string;
  can: (permission: string) => boolean;
  onNavigate: (view: TiView) => void;
  onRefresh: () => void;
  onLogout: () => void;
  children: ReactNode;
};

export function TiShell({
  view,
  fullName,
  roles,
  busy,
  rhSite,
  can,
  onNavigate,
  onRefresh,
  onLogout,
  children,
}: TiShellProps) {
  return (
    <div className="app-shell ti-shell">
      <aside className="sidebar ti-sidebar">
        <Brand />
        <div className="environment" aria-label="Ambiente de produção">
          <span className="pulse" />
          <span>PROD</span>
        </div>

        <nav className="ti-nav" aria-label="Navegação principal da Central T.I.">
          {tiNavigation.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !item.permission || can(item.permission),
            );
            if (!visibleItems.length) return null;
            return (
              <section className="ti-nav-group" key={group.label}>
                <span className="ti-nav-group-label">{group.label}</span>
                <div className="ti-nav-group-items">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.view}
                        type="button"
                        className={view === item.view ? "nav-button active" : "nav-button"}
                        aria-current={view === item.view ? "page" : undefined}
                        onClick={() => onNavigate(item.view)}
                      >
                        <Icon size={18} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <a
            className="external-link"
            href={rhSite}
            target="_blank"
            rel="noreferrer"
          >
            <ArrowUpRight size={16} />
            Abrir RH
          </a>
          <button className="logout" type="button" onClick={onLogout}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      <main id="ti-main-content">
        <header className="topbar ti-topbar">
          <div className="ti-topbar-context">
            <span className="eyebrow">CENTRAL TÉCNICA · PRODUÇÃO</span>
            <h1>{tiViewTitles[view]}</h1>
          </div>
          <div className="operator">
            <button
              className="icon-button"
              type="button"
              aria-label="Atualizar dados"
              onClick={onRefresh}
              disabled={busy}
            >
              <RefreshCw size={17} />
            </button>
            <ThemeToggle compact />
            <div className="operator-copy">
              <strong>{fullName}</strong>
              <span>{roles.join(" · ")}</span>
            </div>
            <div className="operator-avatar" aria-hidden="true">
              {fullName.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
