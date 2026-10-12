import assert from "node:assert/strict";
import { test } from "node:test";
import { createGuestToken, createWholesaleToken, hashCode, isSharedCode, newPersonalCode, normalizeCode, sharedCodeFingerprint, wholesaleFromCookie } from "../../src/lib/wholesale";
import { approvalMessage, approvalNotice, normalizeInstagram, signupFields, wholesaleSignupSchema } from "../../src/lib/wholesale-signup";

process.env.ADMIN_SESSION_SECRET ??= "secreto-de-prueba-para-los-tests-123";

const datos = {
  name: "  Laura Gómez ",
  business: "Lali Showroom",
  taxId: "",
  phone: "341 15 555-1234",
  email: " Laura@Ejemplo.COM ",
  city: "Funes, Santa Fe",
  instagram: "https://www.instagram.com/lali.showroom/?hl=es",
  salesChannel: "online",
  comment: "",
};

test("registro: limpia los datos (mail en minúscula, instagram como usuario, vacíos a null)", () => {
  const r = wholesaleSignupSchema.parse(datos);
  assert.equal(r.name, "Laura Gómez");
  assert.equal(r.email, "laura@ejemplo.com");
  assert.equal(r.instagram, "lali.showroom");
  assert.equal(r.taxId, null);
  assert.equal(r.comment, null);
  assert.equal(r.salesChannel, "online");
});

test("registro: pide nombre, WhatsApp, mail y localidad válidos", () => {
  const error = (patch: Record<string, unknown>) => {
    const r = wholesaleSignupSchema.safeParse({ ...datos, ...patch });
    return r.success ? null : { field: r.error.issues[0]?.path.join("."), message: r.error.issues[0]?.message };
  };
  assert.deepEqual(error({ name: "L" }), { field: "name", message: "Ingresá tu nombre y apellido" });
  assert.deepEqual(error({ phone: "1234" }), { field: "phone", message: "Ingresá un WhatsApp válido" });
  assert.deepEqual(error({ email: "laura@" }), { field: "email", message: "Ingresá un mail válido" });
  assert.deepEqual(error({ city: "" }), { field: "city", message: "Ingresá tu localidad" });
  assert.equal(error({ salesChannel: "cualquiera" })?.field, "salesChannel");
  assert.equal(error({ salesChannel: null, business: null, instagram: undefined }), null);
});

test("instagram: acepta @usuario, usuario o el link", () => {
  assert.equal(normalizeInstagram("@lali.showroom"), "lali.showroom");
  assert.equal(normalizeInstagram("instagram.com/lali_showroom"), "lali_showroom");
  assert.equal(normalizeInstagram("  "), null);
  assert.equal(normalizeInstagram(null), null);
});

