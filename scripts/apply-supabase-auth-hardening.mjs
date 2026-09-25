const token = (process.env.SUPABASE_ACCESS_TOKEN || "").trim();
const projectRef = (process.env.SUPABASE_PROJECT_REF || "").trim();

if (!token) {
  console.log("::warning::SUPABASE_ACCESS_TOKEN is not configured. Hosted Auth hardening was skipped.");
  process.exit(0);
}

if (!projectRef) {
  throw new Error("SUPABASE_PROJECT_REF is required when SUPABASE_ACCESS_TOKEN is configured.");
}

const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

const requiredCharacters =
  "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:!@#$%^&*()_+-=[]{};'\\\":|<>?,./\`~";

const coreConfig = {
  password_min_length: 12,
  password_required_characters: requiredCharacters,
  security_update_password_require_reauthentication: true,
  mailer_secure_email_change_enabled: true,
  refresh_token_rotation_enabled: true,
};

async function request(method, body) {
  const response = await fetch(endpoint, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const responseText = await response.text();
  let payload = {};
  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = {};
    }
  }
  return { response, payload };
}

const core = await request("PATCH", coreConfig);
if (!core.response.ok) {
  throw new Error(
    `Supabase Auth hardening failed with HTTP ${core.response.status}.`,
  );
}

let hibpRequested = false;
const hibp = await request("PATCH", { password_hibp_enabled: true });
if (hibp.response.ok) {
  hibpRequested = true;
} else if ([400, 402, 403, 422].includes(hibp.response.status)) {
  console.log(
    `::warning::Leaked password protection could not be enabled (HTTP ${hibp.response.status}). The remaining Auth hardening is active.`,
  );
} else {
  throw new Error(
    `Leaked password protection update failed with HTTP ${hibp.response.status}.`,
  );
}

const verification = await request("GET");
if (!verification.response.ok) {
  throw new Error(
    `Supabase Auth hardening verification failed with HTTP ${verification.response.status}.`,
  );
}

const config = verification.payload;
for (const [key, value] of Object.entries(coreConfig)) {
  if (config[key] !== value) {
    throw new Error(`Supabase Auth setting ${key} did not persist as expected.`);
  }
}

if (hibpRequested && config.password_hibp_enabled !== true) {
  throw new Error("Leaked password protection did not persist as expected.");
}

console.log(
  JSON.stringify({
    auth_hardening: "verified",
    password_min_length: config.password_min_length,
    password_required_characters: Boolean(config.password_required_characters),
    require_reauthentication: config.security_update_password_require_reauthentication,
    secure_email_change: config.mailer_secure_email_change_enabled,
    refresh_token_rotation: config.refresh_token_rotation_enabled,
    leaked_password_protection: config.password_hibp_enabled === true,
  }),
);
