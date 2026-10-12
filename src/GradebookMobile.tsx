import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { dateLabel, weightedAverage } from "./domain";

export type Criterion = { id: string; name: string; weight: number };
export type GradeCycle = { id: string; title: string; end_date: string };
export type GradeReview = {
  cycle_id: string;
  performance_scores: {
    criterion_id: string;
    criterion_name?: string;
    score: number;
    weight: number;
  }[];
};
const gradeLabel = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);

export default function GradebookMobile({
  criteria,
  cycles,
  reviews,
}: {
  criteria: Criterion[];
  cycles: GradeCycle[];
  reviews: GradeReview[];
}) {
  const [selection, setSelection] = useState("");
  const cycle =
    cycles.find((item) => item.id === selection) ||
    [...cycles]
      .reverse()
      .find((item) => reviews.some((review) => review.cycle_id === item.id)) ||
    cycles[0];
  const review = reviews.find((item) => item.cycle_id === cycle?.id);
  const scores = review?.performance_scores || [];
  const periodAverage = weightedAverage(scores);
  const weightTotal = scores.reduce((sum, score) => sum + score.weight, 0);
  const visibleCriteria = new Map(
    criteria.map((criterion) => [criterion.id, criterion]),
  );
  for (const score of scores)
    if (!visibleCriteria.has(score.criterion_id))
      visibleCriteria.set(score.criterion_id, {
        id: score.criterion_id,
        name: score.criterion_name || "Competência",
        weight: score.weight,
      });
  return (
    <div className="gradebook-mobile">
      {!cycle ? (
        <p className="muted">Nenhum período disponível.</p>
      ) : (
        <>
          <label className="mobile-period-picker">
            <span>Selecione o período</span>
            <div>
              <select
                aria-label="Período do boletim"
                value={cycle.id}
                onChange={(event) => setSelection(event.target.value)}
              >
                {cycles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} aria-hidden="true" />
            </div>
          </label>
          <div className="mobile-period-summary">
            <BookOpen size={20} aria-hidden="true" />
            <div>
              <strong>{cycle.title}</strong>
              <small>Até {dateLabel(cycle.end_date)}</small>
            </div>
            <span>
              <strong>
                {periodAverage == null ? "-" : gradeLabel(periodAverage)}
              </strong>
              <small>Média ponderada</small>
            </span>
          </div>
          <div className="mobile-grade-list">
            {Array.from(visibleCriteria.values()).map((criterion) => {
              const score = scores.find(
                (item) => item.criterion_id === criterion.id,
              );
              const weight = score?.weight ?? criterion.weight;
              const contribution =
                score && weightTotal > 0 ? (weight / weightTotal) * 100 : 0;
              return (
                <article className="mobile-grade-card" key={criterion.id}>
                  <div className="mobile-grade-heading">
                    <h3>{criterion.name}</h3>
                    <span className="grade-weight">
                      Peso {gradeLabel(weight)}
                    </span>
                  </div>
                  <div className="mobile-grade-result">
                    <strong>
                      {score == null ? "-" : gradeLabel(score.score)}
                      <small> / 10</small>
                    </strong>
                    <span>
                      {score == null
                        ? "Nota ainda não lançada"
                        : "Nota neste período"}
                    </span>
                  </div>
                  <div className="mobile-weight-track" aria-hidden="true">
                    <span
                      style={{ width: `${Math.min(100, contribution)}%` }}
                    />
                  </div>
                  <small className="muted">
                    {score == null
                      ? "Ainda não compõe a média"
                      : weightTotal > 0
                        ? `${Math.round(contribution)}% do peso total`
                        : "Peso não definido"}
                  </small>
                </article>
              );
            })}
          </div>
          <p className="gradebook-explanation">
            A média usa os pesos das notas lançadas. Uma nota ausente não conta
            como zero.
          </p>
        </>
      )}
    </div>
  );
}
