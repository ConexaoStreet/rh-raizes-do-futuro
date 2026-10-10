import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Download,
  Flag,
  LoaderCircle,
  MessageCircle,
  Paperclip,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "./auth";
import { client, rpc, runAction, useAsync } from "./api";
import { ErrorState, Loading, Modal } from "./components";
import { dateLabel, errorMessage } from "./domain";
import { chatFileAccept, validateChatFile } from "./chat-files";
import {
  discardChatAttachment,
  downloadChatAttachment,
  uploadChatAttachment,
  type ChatAttachment,
  type ChatHistory,
  type ChatMessage,
  type ChatRoom,
  type ChatRooms,
} from "./chat";
import "./styles/chat.css";
type ChatDialog = {
  message: ChatMessage;
  moderate: boolean;
  reportId?: string;
  dismiss?: boolean;
};
type ReportsQueue = {
  viewer: string;
  room_id: string;
  reports: {
    id: string;
    reason: string;
    created_at: string;
    message: ChatMessage;
  }[];
};

export default function Chat() {
  const { user } = useAuth();
  return <ChatAccount key={user.profile.id} owner={user.profile.id} />;
}
function ChatAccount({ owner }: { owner: string }) {
  const [params] = useSearchParams();
  const [selected, setSelected] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const rooms = useAsync(
    async () => (await rpc("chat_rooms_snapshot", {})) as unknown as ChatRooms,
    [owner],
  );
  const data = rooms.data?.viewer === owner ? rooms.data : null;
  const room =
    data?.rooms.find((r) => r.id === selected) ||
    data?.rooms.find((r) => r.department_id === params.get("setor")) ||
    data?.rooms[0];
  if (!data && rooms.loading) return <Loading />;
  if (!data) return <ErrorState retry={rooms.reload} />;
  return (
    <>
      <header className="chat-page-heading">
        <div>
          <span className="eyebrow">CONEXÃO ENTRE AS EQUIPES</span>
          <h1>Conversas do Raízes</h1>
          <p>
            Combine os próximos passos e compartilhe os materiais da equipe.
          </p>
        </div>
        <span className="chat-safety-label">
          <ShieldCheck size={16} />
          Filtro de linguagem ativo
        </span>
      </header>
      {Boolean(rooms.error) && <ErrorState retry={rooms.reload} />}
      <div className="chat-layout">
        <aside className="panel chat-room-list" aria-label="Salas de conversa">
          <h2>Conversas</h2>
          {data.rooms.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r.id)}
              aria-pressed={room?.id === r.id}
            >
              <MessageCircle size={18} />
              <span>
                <strong>{r.name}</strong>
                <small>
                  {r.department_id
                    ? "Equipe do setor"
                    : "Todas as pessoas do Raízes"}
                </small>
              </span>
            </button>
          ))}
          <p>As salas dos setores acompanham o vínculo aprovado pelo RH.</p>
        </aside>
        {room ? (
          <RoomConversation
            key={`${owner}:${room.id}`}
            owner={owner}
            room={room}
            moderator={data.moderator}
            draft={drafts[room.id] || ""}
            onDraft={(text) =>
              setDrafts((current) => ({ ...current, [room.id]: text }))
            }
          />
        ) : (
          <div className="panel padded">
            Nenhuma conversa está disponível para seu acesso.
          </div>
        )}
      </div>
    </>
  );
}
function RoomConversation({
  owner,
  room,
  moderator,
  draft,
  onDraft,
}: {
  owner: string;
  room: ChatRoom;
  moderator: boolean;
  draft: string;
  onDraft: (text: string) => void;
}) {
  const state = useAsync(
    async () =>
      (await rpc("chat_history", {
        room_identifier: room.id,
      })) as unknown as ChatHistory,
    [owner, room.id],
  );
  const data =
    state.data?.viewer === owner && state.data.room_id === room.id
      ? state.data
      : null;
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [hasOlder, setHasOlder] = useState<boolean | null>(null);
  const [paging, setPaging] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [dialog, setDialog] = useState<ChatDialog | null>(null);
  const reports = useAsync(
    async () =>
      moderator
        ? ((await rpc("chat_reports_queue", {
            room_identifier: room.id,
          })) as unknown as ReportsQueue)
        : { viewer: owner, room_id: room.id, reports: [] },
    [owner, room.id, moderator],
  );
  const reportQueue =
    reports.data?.viewer === owner && reports.data.room_id === room.id
      ? reports.data.reports
      : [];
  const active = useRef(true);
  const pending = useRef<ChatAttachment[]>([]);
  const attempt = useRef<{ fingerprint: string; id: string } | null>(null);
  const feed = useRef<HTMLDivElement>(null);
  const { reload } = state;
  const { reload: reloadReports } = reports;
  useEffect(() => {
    active.current = true;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (active.current && document.visibilityState === "visible") {
          reload();
          if (moderator) reloadReports();
        }
      }, 150);
    };
    const channel = client()
      .channel(`chat-${owner}-${room.id}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const changed = payload.new as Record<string, unknown>;
          if (changed.moderated_at && active.current) {
            setOlder([]);
            setHasOlder(null);
          }
          refresh();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh();
      });
    const timer = window.setInterval(refresh, 20000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      active.current = false;
      clearTimeout(debounce);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
      void client().removeChannel(channel);
      for (const attachment of pending.current)
        void discardChatAttachment(attachment).catch(() => undefined);
    };
  }, [owner, room.id, reload, moderator, reloadReports]);
  const messages = [
    ...new Map(
      [...older, ...(data?.messages || [])].map((m) => [m.id, m]),
    ).values(),
  ].sort((a, b) => a.sequence - b.sequence);
  const latest = data?.messages[0]?.sequence;
  useEffect(() => {
    if (!older.length && feed.current)
      feed.current.scrollTop = feed.current.scrollHeight;
  }, [latest, older.length]);
  async function loadOlder() {
    if (!messages.length || paging) return;
    setPaging(true);
    try {
      const result = (await rpc("chat_history", {
        room_identifier: room.id,
        before_sequence: messages[0].sequence,
      })) as unknown as ChatHistory;
      if (
        active.current &&
        result.viewer === owner &&
        result.room_id === room.id
      ) {
        setOlder((current) => [...result.messages, ...current]);
        setHasOlder(result.has_more);
      }
    } catch (error) {
      if (active.current) toast.error(errorMessage(error));
    } finally {
      if (active.current) setPaging(false);
    }
  }
  async function addFiles(files: File[]) {
    if (files.length + pending.current.length > 3) {
      toast.error("Cada mensagem pode ter até 3 anexos.");
      return;
    }
    try {
      files.forEach(validateChatFile);
    } catch (error) {
      toast.error(errorMessage(error));
      return;
    }
    setUploading(true);
    try {
      for (const file of files) {
        const attachment = await uploadChatAttachment(room.id, file);
        if (!active.current) {
          await discardChatAttachment(attachment).catch(() => undefined);
          break;
        }
        pending.current = [...pending.current, attachment];
        setAttachments(pending.current);
      }
    } catch (error) {
      if (active.current) toast.error(errorMessage(error));
    } finally {
      if (active.current) setUploading(false);
    }
  }
  async function removeFile(attachment: ChatAttachment) {
    const ok = await runAction(() => discardChatAttachment(attachment), "");
    if (ok && active.current) {
      pending.current = pending.current.filter((a) => a.id !== attachment.id);
      setAttachments(pending.current);
    }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (sending || uploading || (!draft.trim() && !attachments.length)) return;
    const fingerprint = JSON.stringify({
      body: draft,
      attachments: attachments.map((a) => a.id),
    });
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, id: crypto.randomUUID() };
    setSending(true);
    try {
      const message = (await rpc("send_chat_message", {
        room_identifier: room.id,
        body: draft,
        attachment_identifiers: attachments.map((a) => a.id),
        request_identifier: attempt.current.id,
      })) as unknown as ChatMessage;
      if (
        active.current &&
        message.room_id === room.id &&
        message.author_id === owner
      ) {
        onDraft("");
        pending.current = [];
        setAttachments([]);
        attempt.current = null;
        reload();
        toast.success(
          message.filtered
            ? "Mensagem enviada com o texto substituído pelo filtro de linguagem."
            : "Mensagem enviada.",
        );
      }
    } catch (error) {
      if (active.current) {
        toast.error(errorMessage(error));
        reload();
      }
    } finally {
      if (active.current) setSending(false);
    }
  }
  return (
    <section
      className="panel chat-conversation"
      aria-label={`Conversa ${room.name}`}
    >
      <header className="chat-conversation-heading">
        <div>
          <h2>{room.name}</h2>
          <span>
            {room.department_id
              ? "Um espaço para os combinados desta equipe."
              : "Um encontro entre todos os setores."}
          </span>
        </div>
        <ShieldCheck size={21} aria-label="Conversa com filtro de linguagem" />
      </header>
      {moderator && (
        <details className="chat-moderation-queue">
          <summary>Mensagens para revisão ({reportQueue.length})</summary>
          {Boolean(reports.error) && <ErrorState retry={reports.reload} />}
          {!reportQueue.length && !reports.loading && (
            <p>Nenhuma denúncia pendente nesta conversa.</p>
          )}
          {reportQueue.map((report) => (
            <article key={report.id}>
              <strong>{report.message.author_name}</strong>
              <p>{report.message.body}</p>
              <small>Motivo da denúncia: {report.reason}</small>
              <div>
                <button
                  onClick={() =>
                    setDialog({ message: report.message, moderate: true })
                  }
                >
                  Remover mensagem
                </button>
                <button
                  onClick={() =>
                    setDialog({
                      message: report.message,
                      moderate: false,
                      reportId: report.id,
                      dismiss: true,
                    })
                  }
                >
                  Encerrar revisão
                </button>
              </div>
            </article>
          ))}
        </details>
      )}
      {Boolean(state.error) && (
        <div className="chat-error">
          <ErrorState retry={reload} />
        </div>
      )}
      <div
        className="chat-message-feed"
        ref={feed}
        aria-label="Histórico da conversa"
        aria-busy={state.loading && !data}
      >
        {data && (hasOlder ?? data.has_more) && (
          <button
            className="chat-load-older"
            onClick={() => void loadOlder()}
            disabled={paging}
          >
            {paging ? "Carregando..." : "Carregar mensagens anteriores"}
          </button>
        )}
        {!data && state.loading && <Loading />}
        {data && !messages.length && (
          <div className="chat-empty">
            <MessageCircle size={30} />
            <h3>Vamos começar a conversa?</h3>
            <p>
              Compartilhe um combinado, uma dúvida ou os materiais da equipe.
            </p>
          </div>
        )}
        {messages.map((message) => (
          <article
            className={`chat-message ${message.author_id === owner ? "chat-message-own" : ""}`}
            key={message.id}
          >
            <div className="chat-message-meta">
              <strong>
                {message.author_id === owner ? "Você" : message.author_name}
              </strong>
              <time dateTime={message.created_at}>
                {dateLabel(message.created_at, true)}
              </time>
            </div>
            <p className={message.moderated ? "muted" : ""}>{message.body}</p>
            {message.attachments.map((attachment) => (
              <button
                className="chat-file"
                key={attachment.id}
                onClick={() =>
                  void runAction(() => downloadChatAttachment(attachment), "")
                }
              >
                <Download size={17} />
                <span>
                  {attachment.filename}
                  <small>{Math.ceil(attachment.size_bytes / 1024)} KB</small>
                </span>
              </button>
            ))}
            {!message.moderated && (
              <div className="chat-message-tools">
                <button
                  aria-label={`Denunciar mensagem de ${message.author_name}`}
                  onClick={() => setDialog({ message, moderate: false })}
                >
                  <Flag size={13} />
                  Denunciar
                </button>
                {moderator && (
                  <button
                    onClick={() => setDialog({ message, moderate: true })}
                  >
                    <Trash2 size={13} />
                    Remover
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      <form className="chat-composer" onSubmit={(event) => void send(event)}>
        {attachments.length > 0 && (
          <div className="chat-pending-files">
            {attachments.map((attachment) => (
              <span key={attachment.id}>
                <Paperclip size={14} />
                <span>{attachment.filename}</span>
                <button
                  type="button"
                  aria-label={`Remover anexo ${attachment.filename}`}
                  disabled={sending || uploading}
                  onClick={() => void removeFile(attachment)}
                >
                  <X size={15} />
                </button>
              </span>
            ))}
          </div>
        )}
        <label className="sr-only" htmlFor="chat-body">
          Mensagem para {room.name}
        </label>
        <textarea
          id="chat-body"
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Escreva para a equipe..."
          disabled={sending}
        />
        <div className="chat-composer-bottom">
          <label
            className={`button chat-attach ${uploading || sending ? "disabled" : ""}`}
          >
            <Paperclip size={17} />
            Anexar
            <input
              type="file"
              multiple
              accept={chatFileAccept}
              disabled={uploading || sending || attachments.length >= 3}
              onChange={(event) => {
                const files = [...(event.target.files || [])];
                event.target.value = "";
                void addFiles(files);
              }}
            />
          </label>
          <span>
            {uploading ? "Enviando anexo..." : `${draft.length}/2000`}
          </span>
          <button
            className="primary"
            type="submit"
            disabled={
              sending || uploading || (!draft.trim() && !attachments.length)
            }
          >
            {sending ? <LoaderCircle size={17} /> : <Send size={17} />}
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </div>
        <p className="chat-composer-note">
          Até 3 anexos de 10 MB cada. PDF, imagens, planilhas, Word e texto.
          Respeite as pessoas; você pode denunciar mensagens para revisão.
        </p>
      </form>
      {dialog && (
        <Modal
          title={
            dialog.dismiss
              ? "Encerrar revisão"
              : dialog.moderate
                ? "Remover mensagem"
                : "Denunciar mensagem"
          }
          open
          onClose={() => setDialog(null)}
        >
          <ModerationForm
            dialog={dialog}
            done={() => {
              setDialog(null);
              setOlder([]);
              setHasOlder(null);
              reload();
              reports.reload();
            }}
          />
        </Modal>
      )}
    </section>
  );
}
function ModerationForm({
  dialog,
  done,
}: {
  dialog: ChatDialog;
  done: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(
      new FormData(event.currentTarget).get("reason") || "",
    );
    setBusy(true);
    const ok = await runAction(
      () =>
        dialog.dismiss && dialog.reportId
          ? rpc("dismiss_chat_report", {
              report_identifier: dialog.reportId,
              reason,
            })
          : dialog.moderate
            ? rpc("moderate_chat_message", {
                message_identifier: dialog.message.id,
                reason,
              })
            : rpc("report_chat_message", {
                message_identifier: dialog.message.id,
                reason,
              }),
      dialog.dismiss
        ? "Revisão encerrada."
        : dialog.moderate
          ? "Mensagem removida."
          : "Denúncia enviada para revisão.",
    );
    setBusy(false);
    if (ok) done();
  }
  return (
    <form onSubmit={(event) => void submit(event)}>
      <p>
        {dialog.dismiss
          ? "Registre o resultado da conferência. A mensagem continuará na conversa e a denúncia será encerrada."
          : dialog.moderate
            ? "A mensagem ficará oculta para os participantes e a ação ficará registrada."
            : "Explique o que precisa ser conferido. Sua denúncia fica visível apenas para a moderação."}
      </p>
      <label>
        Motivo
        <textarea
          name="reason"
          minLength={3}
          maxLength={1000}
          required
          rows={4}
        />
      </label>
      <button className="primary" disabled={busy}>
        {busy
          ? "Enviando..."
          : dialog.dismiss
            ? "Encerrar revisão"
            : dialog.moderate
              ? "Remover mensagem"
              : "Enviar denúncia"}
      </button>
    </form>
  );
}
