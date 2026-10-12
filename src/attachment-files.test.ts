import { expect, it } from "vitest";
import { validateAttachmentFile } from "./attachment-files";

it("respeita os tipos aceitos pelo bucket de justificativas e feedbacks", () => {
  const document = {
    name: "documento.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 500,
  };
  expect(() => validateAttachmentFile(document, "justifications")).toThrow(
    "INVALID_FILE",
  );
  expect(() => validateAttachmentFile(document, "feedback-files")).toThrow(
    "INVALID_FILE",
  );
  expect(validateAttachmentFile(document, "documents")).toBe("docx");
});
it("recusa arquivos vazios e extensões falsas antes do upload", () => {
  for (const file of [
    { name: "arquivo.html", type: "application/pdf", size: 500 },
    { name: "arquivo.pdf", type: "application/pdf", size: 0 },
    { name: "arquivo.pdf", type: "application/pdf", size: 10485761 },
  ])
    expect(() => validateAttachmentFile(file, "documents")).toThrow(
      "INVALID_FILE",
    );
  expect(
    validateAttachmentFile(
      { name: "atestado.pdf", type: "application/pdf", size: 500 },
      "justifications",
    ),
  ).toBe("pdf");
});
