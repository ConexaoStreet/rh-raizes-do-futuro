import { useMemo, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import {
  Bug,
  FileWarning,
  Headphones,
  ImagePlus,
  KeyRound,
  Lightbulb,
  MessageCircleQuestion,
  Send,
  ShieldAlert,
  Smartphone,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { client } from "./api";
import { useAuth } from "./auth";
import { Heading } from "./components";
import { dateLabel } from "./domain";
import { capture, captureError } from "./telemetry";

type Category = "bug" | "error" | "access" | "question" | "suggestion" | "other";

const categoryOptions: {
  value: Category;
  label: string;
  description: string;
  icon: typeof Bug;
}[] = [
  {
    value: "bug",
    label: "Bug",
    description: "Algo não funciona como deveria.",
    icon: Bug,
  },
  {
    value: "error",
    label: "Erro",
    description: "Mensagem de erro ou comportamento inesperado.",
    icon: FileWarning,
  },
  {
    value: "access",
    label: "Acesso ou login",
    description: "Problema para entrar, acessar uma área ou permissão.",
    icon: KeyRound,
  },
  {
    value: "question",
    label: "Dúvida",
    description: "Ajuda para usar alguma função do sistema.",
    icon: MessageCircleQuestion,
  },
  {
    value: "suggestion",
    label: "Sugestão",
    description: "Ideia de melhoria para o sistema.",
    icon: Lightbulb,
  },
  {
    value: "other",
    label: "Outro",
    description: "Qualquer outro assunto relacionado à T.I.",
    icon: Headphones,
  },
];

const pageOptions = [
  ["/", "Visão geral / Meu perfil"],
  ["/hoje", "Hoje"],
  ["/colaboradores", "Colaboradores"],
  ["/chamada", "Chamada do dia"],
  ["/presenca", "Histórico de chamadas"],
  ["/faltas", "Faltas"],
  ["/atrasos", "Atrasos"],
  ["/justificativas", "Justificativas"],
  ["/feedbacks", "Feedbacks"],
  ["/notas", "Notas"],
  ["/gestao", "Avaliação da gestão"],
  ["/calendario", "Calendário de cursos"],
  ["/relatorios", "Relatórios"],
  ["/apresentacoes", "Apresentações"],
  ["/notificacoes", "Notificações"],
  ["/sessoes", "Minhas sessões"],
  ["/usuarios", "Usuários"],
  ["/cargos", "Cargos e permissões"],
  ["/auditoria", "Logs e auditoria"],
  ["/configuracoes", "Configurações"],
  ["/admin", "Administração total"],
  ["/suporte-ti", "Chamado T.I."],
] as const;

function pageLabel(path: string) {
  if (path.startsWith("/colaboradores/")) return "Perfil de colaborador";
  if (path.startsWith("/configuracoes/")) return "Configurações";
  return pageOptions.find(([value]) => value === path)?.[1] || path || "Página não identificada";
}

function safeFileName(value: string) {
  const parts = value.split(".");
  const extension = parts.length > 1 ? parts.pop()!.toLowerCase() : "bin";
  const base = parts
    .join(".")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "anexo"}.${extension}`;
}

function shortBrowser(userAgent: string) {
  if (/Edg\//.test(userAgent)) return "Microsoft Edge";
  if (/Chrome\//.test(userAgent)) return "Google Chrome";
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return "Safari";
  if (/Firefox\//.test(userAgent)) return "Firefox";
  return "Navegador não identificado";
}

export default function SupportTickets() {
  const { user, session } = useAuth();
  const location = useLocation();
  const sourcePath =
    (location.state as { reportPath?: string } | null)?.reportPath || "/suporte-ti";

  const [category, setCategory] = useState<Category>("bug");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [relatedPath, setRelatedPath] = useState(sourcePath);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{
    protocol: string;
    whatsAppUrl: string;
    createdAt: string;
  } | null>(null);

  const relatedLabel = useMemo(() => pageLabel(relatedPath), [relatedPath]);
  const categoryLabel =
    categoryOptions.find((item) => item.value === category)?.label || "Outro";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    if (attachment && attachment.size > 10 * 1024 * 1024) {
      toast.error("O anexo pode ter no máximo 10 MB.");
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (attachment && !allowed.includes(attachment.type)) {
      toast.error("Envie uma imagem PNG/JPG/WebP ou um PDF.");
      return;
    }

    setBusy(true);
    const ticketId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const pageUrl = new URL(relatedPath, window.location.origin).href;
    const technicalContext = {
      browser: shortBrowser(navigator.userAgent),
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      screen: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language,
      online: navigator.onLine,
      platform: navigator.platform || null,
    };

    let attachmentPath: string | null = null;
    let signedAttachmentUrl = "";

    try {
      if (attachment) {
        attachmentPath = `${session.user.id}/${ticketId}/${safeFileName(attachment.name)}`;
        const { error: uploadError } = await client()
          .storage.from("ti-support")
          .upload(attachmentPath, attachment, {
            cacheControl: "3600",
            upsert: false,
            contentType: attachment.type,
          });
        if (uploadError) throw uploadError;

        const { data: signed, error: signedError } = await client()
          .storage.from("ti-support")
          .createSignedUrl(attachmentPath, 60 * 60 * 24 * 7);
        if (signedError) throw signedError;
        signedAttachmentUrl = signed.signedUrl;
      }

      const { error } = await client().from("ti_support_tickets").insert({
        id: ticketId,
        user_id: session.user.id,
        category,
        subject: subject.trim(),
        description: description.trim(),
        page_path: relatedPath,
        page_url: pageUrl,
        page_title: relatedLabel,
        technical_context: technicalContext,
        attachment_path: attachmentPath,
        status: "open",
        created_at: createdAt,
        updated_at: createdAt,
      });
      if (error) throw error;

      const protocol = `TI-${createdAt.slice(0, 10).replaceAll("-", "")}-${ticketId
        .slice(0, 6)
        .toUpperCase()}`;
      const brandUrl = new URL(
        "/brand/raizes-logo-mark.png",
        window.location.origin,
      ).href;

      const message = [
        "🌱 *Raízes do Futuro • Chamado T.I.*",
        "",
        `*Protocolo:* ${protocol}`,
        `*Solicitante:* ${user.profile.full_name}`,
        `*Motivo:* ${categoryLabel}`,
        `*Resumo:* ${subject.trim()}`,
        "",
        "*Relato:*",
        description.trim(),
        "",
        `*Página relacionada:* ${relatedLabel}`,
        `*Link da página:* ${pageUrl}`,
        `*Enviado em:* ${dateLabel(createdAt, true)}`,
        `*Navegador:* ${technicalContext.browser}`,
        `*Tela:* ${technicalContext.viewport}`,
        signedAttachmentUrl ? `*Anexo:* ${signedAttachmentUrl}` : "",
        `*Identidade Raízes do Futuro:* ${brandUrl}`,
      ]
        .filter(Boolean)
        .join("\n");

      const whatsAppUrl = `https://wa.me/5511919730067?text=${encodeURIComponent(
        message,
      )}`;

      setSent({ protocol, whatsAppUrl, createdAt });
      capture("ti_support_ticket_created", {
        category,
        has_attachment: Boolean(attachment),
        page_path: relatedPath,
      });
      toast.success("Chamado registrado. Abrindo o WhatsApp...");
      window.location.href = whatsAppUrl;
    } catch (error) {
      if (attachmentPath) {
        await client().storage.from("ti-support").remove([attachmentPath]);
      }
      captureError("ti_support_ticket", error);
      toast.error("Não foi possível registrar o chamado. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="support-page">
      <Heading title="Chamado T.I." eyebrow="SUPORTE TÉCNICO" />

      <section className="support-hero card">
        <div className="support-hero-icon" aria-hidden="true">
          <Headphones size={30} />
        </div>
        <div>
          <h2>Precisa de ajuda com o sistema?</h2>
          <p>
            Relate um erro, bug, problema de acesso ou dúvida. O sistema registra
            o chamado e prepara uma mensagem completa para o WhatsApp da T.I.
          </p>
        </div>
      </section>

      {sent && (
        <section className="support-success card" aria-live="polite">
          <div>
            <strong>Chamado {sent.protocol} registrado.</strong>
            <span>
              Se o WhatsApp não abriu automaticamente, use o botão ao lado.
            </span>
          </div>
          <a
            className="primary"
            href={sent.whatsAppUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Send size={18} />
            Abrir WhatsApp
          </a>
        </section>
      )}

      <form className="support-form" onSubmit={submit}>
        <section className="card">
          <div className="support-section-heading">
            <div>
              <span>1</span>
              <div>
                <h2>Qual é o motivo?</h2>
                <p>Escolha a opção que melhor descreve o chamado.</p>
              </div>
            </div>
          </div>

          <div className="support-category-grid">
            {categoryOptions.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.value}
                  className={category === item.value ? "selected" : ""}
                  onClick={() => setCategory(item.value)}
                  aria-pressed={category === item.value}
                >
                  <Icon size={20} />
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="card">
          <div className="support-section-heading">
            <div>
              <span>2</span>
              <div>
                <h2>Conte o que aconteceu</h2>
                <p>Quanto mais claro o relato, mais rápido fica o atendimento.</p>
              </div>
            </div>
          </div>

          <div className="form-stack">
            <label>
              <span className="field-label">Resumo do problema</span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                minLength={3}
                maxLength={120}
                placeholder="Ex.: botão de salvar não funciona"
                required
              />
            </label>

            <label>
              <span className="field-label">Descrição</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                minLength={10}
                maxLength={1800}
                rows={7}
                placeholder="Explique o que você estava fazendo, o que aconteceu e o que esperava que acontecesse."
                required
              />
              <small className="muted">{description.length}/1800 caracteres</small>
            </label>

            <label>
              <span className="field-label">Página relacionada</span>
              <select
                value={relatedPath}
                onChange={(event) => setRelatedPath(event.target.value)}
              >
                {!pageOptions.some(([path]) => path === relatedPath) && (
                  <option value={relatedPath}>{pageLabel(relatedPath)}</option>
                )}
                {pageOptions.map(([path, label]) => (
                  <option key={path} value={path}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <div className="support-context">
              <ShieldAlert size={18} />
              <div>
                <strong>Contexto automático do chamado</strong>
                <span>
                  Vamos incluir a página, data/hora, navegador e tamanho da tela.
                  Parâmetros sensíveis da URL não são enviados.
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="support-section-heading">
            <div>
              <span>3</span>
              <div>
                <h2>Anexo opcional</h2>
                <p>Uma captura de tela pode ajudar bastante.</p>
              </div>
            </div>
          </div>

          <label className="support-upload">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(event) => setAttachment(event.target.files?.[0] || null)}
            />
            <ImagePlus size={24} />
            <div>
              <strong>
                {attachment ? attachment.name : "Adicionar imagem ou PDF"}
              </strong>
              <span>PNG, JPG, WebP ou PDF • até 10 MB</span>
            </div>
            {attachment && (
              <button
                type="button"
                className="icon-button"
                aria-label="Remover anexo"
                onClick={(event) => {
                  event.preventDefault();
                  setAttachment(null);
                }}
              >
                <X size={18} />
              </button>
            )}
          </label>
        </section>

        <section className="support-submit card">
          <div>
            <Smartphone size={22} />
            <div>
              <strong>Enviar chamado para a T.I.</strong>
              <span>
                O protocolo fica salvo no sistema e o WhatsApp abre com a mensagem
                pronta para envio.
              </span>
            </div>
          </div>
          <button className="primary large" disabled={busy}>
            {busy ? "Registrando..." : "Registrar e abrir WhatsApp"}
            <Send size={18} />
          </button>
        </section>
      </form>

      <p className="support-footnote">
        O WhatsApp não permite que links <code>wa.me</code> anexem arquivos
        automaticamente. Quando houver screenshot/PDF, a mensagem leva um link
        temporário e privado para o anexo.
      </p>
    </div>
  );
}
