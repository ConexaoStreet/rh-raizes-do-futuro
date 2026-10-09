import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import MaintenanceNotice from "./MaintenanceNotice";

describe("maintenance notice", () => {
  it("shows maintenance and a public live link before signing in", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <MaintenanceNotice
          maintenance={{
            enabled: true,
            title: "O site está em manutenção",
            message: "Estamos conferindo os espaços de cada setor.",
          }}
        />
      </MemoryRouter>,
    );
    expect(html).toContain("O site está em manutenção");
    expect(html).toContain("Acompanhar ao vivo");
    expect(html).toContain('href="/ao-vivo"');
    expect(html).toContain('role="status"');
  });
  it("removes the alert after maintenance ends", () => {
    expect(
      renderToStaticMarkup(
        <MaintenanceNotice maintenance={{ enabled: false }} />,
      ),
    ).toBe("");
  });
});