test("código personal: 8 caracteres sin letras que se confunden; se escribe como sea", () => {
  for (let i = 0; i < 50; i++) assert.match(newPersonalCode(), /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  assert.equal(normalizeCode(" k7pm q3xd "), "K7PMQ3XD");
  assert.equal(hashCode("k7pm-q3xd"), hashCode("K7PMQ3XD"));
  assert.notEqual(hashCode("K7PMQ3XD"), hashCode("K7PMQ3XE"));
});

test("acceso: un token alterado o vencido no entra (sin tocar la base)", async () => {
  const token = createWholesaleToken(7, hashCode("K7PM-Q3XD"));
  const [exp, id, fp, sig] = token.split(".");
  assert.equal(id, "7");
  assert.equal(await wholesaleFromCookie(`${exp}.8.${fp}.${sig}`), null); // otro cliente
  assert.equal(await wholesaleFromCookie(`${exp}.${id}.${"0".repeat(16)}.${sig}`), null); // otro código
  assert.equal(await wholesaleFromCookie(`1000.${id}.${fp}.${sig}`), null); // vencido
  assert.equal(await wholesaleFromCookie("basura"), null);
  assert.equal(await wholesaleFromCookie(undefined), null);
});

test("WhatsApp de aprobación: link que entra directo y el código", () => {
  const text = approvalMessage("Laura Gómez", "K7PM-Q3XD", "https://inedita-tienda.vercel.app");
  assert.match(text, /^Hola Laura! Ya tenés acceso a la tienda de INEDITA con precios por mayor\./);
  assert.ok(text.includes("https://inedita-tienda.vercel.app/mayoristas?codigo=K7PM-Q3XD"));
  assert.ok(text.includes("Tu código personal es K7PM-Q3XD"));
  assert.ok(!text.includes("mínimo"));
  // Clienta nueva: avisa el mínimo de la primera compra
  assert.ok(approvalMessage("Laura", "K7PM-Q3XD", "https://x.test", 25).includes("Tu primera compra tiene un mínimo de 25 prendas."));
});

test("mail de aviso: todos los datos y los links para aprobar y escribirle", () => {
  const fields = signupFields(wholesaleSignupSchema.parse(datos), "https://inedita-tienda.vercel.app");
  assert.equal(fields.Nombre, "Laura Gómez");
  assert.equal(fields.Negocio, "Lali Showroom");
  assert.equal(fields.Mail, "laura@ejemplo.com");
  assert.equal(fields.Instagram, "https://instagram.com/lali.showroom");
  assert.equal(fields["Cómo vende"], "Vendo online / redes");
  assert.equal(fields["CUIT / DNI"], undefined);
  assert.equal(fields["Aprobar en el panel"], "https://inedita-tienda.vercel.app/admin/mayoristas");
  assert.match(fields["Escribirle por WhatsApp"], /^https:\/\/wa\.me\/5493415551234\?text=Hola%20Laura/);
});

test("mail al aprobar: el código, el mínimo y el botón para mandarlo por WhatsApp", () => {
  const n = approvalNotice({ name: "Laura Gómez", business: "Lali Showroom", phone: "341 555-1234", city: "Funes" }, "K7PM-Q3XD", "https://wa.me/5493415551234?text=x", 25, "https://inedita.test");
  assert.equal(n.subject, "Código mayorista de Laura Gómez (Lali Showroom): K7PM-Q3XD");
  assert.equal(n.fields["Código personal"], "K7PM-Q3XD");
  assert.equal(n.fields["Primera compra"], "Mínimo 25 prendas");
  assert.equal(n.fields["Mandarle el código por WhatsApp"], "https://wa.me/5493415551234?text=x");
  assert.equal(approvalNotice({ name: "Ana", business: null, phone: "1", city: "x" }, "A", "w", 0, "s").fields["Primera compra"], "Sin mínimo");
});

test("código general: se escribe como sea; el token cambia si se cambia el código y no se puede alterar", async () => {
  assert.equal(isSharedCode(" mayoristas inedita ", "mayoristasInedita"), true);
  assert.equal(isSharedCode("MAYORISTAS-INEDITA", "mayoristasInedita"), true);
  assert.equal(isSharedCode("otro", "mayoristasInedita"), false);
  assert.equal(isSharedCode("", ""), false);
  assert.notEqual(sharedCodeFingerprint("mayoristasInedita"), sharedCodeFingerprint("otroCodigo"));
  const [exp, id, fp, sig] = createGuestToken(0, "mayoristasInedita").split(".");
  assert.equal(id, "g0");
  assert.equal(fp, sharedCodeFingerprint("mayoristasInedita"));
  assert.equal(createGuestToken(12, "mayoristasInedita").split(".")[1], "g12");
  // Alterado (pasar de invitado a un cliente, o a otro código): no entra, sin tocar la base
  assert.equal(await wholesaleFromCookie(`${exp}.g5.${fp}.${sig}`), null);
  assert.equal(await wholesaleFromCookie(`${exp}.0.${fp}.${sig}`), null);
  assert.equal(await wholesaleFromCookie(`${exp}.${id}.${sharedCodeFingerprint("otro")}.${sig}`), null);
});
