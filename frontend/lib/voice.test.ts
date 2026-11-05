import { test } from "node:test";
import assert from "node:assert/strict";
import { fold, isApproval, parseVoiceCommand } from "./voice.ts";

const AGENTS = [
  { key: "orchestrator", label: "CEO" },
  { key: "marketing", label: "Marketing" },
  { key: "frontend", label: "Frontend" },
  { key: "backend", label: "Backend" },
  { key: "mobile", label: "Mobile" },
  { key: "images", label: "Creativo" },
  { key: "planning", label: "Plan" },
  { key: "legal", label: "Legal" },
];

test("fold removes accents and lowers case keeping the length", () => {
  assert.equal(fold("Envíalo ÁÉÍÓÚ ñ"), "envialo aeiou n");
});

test("addressing an agent by name", () => {
  assert.deepEqual(parseVoiceCommand("backend crea la API de pagos", AGENTS), { target: "backend", text: "crea la API de pagos", send: false });
  assert.deepEqual(parseVoiceCommand("Marketing: prepara tres reels", AGENTS), { target: "marketing", text: "prepara tres reels", send: false });
});

test("filler words before the name are skipped", () => {
  assert.equal(parseVoiceCommand("dile al backend que cree la tabla de usuarios", AGENTS).target, "backend");
  assert.equal(parseVoiceCommand("dile al backend que cree la tabla de usuarios", AGENTS).text, "cree la tabla de usuarios");
  assert.equal(parseVoiceCommand("para el equipo de marketing haz un plan", AGENTS).target, "marketing");
  assert.equal(parseVoiceCommand("pídele a Creativo un logo", AGENTS).target, "images");
});

test("aliases, accents and custom agents", () => {
  assert.equal(parseVoiceCommand("back end haz algo", AGENTS).target, "backend");
  assert.equal(parseVoiceCommand("móvil arregla el login", AGENTS).target, "mobile");
  assert.equal(parseVoiceCommand("planeación arma el roadmap", AGENTS).target, "planning");
  assert.equal(parseVoiceCommand("legal revisa los términos", AGENTS).target, "legal");
});

test("no agent named: text is untouched and the target stays null", () => {
  assert.deepEqual(parseVoiceCommand("crea una tienda en línea", AGENTS), { target: null, text: "crea una tienda en línea", send: false });
});

test("a name inside the sentence is not an address", () => {
  assert.equal(parseVoiceCommand("quiero una landing para el equipo de marketing", AGENTS).target, null);
  assert.equal(parseVoiceCommand("planifica el servidor nuevo", AGENTS).target, null);
});

test("a name that is only the start of a longer word is not a match", () => {
  assert.equal(parseVoiceCommand("planteamos una idea", AGENTS).target, null);
  assert.equal(parseVoiceCommand("legalizar el contrato", AGENTS).target, null);
});

test("ending with enviar sends it and is removed from the text", () => {
  assert.deepEqual(parseVoiceCommand("frontend haz el login, envíalo", AGENTS), { target: "frontend", text: "haz el login", send: true });
  assert.deepEqual(parseVoiceCommand("crea la web enviar.", AGENTS), { target: null, text: "crea la web", send: true });
  assert.equal(parseVoiceCommand("enviar", AGENTS).send, false); // nothing to send
});

test("approval phrases", () => {
  for (const ok of ["aprobado", "Aprobado.", "sí, aprobado", "ok adelante", "dale", "apruebo el plan", "empieza"]) assert.equal(isApproval(ok), true, ok);
  for (const no of ["no aprobado", "todavía no", "quiero cambiar el plan", "cancela"]) assert.equal(isApproval(no), false, no);
});
