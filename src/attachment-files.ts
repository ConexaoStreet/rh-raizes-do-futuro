export function validateAttachmentFile(
  file: Pick<File, "name" | "type" | "size">,
  bucket: "documents" | "justifications" | "feedback-files",
) {
  const extension = file.name.split(".").at(-1)?.toLowerCase() || "";
  const types: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
  };
  if (bucket === "documents")
    types.docx =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (
    !file.size ||
    file.size > 10 * 1024 * 1024 ||
    file.name.length > 180 ||
    /[\u0000-\u001f/\\]/.test(file.name) ||
    !types[extension] ||
    types[extension] !== file.type
  )
    throw new Error("INVALID_FILE");
  return extension;
}
