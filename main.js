const GENDER_VALUES = ["Masculino", "Femenino", "No binario", "Otro"];
const formConfig = window.FORM_CONFIG || {};

const form = document.querySelector("#enrollment-form");
const result = document.querySelector("#result");
const submitButton = document.querySelector("#submit-button");
const dniInput = document.querySelector("#dni");
const dniPreview = document.querySelector("#dni-preview");
const successDialog = document.querySelector("#success-dialog");
const successDialogClose = document.querySelector("#success-dialog-close");
const duplicateDialog = document.querySelector("#duplicate-dialog");
const duplicateDialogClose = document.querySelector("#duplicate-dialog-close");
const phoneInput = document.querySelector("#phone");
const SUBMIT_ENDPOINT = "/api/submit";

function parseConfiguredDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getFormAvailability() {
  const now = Date.now();
  const startsAt = parseConfiguredDate(formConfig.startsAt);
  const expiresAt = parseConfiguredDate(formConfig.expiresAt);

  if (startsAt && now < startsAt.getTime()) return "not_started";
  if (expiresAt && now > expiresAt.getTime()) return "expired";
  return "open";
}

function showUnavailableMessage(status) {
  const splash = document.querySelector("#splash");
  const card = splash.querySelector(".splash__card");
  const hasNotStarted = status === "not_started";
  const message = hasNotStarted
    ? formConfig.notStartedMessage || "El período de inscripción todavía no comenzó."
    : formConfig.expiredMessage || "El formulario ya no se encuentra disponible.";

  card.innerHTML = `
    <p class="eyebrow">Inscripción</p>
    <h1>${hasNotStarted ? "Inscripción próxima" : "Formulario cerrado"}</h1>
    <p class="splash__text">${message}</p>
  `;
}

function showForm() {
  const availability = getFormAvailability();
  if (availability !== "open") {
    showUnavailableMessage(availability);
    return;
  }

  document.querySelector("#splash").hidden = true;
  document.querySelector("#form-view").hidden = false;
  document.querySelector("#firstNames").focus();
}

window.setTimeout(showForm, 2400);

function normalizeDni(value) {
  return String(value || "").replace(/[^0-9]/g, "").slice(0, 8);
}

function setFieldError(name, message = "") {
  const input = form.elements[name];
  const field = input?.closest(".field");
  const error = document.querySelector(`#${name}-error`);
  if (!field || !error) return;
  field.classList.toggle("has-error", Boolean(message));
  input.setAttribute("aria-invalid", message ? "true" : "false");
  error.textContent = message;
}

function clearErrors() {
  [
    "firstNames",
    "lastNames",
    "dni",
    "gender",
    "email",
    "phone",
    "educationalInstitution",
  ].forEach((name) => setFieldError(name));
}

function validateForm(data) {
  const errors = {};
  const required = [
    "firstNames",
    "lastNames",
    "dni",
    "gender",
    "email",
    "phone",
    "educationalInstitution",
  ];

  required.forEach((name) => {
    if (!String(data[name] || "").trim()) errors[name] = "Este campo es obligatorio.";
  });

  const dni = normalizeDni(data.dni);
  if (dni.length !== String(data.dni || "").replace(/[^0-9]/g, "").length) {
    errors.dni = "El DNI debe tener como máximo 8 números.";
  }
  if (dni && !/^[0-9]{7,8}$/.test(dni)) {
    errors.dni = "Ingresá un DNI válido de 7 u 8 números.";
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = "Ingresá un email válido.";
  }
  if (data.phone && !/^[0-9]{1,10}$/.test(data.phone)) {
    errors.phone =
      "Ingresá un teléfono válido, solo con números y hasta 10 caracteres.";
  }
  if (data.gender && !GENDER_VALUES.includes(data.gender)) {
    errors.gender = "Seleccioná una opción válida.";
  }
  if (String(data.educationalInstitution || "").trim().length > 180) {
    errors.educationalInstitution =
      "La unidad académica/institución debe tener hasta 180 caracteres.";
  }

  return errors;
}

function collectFormData() {
  const data = Object.fromEntries(new FormData(form).entries());
  data.educationalInstitution = String(data.educationalInstitution || "").trim();
  return data;
}

function showResult(status, message) {
  result.hidden = false;
  result.className = `result result--${status}`;
  result.textContent = message;
}

