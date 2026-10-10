const types: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};
export const chatFileAccept =
  ".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.csv,.docx,.txt";
export function validateChatFile(file: {
  name: string;
  type: string;
  size: number;
}) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const mime = types[extension];
  if (
    !mime ||
    file.size <= 0 ||
    file.size > 10 * 1024 * 1024 ||
    file.name.length > 160 ||
    /[\x00-\x1f\x7f/\\]/.test(file.name) ||
    (file.type &&
      file.type !== mime &&
      !(extension === "csv" && file.type === "application/vnd.ms-excel"))
  )
    throw new Error("INVALID_FILE");
  return mime;
}
