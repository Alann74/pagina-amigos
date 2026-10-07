import assert from "node:assert/strict";
import { test } from "node:test";
import { csvToRows, parseMoneyLoose, parsePriceTable } from "../../src/lib/wholesale-import";

test("importes en distintos formatos", () => {
  assert.equal(parseMoneyLoose("$33,000"), 33000);
  assert.equal(parseMoneyLoose("$ 33.000"), 33000);
  assert.equal(parseMoneyLoose("33.000,50"), 33001);
  assert.equal(parseMoneyLoose("4400"), 4400);
  assert.equal(parseMoneyLoose(15400), 15400);
  assert.equal(parseMoneyLoose("ARTICULO"), null);
  assert.equal(parseMoneyLoose(""), null);
});

test("planilla con título y columnas ARTICULO · NOMBRE · precio sin encabezado", () => {
  const rows = [
    ["", "PRECIOS POR MAYOR 2027 INEDITA", ""],
    ["ARTICULO", "NOMBRE", ""],
    ["37436", "PANTALON CITRUS", "$33,000"],
    [39187, "Gorra Barry", "$4,400"],
    ["", "", ""],
  ];
  assert.deepEqual(parsePriceTable(rows), [
    { code: "37436", name: "PANTALON CITRUS", price: 33000 },
    { code: "39187", name: "Gorra Barry", price: 4400 },
  ]);
});

test("CSV con punto y coma y sin encabezado", () => {
  const rows = csvToRows("39601;Remera Niro;25.300\n39602;Remera Morgan;22.000\n");
  assert.deepEqual(parsePriceTable(rows), [
    { code: "39601", name: "Remera Niro", price: 25300 },
    { code: "39602", name: "Remera Morgan", price: 22000 },
  ]);
});

test("lista de productos nuevos con encabezados y deducción de categoría y talles", async () => {
  const { parseProductTable, prettyProductName } = await import("../../src/lib/product-import");
  const rows = parseProductTable([
    ["ARTICULO", "NOMBRE", "PRECIO MINORISTA", "COLORES"],
    ["40001", "REMERA LUNA", "$29.900", "NEGRO|BLANCO"],
    ["40002", "Wide Leg Sol", "89000", ""],
    ["", "sin código", "1000", ""],
  ]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { code: "40001", name: "REMERA LUNA", price: 29900, category: "Remeras", colors: ["NEGRO", "BLANCO"], sizes: ["S", "M", "L", "XL"] });
  assert.equal(rows[1].category, "Jeans");
  assert.deepEqual(rows[1].sizes, ["24", "26", "28", "30", "32", "34", "36"]);
  assert.equal(prettyProductName("PANTALON CITRUS"), "Pantalón Citrus");
});
