import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GradebookMobile from "./GradebookMobile";

describe("mobile gradebook", () => {
  it("distinguishes a zero score from a missing score and shows weight", () => {
    const html = renderToStaticMarkup(
      <GradebookMobile
        criteria={[
          { id: "one", name: "Comunicação", weight: 2 },
          { id: "two", name: "Organização", weight: 1 },
        ]}
        cycles={[{ id: "cycle", title: "1º período", end_date: "2026-10-31" }]}
        reviews={[
          {
            cycle_id: "cycle",
            performance_scores: [{ criterion_id: "one", score: 0, weight: 2 }],
          },
        ]}
      />,
    );
    expect(html).toContain("0,0");
    expect(html).toContain("Nota ainda não lançada");
    expect(html).toContain("Peso");
    expect(html).toContain("2,0");
    expect(html).toContain("Comunicação");
    expect(html).toContain("100% do peso total");
    expect(html).not.toContain("50% do peso total");
    expect(html).toContain("Ainda não compõe a média");
  });

  it("explains the empty period state without a misleading zero average", () => {
    const html = renderToStaticMarkup(
      <GradebookMobile criteria={[]} cycles={[]} reviews={[]} />,
    );
    expect(html).toContain("Nenhum período disponível");
    expect(html).not.toContain("0,0");
  });
});
