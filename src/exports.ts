import type { ReportSnapshot } from "./Dashboard";
import { csvText, dateLabel, label, number } from "./domain";
import { client, json, rpc } from "./api";
import type { ManagerResult } from "./ManagerReviews";
export type ExportFormat = "pdf" | "pptx" | "xlsx" | "csv" | "png";
export type ReportConfig = {
  title: string;
  kind: string;
  employee_id: string | null;
  class_id: string | null;
  positive: string;
  attention: string;
  actions: string;
  conclusion: string;
  managerResults: ManagerResult[];
};
export function tableRows(
  snapshot: ReportSnapshot,
  kind: string,
  managerResults: ManagerResult[] = [],
) {
  if (kind === "management")
    return managerResults.flatMap((c) =>
      c.managers
        .filter((m) => m.available)
        .flatMap((m) =>
          (m.criteria || []).map((s) => ({
            Gestor: m.manager_name,
            Critério: s.name,
            Média: s.average,
            Respostas: m.responses,
          })),
        ),
    );
  if (kind === "performance")
    return snapshot.grades.map((row) => ({
      Colaborador: row.name,
      Ciclo: row.cycle,
      Data: dateLabel(String(row.date)),
      Média: row.average,
    }));
  if (kind === "feedback")
    return snapshot.feedbacks.map((row) => ({
      Colaborador: row.name,
      Título: row.title,
      Tipo: label(row.kind),
      Situação: label(row.status),
      Prazo: dateLabel(String(row.due_date || "")),
    }));
  return snapshot.records
    .filter((row) =>
      kind === "absences"
        ? ["absent", "justified"].includes(String(row.status))
        : kind === "lateness"
          ? Number(row.delay_minutes) > 0
          : true,
    )
    .map((row) => ({
      Data: dateLabel(String(row.date)),
      Turma: row.class_name,
      Colaborador: row.name,
      Matrícula: row.registration,
      Presença: label(row.status),
      Entrada: String(row.actual_arrival || "—").slice(0, 5),
      "Atraso (min)": row.delay_minutes,
      Manutenções: row.maintenance_count,
    }));
}
export function slideContents(snapshot: ReportSnapshot, config: ReportConfig) {
  const m = snapshot.metrics;
  return [
    {
      title: "Gestão de RH",
      subtitle: "Raízes do Futuro",
      body: `${dateLabel(snapshot.period_start)} a ${dateLabel(snapshot.period_end)}`,
      kind: "cover",
    },
    {
      title: "Resumo do período",
      subtitle: `${m.records} registros de presença`,
      body: `${m.active_employees} colaboradores ativos\n${m.feedback_count} feedbacks registrados`,
      kind: "summary",
    },
    {
      title: "Pessoas da equipe",
      subtitle: String(m.active_employees),
      body: `Colaboradores ativos\n${m.employees} cadastros no total`,
      kind: "number",
    },
    {
      title: "Presença nas atividades",
      subtitle:
        m.attendance_rate === null
          ? "Sem registros"
          : `${number(m.attendance_rate, 1)}%`,
      body: `${m.present} presenças no período`,
      kind: "presence",
    },
    {
      title: "Acompanhamento de faltas",
      subtitle: String(m.absent),
      body: `${m.justified} justificadas\n${m.unjustified} não justificadas`,
      kind: "absence",
    },
    {
      title: "Horários de chegada",
      subtitle: `${m.late} atrasos`,
      body: `${number(m.delay_average, 1)} minutos de atraso médio\n${m.delay_total} minutos acumulados`,
      kind: "lateness",
    },
    {
      title: "Pontualidade da equipe",
      subtitle:
        m.punctuality_rate === null
          ? "Sem registros"
          : `${number(m.punctuality_rate, 1)}%`,
      body: "Presenças sem atraso entre os registros de comparecimento.",
      kind: "number",
    },
    {
      title: "Desempenho e evolução",
      subtitle:
        m.performance_average === null
          ? "Sem notas"
          : number(m.performance_average, 1),
      body: "Média das avaliações, com pesos por critério.\nEscala de 0 a 10.",
      kind: "grades",
    },
    {
      title: "Feedbacks registrados",
      subtitle: String(m.feedback_count),
      body: "Acompanhamento de desenvolvimento e ações combinadas.",
      kind: "number",
    },
    {
      title: "Avaliação da gestão",
      subtitle: config.managerResults.some((r) =>
        r.managers.some((m) => m.available),
      )
        ? "Escuta da equipe"
        : "Sem resultados liberados",
      body:
        config.managerResults
          .flatMap((r) =>
            r.managers
              .filter((m) => m.available)
              .map((m) => `${m.manager_name}: ${m.responses} respostas`),
          )
          .join("\n") ||
        "Os resultados dependem do encerramento do ciclo e do mínimo de respostas.",
      kind: "management",
    },
    {
      title: "Pontos positivos",
      subtitle: "O que avançou",
      body: config.positive || "Nenhum ponto registrado para este relatório.",
      kind: "text",
    },
    {
      title: "Pontos de atenção",
      subtitle: "O que acompanhar",
      body:
        config.attention ||
        `${m.pending} registros de presença não preenchidos.`,
      kind: "text",
    },
    {
      title: "Evolução entre períodos",
      subtitle: "Período anterior → atual",
      body: `Presenças: ${snapshot.previous.present} → ${m.present}\nFaltas: ${snapshot.previous.absent} → ${m.absent}\nFeedbacks: ${snapshot.previous.feedback_count} → ${m.feedback_count}`,
      kind: "evolution",
    },
    {
      title: "Próximas ações",
      subtitle: "Acompanhamento do RH",
      body:
        config.actions ||
        "Revisar as pendências e registrar as ações com os responsáveis.",
      kind: "text",
    },
    {
      title: "Continuidade do trabalho",
      subtitle: "Raízes do Futuro",
      body:
        config.conclusion ||
        "Manter o acompanhamento de presença, desenvolvimento e escuta da equipe.",
      kind: "closing",
    },
  ];
}
export async function buildPdf(
  snapshot: ReportSnapshot,
  config: ReportConfig,
  presentation = false,
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({
    orientation: presentation ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });
  const width = doc.internal.pageSize.getWidth(),
    height = doc.internal.pageSize.getHeight();
  const footer = () => {
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(100, 115, 108);
      doc.text("Raízes do Futuro · RH", 18, height - 12);
      doc.text(`${i} / ${total}`, width - 18, height - 12, { align: "right" });
    }
  };
  const header = (title: string) => {
    doc.setTextColor(24, 42, 35);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(23);
    doc.text(title, 18, 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 110, 100);
    doc.text(
      `${dateLabel(snapshot.period_start)} a ${dateLabel(snapshot.period_end)}`,
      18,
      38,
    );
  };
  if (presentation) {
    for (const [i, slide] of slideContents(snapshot, config).entries()) {
      if (i) doc.addPage();
      header(slide.title);
      doc.setFontSize(slide.kind === "number" ? 42 : 28);
      doc.setTextColor(36, 94, 75);
      doc.text(doc.splitTextToSize(slide.subtitle, width - 40), 20, 76);
      doc.setFontSize(18);
      doc.setTextColor(42, 53, 48);
      doc.text(doc.splitTextToSize(slide.body, width - 45), 20, 113, {
        lineHeightFactor: 1.4,
      });
    }
  } else {
    doc.setFillColor(21, 37, 34);
    doc.rect(0, 0, width, height, "F");
    doc.setTextColor(188, 218, 112);
    doc.setFontSize(14);
    doc.text("RAÍZES DO FUTURO", 20, 35);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(34);
    doc.text(doc.splitTextToSize(config.title, width - 40), 20, 100);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(15);
    doc.text(
      `${dateLabel(snapshot.period_start)} a ${dateLabel(snapshot.period_end)}`,
      20,
      150,
    );
    doc.addPage();
    header("Indicadores do período");
    const m = snapshot.metrics;
    autoTable(doc, {
      startY: 49,
      head: [["Indicador", "Atual", "Anterior"]],
      body: [
        [
          "Presença",
          m.attendance_rate === null ? "—" : `${number(m.attendance_rate, 1)}%`,
          snapshot.previous.attendance_rate === null
            ? "—"
            : `${number(snapshot.previous.attendance_rate, 1)}%`,
        ],
        ["Faltas", m.absent, snapshot.previous.absent],
        ["Faltas justificadas", m.justified, snapshot.previous.justified],
        ["Atrasos", m.late, snapshot.previous.late],
        [
          "Média das notas",
          number(m.performance_average, 1),
          number(snapshot.previous.performance_average, 1),
        ],
        ["Feedbacks", m.feedback_count, snapshot.previous.feedback_count],
      ].map((row) => row.map(String)),
      styles: { fontSize: 11, cellPadding: 4 },
      headStyles: { fillColor: [36, 94, 75] },
      margin: { left: 18, right: 18, bottom: 22 },
    });
    if (snapshot.series.length) {
      doc.setFontSize(15);
      doc.text("Presenças e faltas por mês", 18, 163);
      const max = Math.max(
        1,
        ...snapshot.series.map((x) => x.present + x.absent + x.justified),
      );
      snapshot.series.slice(0, 8).forEach((row, i) => {
        const y = 175 + i * 10;
        doc.setFontSize(9);
        doc.text(row.month, 18, y + 4);
        doc.setFillColor(36, 94, 75);
        doc.rect(44, y, (row.present / max) * 112, 5, "F");
        doc.setFillColor(214, 155, 117);
        doc.rect(
          44 + (row.present / max) * 112,
          y,
          ((row.absent + row.justified) / max) * 112,
          5,
          "F",
        );
        doc.text(String(row.present + row.absent + row.justified), 162, y + 4);
      });
    }
    const rows = tableRows(snapshot, config.kind, config.managerResults);
    if (rows.length) {
      doc.addPage();
      header("Registros detalhados");
      const keys = Object.keys(rows[0]);
      autoTable(doc, {
        startY: 48,
        head: [keys],
        body: rows.map((row) => keys.map((key) => String(row[key] ?? "—"))),
        styles: { fontSize: 8, cellPadding: 2.4, overflow: "linebreak" },
        headStyles: { fillColor: [36, 94, 75] },
        margin: { left: 14, right: 14, bottom: 22 },
      });
    }
    if (
      config.positive ||
      config.attention ||
      config.actions ||
      config.conclusion
    ) {
      doc.addPage();
      header("Acompanhamento do RH");
      let y = 55;
      for (const [title, body] of [
        ["Pontos positivos", config.positive],
        ["Pontos de atenção", config.attention],
        ["Ações", config.actions],
        ["Conclusão", config.conclusion],
      ])
        if (body) {
          const lines = doc.splitTextToSize(body, width - 36);
          if (y + lines.length * 5 + 20 > height - 24) {
            doc.addPage();
            header("Acompanhamento do RH");
            y = 55;
          }
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.text(title, 18, y);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
          doc.text(lines, 18, y + 9);
          y += lines.length * 5 + 24;
        }
    }
  }
  footer();
  return doc.output("blob");
}
export async function buildPptx(
  snapshot: ReportSnapshot,
  config: ReportConfig,
) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "RH · Raízes do Futuro";
  pptx.subject = config.title;
  pptx.title = config.title;
  pptx.company = "Raízes do Futuro";
  pptx.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos" };
  const slides = slideContents(snapshot, config);
  for (const [index, item] of slides.entries()) {
    const slide = pptx.addSlide();
    const dark = ["cover", "closing"].includes(item.kind);
    slide.background = { color: dark ? "152522" : "FFFFFF" };
    const text = dark ? "FFFFFF" : "192D25";
    slide.addText("RAÍZES DO FUTURO  /  RH", {
      x: 0.65,
      y: 0.35,
      w: 11.8,
      h: 0.3,
      fontSize: 12,
      color: dark ? "BCDA70" : "517261",
      charSpacing: 1,
    });
    slide.addText(item.title, {
      x: 0.65,
      y: 1.0,
      w: 12,
      h: 0.8,
      fontSize: item.kind === "cover" ? 52 : 35,
      bold: true,
      color: text,
      breakLine: false,
      margin: 0,
    });
    const chart =
      ["presence", "absence", "lateness"].includes(item.kind) &&
      snapshot.series.length > 0;
    slide.addText(item.subtitle, {
      x: 0.65,
      y: 2.05,
      w: chart ? 4.0 : 12,
      h: 1.05,
      fontSize: item.kind === "number" ? 64 : 34,
      bold: true,
      color: dark ? "BCDA70" : "245E4B",
      margin: 0,
    });
    slide.addText(item.body, {
      x: 0.65,
      y: 3.4,
      w: chart ? 4 : 11.8,
      h: 2.1,
      fontSize: 22,
      color: text,
      margin: 0,
      breakLine: false,
      paraSpaceAfter: 12,
      valign: "top",
    });
    if (chart) {
      const keys =
        item.kind === "presence"
          ? ["present"]
          : item.kind === "absence"
            ? ["absent", "justified"]
            : ["late"];
      slide.addChart(
        pptx.ChartType.bar,
        keys.map((key) => ({
          name:
            {
              present: "Presenças",
              absent: "Faltas",
              justified: "Justificadas",
              late: "Atrasos",
            }[key] || key,
          labels: snapshot.series.map((r) => r.month),
          values: snapshot.series.map(
            (r) => r[key as keyof typeof r] as number,
          ),
        })),
        {
          x: 5.0,
          y: 2.3,
          w: 7.55,
          h: 3.75,
          catAxisLabelFontFace: "Aptos",
          catAxisLabelFontSize: 15,
          valAxisLabelFontSize: 14,
          showLegend: keys.length > 1,
          showValue: true,
          showTitle: false,
          chartColors: ["245E4B", "DFA782"],
          legendFontSize: 16,
        },
      );
    }
    slide.addText(
      `${dateLabel(snapshot.period_start)} a ${dateLabel(snapshot.period_end)}`,
      {
        x: 0.65,
        y: 6.9,
        w: 9,
        h: 0.25,
        fontSize: 11,
        color: dark ? "BCD0C4" : "708076",
        margin: 0,
      },
    );
    slide.addText(String(index + 1).padStart(2, "0"), {
      x: 11.8,
      y: 6.82,
      w: 0.8,
      h: 0.35,
      fontSize: 13,
      color: dark ? "BCDA70" : "245E4B",
      align: "right",
      margin: 0,
    });
    slide.addNotes(
      "Dados do relatório gerado pelo RH. Conteúdo e gráficos editáveis.",
    );
  }
  return (await pptx.write({ outputType: "blob" })) as Blob;
}
export async function buildXlsx(
  snapshot: ReportSnapshot,
  config: ReportConfig,
) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RH · Raízes do Futuro";
  const sheet = workbook.addWorksheet("Registros");
  const rows = tableRows(snapshot, config.kind, config.managerResults);
  const keys = rows.length ? Object.keys(rows[0]) : ["Sem registros"];
  sheet.columns = keys.map((key) => ({
    header: key,
    key,
    width: key === "Colaborador" ? 32 : 23,
  }));
  rows.forEach((row) => sheet.addRow(row));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rows.length + 1), column: keys.length },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF245E4B" },
  };
  sheet.getRow(1).height = 25;
  sheet.eachRow((row) => {
    row.alignment = { vertical: "middle", wrapText: true };
  });
  const summary = workbook.addWorksheet("Indicadores");
  summary.addRows([
    [
      "Período",
      `${dateLabel(snapshot.period_start)} a ${dateLabel(snapshot.period_end)}`,
    ],
    ["Presenças", snapshot.metrics.present],
    ["Faltas", snapshot.metrics.absent],
    ["Faltas justificadas", snapshot.metrics.justified],
    ["Atrasos", snapshot.metrics.late],
    ["Média das notas", snapshot.metrics.performance_average],
  ]);
  summary.columns = [{ width: 28 }, { width: 35 }];
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
export async function buildChartPng(snapshot: ReportSnapshot) {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 900;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 1600, 900);
  ctx.fillStyle = "#192d25";
  ctx.font = "bold 45px Arial";
  ctx.fillText("Presença no período", 80, 90);
  ctx.font = "25px Arial";
  ctx.fillText(
    `${dateLabel(snapshot.period_start)} a ${dateLabel(snapshot.period_end)}`,
    80,
    138,
  );
  const series = snapshot.series;
  const max = Math.max(
    1,
    ...series.map((r) => Math.max(r.present, r.absent + r.justified)),
  );
  series.forEach((row, i) => {
    const x = 130 + i * (1300 / Math.max(1, series.length));
    const w = Math.min(70, 500 / Math.max(1, series.length));
    for (const [j, value] of [
      row.present,
      row.absent + row.justified,
    ].entries()) {
      const height = (value / max) * 470;
      ctx.fillStyle = j ? "#dfa782" : "#245e4b";
      ctx.fillRect(x + j * (w + 8), 730 - height, w, height);
      ctx.fillStyle = "#192d25";
      ctx.font = "24px Arial";
      ctx.fillText(String(value), x + j * (w + 8), 718 - height);
    }
    ctx.fillStyle = "#51655a";
    ctx.font = "22px Arial";
    ctx.fillText(row.month, x, 774);
  });
  if (!series.length) {
    ctx.font = "32px Arial";
    ctx.fillText("Nenhum registro no período.", 80, 430);
  }
  ctx.fillStyle = "#245e4b";
  ctx.fillRect(80, 835, 22, 22);
  ctx.fillStyle = "#192d25";
  ctx.font = "22px Arial";
  ctx.fillText("Presenças", 115, 855);
  ctx.fillStyle = "#dfa782";
  ctx.fillRect(320, 835, 22, 22);
  ctx.fillStyle = "#192d25";
  ctx.fillText("Faltas", 355, 855);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("EXPORT_FAILED"))),
      "image/png",
    ),
  );
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportReport(
  snapshot: ReportSnapshot,
  config: ReportConfig,
  format: ExportFormat,
  presentation = false,
) {
  const blob =
    format === "pdf"
      ? await buildPdf(snapshot, config, presentation)
      : format === "pptx"
        ? await buildPptx(snapshot, config)
        : format === "xlsx"
          ? await buildXlsx(snapshot, config)
          : format === "png"
            ? await buildChartPng(snapshot)
            : new Blob(
                [
                  csvText(
                    tableRows(snapshot, config.kind, config.managerResults),
                  ),
                ],
                { type: "text/csv;charset=utf-8" },
              );
  const id = await rpc("register_report", {
    payload: json({
      title: config.title,
      kind: config.kind,
      period_start: snapshot.period_start,
      period_end: snapshot.period_end,
      employee_id: config.employee_id,
      class_id: config.class_id,
    }),
  });
  const {
    data: { user },
    error: userError,
  } = await client().auth.getUser();
  if (userError || !user) throw userError || new Error("FORBIDDEN");
  const name = `RH_${snapshot.period_start}_${snapshot.period_end}.${format}`;
  const path = `${user.id}/${id}/${name}`;
  const mime = {
    pdf: "application/pdf",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
    png: "image/png",
  }[format];
  const { error } = await client()
    .storage.from("exports")
    .upload(path, blob, { contentType: mime, upsert: false });
  if (error) throw error;
  await rpc("register_export", {
    report_identifier: String(id),
    format_name: format,
    file_path: path,
  });
  downloadBlob(blob, name);
}
