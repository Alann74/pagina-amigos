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
