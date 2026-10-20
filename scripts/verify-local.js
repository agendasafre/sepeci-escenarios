const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { FORM_CONFIG } = require("../form-config");
const { getFormAvailability } = require("../api/_shared");
const handler = require("../api/submit");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const main = fs.readFileSync(path.join(root, "main.js"), "utf8");
const sql = fs.readFileSync(
  path.join(root, "sql", "008_enrollment_submissions_escenarios.sql"), "utf8",
);

assert.ok(html.includes("TALLER DE CONSTRUCCIÓN DE ESCENARIOS"));
assert.ok(html.includes("5 de noviembre de 2026"));
assert.ok(html.includes("17 hs."));
assert.ok(html.includes("Hall Rectorado"));
assert.ok(html.includes("Todos los datos son obligatorios."));
assert.match(html, /<input\s+id="educationalInstitution"[^>]*type="text"[^>]*required[^>]*maxlength="180"/);
assert.ok(!html.includes("educationalInstitutionOther"));
assert.ok(sql.includes("public.enrollment_submissions_escenarios"));
assert.ok(sql.includes("enrollment_submissions_escenarios_dni_key unique (dni)"));
assert.ok(sql.includes("enable row level security"));

// Run browser validation and availability logic with a minimal DOM.
const node = { addEventListener() {} };
const browser = vm.createContext({
  window: { FORM_CONFIG, setTimeout() {} },
  document: { querySelector() { return node; } },
  Date,
});
vm.runInContext(main, browser);
const validPayload = {
  firstNames: "Ana", lastNames: "Pérez", dni: "30123456",
  gender: "No binario", email: "ana@example.org", phone: "2641234567",
  educationalInstitution: "Instituto de investigación independiente",
};

async function run() {
  const originalNow = Date.now;
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  let writes = [];
  let upstreamStatus = 201;
  try {
    process.env.SUPABASE_URL = "https://supabase.example";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-only";
    process.env.ALLOWED_ORIGIN = "https://form.example";
    process.env.RATE_LIMIT_MAX = "1000";
    global.fetch = async (url, options) => {
      writes.push({ url, data: JSON.parse(options.body) });
      return {
        ok: upstreamStatus === 201, status: upstreamStatus,
        async json() { return { code: "23505" }; },
      };
    };
    async function submit(body = validPayload) {
      const res = {
        setHeader() {},
        end(value) { this.body = JSON.parse(value); },
      };
      await handler({
        method: "POST", body,
        headers: { "content-type": "application/json", origin: "https://form.example" },
      }, res);
      return res;
    }

    const start = Date.parse(FORM_CONFIG.startsAt);
    const end = Date.parse(FORM_CONFIG.expiresAt);
    for (const [time, expected] of [
      [start - 1, "not_started"], [start, "open"],
      [end, "open"], [end + 1, "expired"],
    ]) {
      Date.now = () => time;
      assert.equal(getFormAvailability(), expected);
      assert.equal(vm.runInContext("getFormAvailability()", browser), expected);
      const res = await submit();
      assert.equal(res.statusCode, expected === "open" ? 201 : 410);
      assert.equal(res.body.status, expected === "open" ? "accepted" : expected);
    }

    Date.now = () => start;
    assert.equal(Object.keys(browser.validateForm(validPayload)).length, 0);
    assert.equal(writes.length, 2);
    assert.equal(writes[0].url, "https://supabase.example/rest/v1/enrollment_submissions_escenarios");
    assert.equal(writes[0].data.educational_institution, validPayload.educationalInstitution);
    writes = [];

    for (const field of Object.keys(validPayload)) {
      const invalid = { ...validPayload, [field]: "   " };
      assert.ok(browser.validateForm(invalid)[field], `Browser requires ${field}`);
      const res = await submit(invalid);
      assert.equal(res.statusCode, 400);
      assert.ok(res.body.fields[field], `Server requires ${field}`);
    }
    for (const institution of ["Otra institución", "x".repeat(180)]) {
      const payload = { ...validPayload, educationalInstitution: institution };
      assert.equal(Object.keys(browser.validateForm(payload)).length, 0);
      assert.equal((await submit(payload)).statusCode, 201);
    }
    writes = [];
    const tooLong = { ...validPayload, educationalInstitution: "x".repeat(181) };
    assert.ok(browser.validateForm(tooLong).educationalInstitution);
    assert.equal((await submit(tooLong)).statusCode, 400);
    assert.equal(writes.length, 0, "Invalid submissions must not reach Supabase");
    for (const gender of ["Masculino", "Femenino", "No binario", "Otro"]) {
      assert.equal((await submit({ ...validPayload, gender })).statusCode, 201);
    }
    assert.equal((await submit({ ...validPayload, gender: "Invalid" })).statusCode, 400);
    upstreamStatus = 409;
    const duplicate = await submit();
    assert.equal(duplicate.statusCode, 409);
    assert.equal(duplicate.body.status, "duplicate");
    console.log("Local verification passed: browser/server validation, registration boundaries, new table routing and duplicates (mocked Supabase).");
  } finally {
    Date.now = originalNow;
    global.fetch = originalFetch;
    for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ALLOWED_ORIGIN", "RATE_LIMIT_MAX"]) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
