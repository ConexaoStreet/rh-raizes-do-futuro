import { describe, expect, it } from "vitest";
import { validateChatFile } from "./chat-files";

describe("private chat attachments", () => {
  it("accepts spreadsheets and normalizes a CSV browser fallback", () => {
    expect(
      validateChatFile({
        name: "pauta.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 500,
      }),
    ).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(validateChatFile({ name: "pauta.csv", type: "", size: 500 })).toBe(
      "text/csv",
    );
  });
  it("rejects scripts, macros, fake extensions and oversized attachments", () => {
    for (const file of [
      { name: "ata.html", type: "text/html", size: 100 },
      { name: "ata.html", type: "application/pdf", size: 100 },
      { name: "ata.xlsm", type: "application/vnd.ms-excel", size: 100 },
      { name: "ata.svg", type: "image/svg+xml", size: 100 },
      { name: "ata.pdf", type: "application/pdf", size: 10485761 },
      { name: "ata.pdf", type: "application/pdf", size: 0 },
      { name: "../ata.pdf", type: "application/pdf", size: 100 },
    ])
      expect(() => validateChatFile(file)).toThrow("INVALID_FILE");
  });
});
