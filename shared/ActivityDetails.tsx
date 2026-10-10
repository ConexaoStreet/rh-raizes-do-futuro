import {
  describeActivity,
  type ActivityEntry,
  type ActivityNames,
} from "./activity-language";
import "./activity.css";

export function ActivityDetails({
  entry,
  names,
  when,
}: {
  entry: ActivityEntry;
  names?: ActivityNames;
  when: string;
}) {
  const activity = describeActivity(entry, names);
  return (
    <div className="activity-details">
      <p className="activity-description">{activity.description}</p>
      <dl className="activity-facts">
        <div>
          <dt>
            <strong>Quando</strong>
          </dt>
          <dd>{when}</dd>
        </div>
        <div>
          <dt>
            <strong>Área</strong>
          </dt>
          <dd>{activity.area}</dd>
        </div>
        <div>
          <dt>
            <strong>Resultado</strong>
          </dt>
          <dd>{activity.result}</dd>
        </div>
        {activity.subject && (
          <div>
            <dt>
              <strong>Relacionado a</strong>
            </dt>
            <dd>{activity.subject}</dd>
          </div>
        )}
        {activity.reason && (
          <div>
            <dt>
              <strong>Motivo informado</strong>
            </dt>
            <dd>{activity.reason}</dd>
          </div>
        )}
      </dl>
      {activity.changes.length > 0 ? (
        <section
          className="activity-changes"
          aria-label={entry.success ? "O que mudou" : "O que foi tentado"}
        >
          <h3>{entry.success ? "O que mudou" : "O que foi tentado"}</h3>
          <dl>
            {activity.changes.map((change, index) => (
              <div className="activity-change" key={`${change.field}-${index}`}>
                <dt>
                  <strong>{change.field}</strong>
                </dt>
                <dd>
                  <span>Antes</span>
                  <p>{change.before}</p>
                </dd>
                <dd>
                  <span>Depois</span>
                  <p>{change.after}</p>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : (
        <p className="activity-help">
          Este registro guarda a atividade e seu resultado. Não há outros campos
          para comparar.
        </p>
      )}
    </div>
  );
}
