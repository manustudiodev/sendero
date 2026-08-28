const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const INVITATION_ROLES = new Set(["viewer", "collaborator"]);
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

export class InvitationEmailDeliveryError extends Error {
  constructor(message, {
    code = "provider_error",
    retryable = false,
    retryAfterMs,
    providerStatus,
    cause,
  } = {}) {
    super(message, { cause });
    this.name = "InvitationEmailDeliveryError";
    this.code = code;
    this.retryable = retryable;
    if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) this.retryAfterMs = retryAfterMs;
    if (Number.isInteger(providerStatus)) this.providerStatus = providerStatus;
  }
}

function retryAfterMilliseconds(response) {
  const raw = response?.headers?.get?.("retry-after");
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const at = Date.parse(raw);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : undefined;
}

export function classifyInvitationEmailError(error) {
  if (error instanceof InvitationEmailDeliveryError) {
    return {
      code: error.code,
      retryable: error.retryable,
      ...(error.retryAfterMs !== undefined ? { retryAfterMs: error.retryAfterMs } : {}),
      ...(error.providerStatus !== undefined ? { providerStatus: error.providerStatus } : {}),
    };
  }
  return { code: "unexpected_error", retryable: true };
}

function cleanRequiredText(value, fallback, maxLength) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, maxLength) : fallback;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function mailboxAddress(value) {
  if (typeof value !== "string") return "";
  const candidate = value.trim();
  const displayAddress = candidate.match(/^.{1,100}<([^<>]+)>$/);
  return (displayAddress?.[1] || candidate).trim();
}

export function isValidEmailAddress(value) {
  if (typeof value !== "string" || /[\r\n]/.test(value)) return false;
  const address = mailboxAddress(value);
  if (!address || address.length > 254) return false;

  const separator = address.lastIndexOf("@");
  if (separator < 1 || separator > 64 || separator === address.length - 1) return false;
  const local = address.slice(0, separator);
  const domain = address.slice(separator + 1);
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  if (domain.length > 253 || !domain.includes(".")) return false;

  return domain.split(".").every(
    (label) =>
      label.length >= 1 &&
      label.length <= 63 &&
      /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label),
  );
}

export function validateInvitationUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("El enlace de invitación de Sendero no es válido.");
  }

  const localHttp = url.protocol === "http:" && LOCAL_HOSTNAMES.has(url.hostname);
  if ((url.protocol !== "https:" && !localHttp) || url.username || url.password) {
    throw new Error("El enlace de invitación debe usar HTTPS fuera del entorno local.");
  }
  return url.href;
}

export function invitationEmailContent({
  inviteUrl,
  role,
  ownerName,
  tripTitle,
}) {
  const validatedUrl = validateInvitationUrl(inviteUrl);
  if (!INVITATION_ROLES.has(role)) {
    throw new Error("El permiso de la invitación debe ser viewer o collaborator.");
  }

  const owner = cleanRequiredText(ownerName, "Alguien", 80);
  const trip = cleanRequiredText(tripTitle, "un itinerario", 140);
  const canCollaborate = role === "collaborator";
  const action = canCollaborate ? "colaborar en" : "ver";
  const permission = canCollaborate
    ? "Podrás ver el itinerario y ayudar a organizarlo junto con el resto del grupo."
    : "Podrás consultar el itinerario, sus recorridos y la información compartida contigo.";
  const cta = canCollaborate ? "Colaborar en el itinerario" : "Ver el itinerario";
  const subject = `${owner} te invitó a ${action} ${trip} en Sendero`;

  return {
    subject,
    text: [
      `Hola,`,
      "",
      `${owner} te invitó a ${action} “${trip}” en Sendero.`,
      permission,
      "",
      `${cta}: ${validatedUrl}`,
      "",
      "Si no esperabas esta invitación, puedes ignorar este mensaje.",
      "",
      "Sendero · Los viajes se organizan conversando.",
    ].join("\n"),
    html: `
      <div style="margin:0;background:#f6f2e4;color:#063d38;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px 16px">
        <div style="box-sizing:border-box;margin:0 auto;max-width:600px;border:1px solid rgba(0,102,94,.18);border-radius:22px;background:#fff;padding:32px">
          <p style="margin:0 0 24px;color:#00665e;font-size:14px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Sendero</p>
          <h1 style="margin:0 0 16px;color:#063d38;font-size:28px;line-height:1.15">${escapeHtml(owner)} te invitó a ${escapeHtml(action)} un viaje</h1>
          <p style="margin:0 0 12px;color:#234b47;font-size:17px;line-height:1.6">El itinerario es <strong>${escapeHtml(trip)}</strong>.</p>
          <p style="margin:0 0 28px;color:#476561;font-size:16px;line-height:1.6">${escapeHtml(permission)}</p>
          <a href="${escapeHtml(validatedUrl)}" style="display:inline-block;border-radius:999px;background:#00665e;color:#fff;font-size:16px;font-weight:700;line-height:1;padding:15px 22px;text-decoration:none">${escapeHtml(cta)}</a>
          <p style="margin:28px 0 0;color:#6c7f7c;font-size:14px;line-height:1.5">Si no esperabas esta invitación, puedes ignorar este mensaje.</p>
        </div>
      </div>
    `.trim(),
  };
}

