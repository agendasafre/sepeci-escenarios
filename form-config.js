(function exposeFormConfig(globalScope) {
  const formConfig = {
    startsAt: "2026-10-20T00:00:00-03:00",
    expiresAt: "2026-11-04T23:59:59.999-03:00",
    notStartedMessage:
      "El período de inscripción todavía no comenzó.",
    expiredMessage:
      "El período de inscripción finalizó.",
  };

  if (globalScope) {
    globalScope.FORM_CONFIG = formConfig;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { FORM_CONFIG: formConfig };
  }
})(typeof window !== "undefined" ? window : globalThis);
