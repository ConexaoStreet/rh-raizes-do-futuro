import { client, json, rpc } from "./api";
import { validateChatFile } from "./chat-files";
export type ChatRoom = {
  id: string;
  department_id: string | null;
  name: string;
};
export type ChatAttachment = {
  id: string;
  path: string;
  filename: string;
  size_bytes: number;
  mime_type: string;
};
export type ChatMessage = {
  id: string;
  sequence: number;
  room_id: string;
  author_id: string;
  author_name: string;
  body: string;
  filtered: boolean;
  moderated: boolean;
  created_at: string;
  attachments: ChatAttachment[];
};
export type ChatHistory = {
  viewer: string;
  room_id: string;
  messages: ChatMessage[];
  has_more: boolean;
};
export type ChatRooms = {
  viewer: string;
  moderator: boolean;
  rooms: ChatRoom[];
};
export async function discardChatAttachment(attachment: ChatAttachment) {
  const { error } = await client()
    .storage.from("chat-files")
    .remove([attachment.path]);
  if (error) throw error;
  await rpc("discard_chat_attachment", {
    attachment_identifier: attachment.id,
  });
}
export async function uploadChatAttachment(room: string, file: File) {
  const mime = validateChatFile(file);
  const attachment = (await rpc("reserve_chat_attachment", {
    payload: json({
      room_id: room,
      filename: file.name,
      size_bytes: file.size,
      mime_type: mime,
    }),
  })) as unknown as ChatAttachment;
  try {
    const { error } = await client()
      .storage.from("chat-files")
      .upload(attachment.path, file, { contentType: mime, upsert: false });
    if (error) throw error;
    return attachment;
  } catch (error) {
    await discardChatAttachment(attachment).catch(() => undefined);
    throw error;
  }
}
export async function downloadChatAttachment(attachment: ChatAttachment) {
  const { data, error } = await client()
    .storage.from("chat-files")
    .createSignedUrl(attachment.path, 120, { download: attachment.filename });
  if (error) throw error;
  const link = document.createElement("a");
  link.href = data.signedUrl;
  link.rel = "noopener noreferrer";
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