function configuredResendProvider({ apiKey, fetchImpl }) {
  if (typeof fetchImpl !== "function") {
    throw new Error("No hay un cliente HTTP disponible para enviar la invitación.");
  }

  return {
    name: "resend",
    async send(message, { idempotencyKey } = {}) {
      let response;
      try {
        response = await fetchImpl(RESEND_EMAILS_URL, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
            ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
          },
          body: JSON.stringify(message),
        });
      } catch (cause) {
        throw new InvitationEmailDeliveryError(
          "No pudimos enviar la invitación. Inténtalo nuevamente.",
          { code: "provider_unreachable", retryable: true, cause },
        );
      }

      if (!response?.ok) {
        const status = Number.isInteger(response?.status) ? response.status : undefined;
        const retryable =
          status === undefined || status === 408 || status === 409 || status === 429 || status >= 500;
        throw new InvitationEmailDeliveryError(
          "No pudimos enviar la invitación. Inténtalo nuevamente.",
          {
            code: status ? `provider_http_${status}` : "provider_invalid_response",
            retryable,
            retryAfterMs: retryAfterMilliseconds(response),
            providerStatus: status,
          },
        );
      }

      let result = {};
      try {
        result = await response.json();
      } catch {
        // A successful provider response does not need a body.
      }
      return { id: typeof result?.id === "string" ? result.id : undefined };
    },
  };
}

function normalizeProvider(provider) {
  if (typeof provider === "function") return { name: "custom", send: provider };
  if (provider && typeof provider.send === "function") return provider;
  throw new Error("El proveedor de email configurado no es válido.");
}

export async function sendInvitationEmail(
  { to, role, inviteUrl, ownerName, tripTitle, idempotencyKey },
  {
    env = process.env,
    fetchImpl = globalThis.fetch,
    provider,
  } = {},
) {
  if (!isValidEmailAddress(to)) {
    throw new Error("El email de la persona invitada no es válido.");
  }
  if (!INVITATION_ROLES.has(role)) {
    throw new Error("El permiso de la invitación debe ser viewer o collaborator.");
  }
  if (
    idempotencyKey !== undefined &&
    (typeof idempotencyKey !== "string" ||
      idempotencyKey.length < 1 ||
      idempotencyKey.length > 256 ||
      /[^\x21-\x7E]/.test(idempotencyKey))
  ) {
    throw new Error("La clave idempotente del correo no es válida.");
  }

  const content = invitationEmailContent({ inviteUrl, role, ownerName, tripTitle });
  let deliveryProvider;
  let from;

  if (provider !== undefined) {
    deliveryProvider = normalizeProvider(provider);
    from = cleanRequiredText(env?.SENDERO_EMAIL_FROM, "Sendero <no-reply@sendero.local>", 254);
  } else {
    const apiKey = typeof env?.RESEND_API_KEY === "string" ? env.RESEND_API_KEY.trim() : "";
    from = typeof env?.SENDERO_EMAIL_FROM === "string" ? env.SENDERO_EMAIL_FROM.trim() : "";
    if (!apiKey || !from) return { status: "not_configured" };
    if (!isValidEmailAddress(from) || typeof fetchImpl !== "function") {
      return { status: "not_configured" };
    }
    deliveryProvider = configuredResendProvider({ apiKey, fetchImpl });
  }

  const result = await deliveryProvider.send(
    {
      from,
      to: [mailboxAddress(to)],
      subject: content.subject,
      html: content.html,
      text: content.text,
    },
    { idempotencyKey },
  );

  return {
    status: "sent",
    ...(typeof result?.id === "string" ? { id: result.id } : {}),
  };
}
