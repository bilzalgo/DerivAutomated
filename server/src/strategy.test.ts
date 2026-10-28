import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateMacdCross, MacdEntryGate, MACD_DEFAULTS } from "./strategy";

function trend(start: number, step: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => start + step * index);
}

function firstCross(prices: number[], direction: "rise" | "fall"): number {
  for (let length = 35; length <= prices.length; length += 1) {
    if (evaluateMacdCross(prices.slice(0, length)) === direction) return length;
  }
  return -1;
}

test("uses the agreed MACD defaults", () => {
  assert.deepEqual(MACD_DEFAULTS, { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
});

test("emits Rise only on a fresh bullish MACD crossover", () => {
  const prices = [...trend(200, -1, 90), ...trend(111, 2, 60)];
  const crossLength = firstCross(prices, "rise");
  assert.notEqual(crossLength, -1);
  assert.equal(evaluateMacdCross(prices.slice(0, crossLength + 1)), null);
});

test("emits Fall only on a fresh bearish MACD crossover", () => {
  const prices = [...trend(100, 1, 90), ...trend(189, -2, 60)];
  const crossLength = firstCross(prices, "fall");
  assert.notEqual(crossLength, -1);
  assert.equal(evaluateMacdCross(prices.slice(0, crossLength + 1)), null);
});

test("requires enough finite prices and waits while a contract is unsettled", () => {
  const bullishPrices = [...trend(200, -1, 90), ...trend(111, 2, 60)];
  assert.equal(evaluateMacdCross(bullishPrices.slice(0, 34)), null);
  assert.equal(evaluateMacdCross([1, 2, Number.NaN]), null);

  const crossLength = firstCross(bullishPrices, "rise");
  const crossover = bullishPrices.slice(0, crossLength);
  const gate = new MacdEntryGate(crossLength - 1);
  assert.equal(gate.evaluate(crossover, true), null);
  assert.equal(gate.evaluate(crossover, false), null);
  assert.equal(gate.evaluate([...crossover, bullishPrices[crossLength]], false), null);
});

test("emits each crossover at most once", () => {
  const prices = [...trend(200, -1, 90), ...trend(111, 2, 60)];
  const crossLength = firstCross(prices, "rise");
  const crossover = prices.slice(0, crossLength);
  const gate = new MacdEntryGate(crossLength - 1);

  assert.equal(gate.evaluate(crossover, false), "rise");
  assert.equal(gate.evaluate(crossover, false), null);
  assert.equal(gate.evaluate(crossover, true), null);
});