function showSuccessPopup() {
  try {
    if (
      successDialog &&
      typeof successDialog.showModal === "function" &&
      !successDialog.open
    ) {
      successDialog.showModal();
      return;
    }
  } catch (error) {
    console.error("No se pudo abrir el popup de éxito:", error);
  }

  window.alert("Tu inscripción fue recibida correctamente.");
}

function showDuplicatePopup() {
  try {
    if (
      duplicateDialog &&
      typeof duplicateDialog.showModal === "function" &&
      !duplicateDialog.open
    ) {
      duplicateDialog.showModal();
      return;
    }
  } catch (error) {
    console.error("No se pudo abrir el popup de DNI duplicado:", error);
  }

  window.alert("Ya existe una inscripción registrada con ese DNI.");
}

function isStaticFilePreview() {
  return window.location.protocol === "file:";
}

function applyServerFieldErrors(fields = {}) {
  Object.entries(fields).forEach(([name, message]) =>
    setFieldError(name, message || "Revisá este campo."),
  );
  const firstError = Object.keys(fields)[0];
  if (firstError && form.elements[firstError]) form.elements[firstError].focus();
}

if (successDialogClose && successDialog) {
  successDialogClose.addEventListener("click", () => successDialog.close());
}

if (duplicateDialogClose && duplicateDialog) {
  duplicateDialogClose.addEventListener("click", () => duplicateDialog.close());
}

dniInput.addEventListener("input", () => {
  const normalized = normalizeDni(dniInput.value);
  dniInput.value = normalized;

  if (dniPreview) {
    dniPreview.textContent = normalized
      ? `DNI: ${normalized}`
      : "Ingresá 8 números, sin puntos.";
  }
});

if (phoneInput) {
  phoneInput.addEventListener("input", () => {
    phoneInput.value = phoneInput.value.replace(/[^0-9]/g, "").slice(0, 10);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearErrors();
  result.hidden = true;

  const availability = getFormAvailability();
  if (availability !== "open") {
    document.querySelector("#form-view").hidden = true;
    document.querySelector("#splash").hidden = false;
    showUnavailableMessage(availability);
    return;
  }

  const payload = collectFormData();
  const errors = validateForm(payload);
  if (Object.keys(errors).length > 0) {
    applyServerFieldErrors(errors);
    showResult("invalid", "Revisá los campos marcados antes de enviar.");
    return;
  }

  if (isStaticFilePreview()) {
    showResult(
      "local",
      "Esta vista local sirve para revisar la interfaz. Para enviar la inscripción, abrí el proyecto con `vercel dev` o usá la versión desplegada.",
    );
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Enviando...";

  let response;
  let body = {};

  try {
    response = await fetch(SUBMIT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    body = await response.json().catch(() => ({}));
  } catch (error) {
    console.error("Error de conexión al enviar el formulario:", error);
    showResult(
      "network",
      "No pudimos conectar con el servidor. Revisá la conexión e intentá nuevamente.",
    );
    submitButton.disabled = false;
    submitButton.textContent = "Enviar inscripción";
    return;
  }

  try {
    if (
      response.ok &&
      (body.status === "accepted" ||
        body.status === "ok" ||
        body.status === "created")
    ) {
      form.reset();

      if (dniPreview) {
        dniPreview.textContent = "Ingresá 8 números, sin puntos.";
      }

      result.hidden = true;
      showSuccessPopup();
      return;
    }
    if (response.status === 409 || body.status === "duplicate") {
      result.hidden = true;
      showDuplicatePopup();
      return;
    }

    if (response.status === 400 || body.status === "invalid") {
      applyServerFieldErrors(body.fields || {});
      showResult("invalid", "Revisá los campos marcados antes de enviar.");
      return;
    }

    if (
      response.status === 410 ||
      body.status === "expired" ||
      body.status === "not_started"
    ) {
      document.querySelector("#form-view").hidden = true;
      document.querySelector("#splash").hidden = false;
      showUnavailableMessage(body.status);
      return;
    }

    if (response.status === 429 || body.status === "rate_limited") {
      showResult(
        "rate_limited",
        "Esperá unos minutos antes de volver a intentar.",
      );
      return;
    }

    showResult(
      "failed",
      body.message ||
        "No pudimos completar la inscripción. Intentá nuevamente más tarde.",
    );
  } catch (error) {
    console.error("El servidor respondió, pero falló la interfaz:", error);

    showResult(
      "success",
      "La inscripción fue recibida correctamente. Podés cerrar esta ventana.",
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Enviar inscripción";
  }
});
