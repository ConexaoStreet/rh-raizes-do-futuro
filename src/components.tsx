import { useEffect, useRef, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  Inbox,
  LoaderCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { label } from "./domain";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <img
        className="brand-logo-mark"
        src="/brand/raizes-logo-mark.png"
        alt="Símbolo Raízes do Futuro"
      />
      {!compact && (
        <div>
          Raízes do Futuro<small>GESTÃO DE RH</small>
        </div>
      )}
    </div>
  );
}
export function Heading({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function Badge({ value }: { value: unknown }) {
  return <span className={`badge badge-${String(value)}`}>{label(value)}</span>;
}
export function Empty({
  text = "Nenhum registro encontrado.",
  children,
}: {
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox size={30} />
      <p>{text}</p>
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={25} />
      <span>Carregando...</span>
    </div>
  );
}
export function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div className="empty" role="alert">
      <AlertCircle />
      <p>Não foi possível carregar os registros.</p>
      <button onClick={retry}>Tentar novamente</button>
    </div>
  );
}
export function Modal({
  title,
  open,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal ${wide ? "modal-wide" : ""}`}
          aria-describedby={undefined}
        >
          <div className="modal-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close aria-label="Fechar" className="icon-button">
              <X size={21} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Field({
  label: fieldLabel,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const id = useRef(`field-${crypto.randomUUID()}`);
  useEffect(() => {
    const root = document.getElementById(id.current);
    const input = root?.querySelector("input,select,textarea");
    if (input) {
      input.id = `${id.current}-control`;
      root?.querySelector("label")?.setAttribute("for", input.id);
    }
  }, []);
  return (
    <div id={id.current} className={`field ${wide ? "field-wide" : ""}`}>
      <label>{fieldLabel}</label>
      {children}
    </div>
  );
}
export function Pagination({
  page,
  total,
  size = 25,
  onChange,
}: {
  page: number;
  total: number;
  size?: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <span>{total} registros</span>
      <div>
        <button
          className="icon-button"
          aria-label="Página anterior"
          disabled={!page}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <span>
          {page + 1} de {Math.max(1, Math.ceil(total / size))}
        </span>
        <button
          className="icon-button"
          aria-label="Próxima página"
          disabled={(page + 1) * size >= total}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
export function Stat({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="stat">
      <div className="stat-label">
        {title}
        {icon}
      </div>
      <strong>{value}</strong>
      {detail && <div className="stat-detail">{detail}</div>}
    </div>
  );
}
