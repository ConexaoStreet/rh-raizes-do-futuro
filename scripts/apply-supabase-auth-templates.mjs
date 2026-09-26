import fs from "node:fs";

const token = (process.env.SUPABASE_ACCESS_TOKEN || "").trim();
const projectRef = (process.env.SUPABASE_PROJECT_REF || "").trim();

if (!token) {
  console.log("::warning::SUPABASE_ACCESS_TOKEN is not configured. Hosted Auth template sync was skipped.");
  process.exit(0);
}

if (!projectRef) {
  throw new Error("SUPABASE_PROJECT_REF is required when SUPABASE_ACCESS_TOKEN is configured.");
}

const read = (name) => fs.readFileSync(new URL("../supabase/templates/" + name, import.meta.url), "utf8");

const payload = {
  mailer_subjects_confirmation: "Confirme seu Gmail | Raízes do Futuro",
  mailer_templates_confirmation_content: read("confirmation.html"),
  mailer_subjects_magic_link: "Seu acesso seguro | Raízes do Futuro",
  mailer_templates_magic_link_content: read("magic_link.html"),
  mailer_subjects_recovery: "Redefina sua senha | Raízes do Futuro",
  mailer_templates_recovery_content: read("recovery.html"),
  mailer_subjects_invite: "Seu acesso ao Raízes do Futuro",
  mailer_templates_invite_content: read("invite.html"),
  mailer_subjects_reauthentication: "{{ .Token }} é seu código | Raízes do Futuro",
  mailer_templates_reauthentication_content: read("reauthentication.html"),
  mailer_subjects_email_change: "Confirme seu novo e-mail | Raízes do Futuro",
  mailer_templates_email_change_content: read("email_change.html"),

  mailer_notifications_password_changed_enabled: true,
  mailer_subjects_password_changed_notification: "Sua senha foi alterada | Raízes do Futuro",
  mailer_templates_password_changed_notification_content: read("password_changed_notification.html"),

  mailer_notifications_email_changed_enabled: true,
  mailer_subjects_email_changed_notification: "Seu e-mail foi alterado | Raízes do Futuro",
  mailer_templates_email_changed_notification_content: read("email_changed_notification.html"),

  mailer_notifications_phone_changed_enabled: true,
  mailer_subjects_phone_changed_notification: "Seu telefone foi alterado | Raízes do Futuro",
  mailer_templates_phone_changed_notification_content: read("phone_changed_notification.html"),

  mailer_notifications_mfa_factor_enrolled_enabled: true,
  mailer_subjects_mfa_factor_enrolled_notification: "Novo método de verificação | Raízes do Futuro",
  mailer_templates_mfa_factor_enrolled_notification_content: read("mfa_factor_enrolled_notification.html"),

  mailer_notifications_mfa_factor_unenrolled_enabled: true,
  mailer_subjects_mfa_factor_unenrolled_notification: "Método de verificação removido | Raízes do Futuro",
  mailer_templates_mfa_factor_unenrolled_notification_content: read("mfa_factor_unenrolled_notification.html"),

  mailer_notifications_identity_linked_enabled: true,
  mailer_subjects_identity_linked_notification: "Novo método de entrada conectado | Raízes do Futuro",
  mailer_templates_identity_linked_notification_content: read("identity_linked_notification.html"),

  mailer_notifications_identity_unlinked_enabled: true,
  mailer_subjects_identity_unlinked_notification: "Método de entrada removido | Raízes do Futuro",
  mailer_templates_identity_unlinked_notification_content: read("identity_unlinked_notification.html")
};

const response = await fetch(
  "https://api.supabase.com/v1/projects/" + projectRef + "/config/auth",
  {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  }
);

if (!response.ok) {
  const text = await response.text();
  throw new Error("Supabase Auth template sync failed (" + response.status + "): " + text.slice(0, 500));
}

console.log("Supabase hosted Auth email templates synchronized.");
