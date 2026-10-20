const { FORM_CONFIG } = require("../form-config");

const MAX_BODY_BYTES = 12 * 1024;

function send(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function setCors(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const origin = req.headers.origin;

  if (allowedOrigin && origin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function isAllowedOrigin(req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const origin = req.headers.origin;

  if (!allowedOrigin || !origin) return true;
  return origin === allowedOrigin;
}

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment variables are not configured");
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    serviceRoleKey,
  };
}

function getFormConfig() {
  return FORM_CONFIG;
}

function parseConfiguredDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getFormAvailability() {
  const now = Date.now();
  const startsAt = parseConfiguredDate(FORM_CONFIG?.startsAt);
  const expiresAt = parseConfiguredDate(FORM_CONFIG?.expiresAt);

  if (startsAt && now < startsAt.getTime()) return "not_started";
  if (expiresAt && now > expiresAt.getTime()) return "expired";
  return "open";
}

module.exports = {
  MAX_BODY_BYTES,
  send,
  setCors,
  isAllowedOrigin,
  getSupabaseConfig,
  getFormConfig,
  getFormAvailability,
};
