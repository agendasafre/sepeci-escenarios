const GENDER_VALUES = ["Masculino", "Femenino", "No binario", "Otro"];
const {
  MAX_BODY_BYTES,
  getSupabaseConfig,
  isAllowedOrigin,
  getFormAvailability,
  send,
  setCors,
} = require("./_shared");

const rateLimitHits = new Map();

function normalizeDni(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function getClientKey(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function isRateLimited(req) {
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
  const maxHits = Number(process.env.RATE_LIMIT_MAX || 10);
  const now = Date.now();
  const key = getClientKey(req);
  const record = rateLimitHits.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }

  record.count += 1;
  rateLimitHits.set(key, record);
  return record.count > maxHits;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);

  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Payload too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function validatePayload(payload) {
  const fields = {};
  const clean = {};

  for (const key of [
    "firstNames",
    "lastNames",
    "dni",
    "gender",
    "email",
    "phone",
    "educationalInstitution",
  ]) {
    clean[key] = String(payload[key] || "").trim();
  }

  for (const key of [
    "firstNames",
    "lastNames",
    "dni",
    "gender",
    "email",
    "phone",
    "educationalInstitution",
  ]) {
    if (!clean[key]) fields[key] = "Este campo es obligatorio.";
  }

  const dni = normalizeDni(clean.dni);
  if (clean.dni && clean.dni !== dni) fields.dni = "Ingresá el DNI solo con números.";
  if (!/^[0-9]{7,8}$/.test(dni)) fields.dni = "Ingresá un DNI válido de 7 u 8 números.";
  if (clean.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) {
    fields.email = "Ingresá un email válido.";
  }
  if (clean.phone && !/^[0-9]{1,10}$/.test(clean.phone)) {
    fields.phone =
      "Ingresá un teléfono válido, solo con números y hasta 10 caracteres.";
  }
  if (clean.gender && !GENDER_VALUES.includes(clean.gender)) {
    fields.gender = "Seleccioná una opción válida.";
  }
  if (clean.educationalInstitution && clean.educationalInstitution.length > 180) {
    fields.educationalInstitution =
      "La unidad académica/institución debe tener hasta 180 caracteres.";
  }

  return { fields, clean, dni };
}

async function insertSubmission(clean, dni) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();

  const response = await fetch(`${supabaseUrl}/rest/v1/enrollment_submissions_escenarios`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      first_names: clean.firstNames,
      last_names: clean.lastNames,
      dni,
      gender: clean.gender,
      email: clean.email,
      phone: clean.phone,
      educational_institution: clean.educationalInstitution,
      metadata: {},
    }),
  });

  if (response.ok) return;

  const errorBody = await response.json().catch(() => ({}));
  const error = new Error("Supabase insert failed");
  error.code = errorBody.code;
  error.statusCode = response.status;
  throw error;
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!isAllowedOrigin(req)) {
    send(res, 403, { status: "forbidden" });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    send(res, 405, { status: "failed" });
    return;
  }

  const formAvailability = getFormAvailability();
  if (formAvailability !== "open") {
    send(res, 410, { status: formAvailability });
    return;
  }

  if (isRateLimited(req)) {
    send(res, 429, { status: "rate_limited" });
    return;
  }

  if (Number(req.headers["content-length"] || 0) > MAX_BODY_BYTES) {
    send(res, 400, { status: "invalid", fields: {} });
    return;
  }

  if (!String(req.headers["content-type"] || "").includes("application/json")) {
    send(res, 400, { status: "invalid", fields: {} });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    if (String(payload.website || "").trim()) {
      send(res, 429, { status: "rate_limited" });
      return;
    }

    const { fields, clean, dni } = validatePayload(payload);
    if (Object.keys(fields).length > 0) {
      send(res, 400, { status: "invalid", fields });
      return;
    }

    await insertSubmission(clean, dni);
    send(res, 201, { status: "accepted" });
  } catch (error) {
    if (error instanceof SyntaxError) {
      send(res, 400, { status: "invalid", fields: {} });
      return;
    }

    if (error.statusCode === 413) {
      send(res, 400, { status: "invalid", fields: {} });
      return;
    }

    if (error.code === "23505" || error.statusCode === 409) {
      send(res, 409, { status: "duplicate" });
      return;
    }

    send(res, 500, { status: "failed" });
  }
};
