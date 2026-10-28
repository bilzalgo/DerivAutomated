export const MACD_DEFAULTS = Object.freeze({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });

export type TradeDirection = "rise" | "fall";

function ema(values: readonly number[], period: number): Array<number | null> {
  const result: Array<number | null> = Array(values.length).fill(null);
  if (values.length < period) return result;

  const smoothing = 2 / (period + 1);
  let average = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  result[period - 1] = average;
  for (let index = period; index < values.length; index += 1) {
    average += smoothing * (values[index] - average);
    result[index] = average;
  }
  return result;
}

export function evaluateMacdCross(prices: readonly number[]): TradeDirection | null {
  if (prices.some((price) => !Number.isFinite(price))) return null;

  const { fastPeriod, slowPeriod, signalPeriod } = MACD_DEFAULTS;
  const fastEma = ema(prices, fastPeriod);
  const slowEma = ema(prices, slowPeriod);
  const macd = prices.map((_, index) => {
    const fast = fastEma[index];
    const slow = slowEma[index];
    return fast === null || slow === null ? null : fast - slow;
  });
  const signal = Array<number | null>(prices.length).fill(null);
  const macdValues: number[] = [];
  let signalAverage: number | null = null;

  for (let index = 0; index < macd.length; index += 1) {
    const macdValue = macd[index];
    if (macdValue === null) continue;
    macdValues.push(macdValue);
    if (macdValues.length < signalPeriod) continue;
    if (macdValues.length === signalPeriod) {
      signalAverage = macdValues.reduce((sum, value) => sum + value, 0) / signalPeriod;
    } else {
      signalAverage! += (2 / (signalPeriod + 1)) * (macdValue - signalAverage!);
    }
    signal[index] = signalAverage;
  }

  const currentIndex = prices.length - 1;
  const previousIndex = currentIndex - 1;
  const previousMacd = macd[previousIndex];
  const currentMacd = macd[currentIndex];
  const previousSignal = signal[previousIndex];
  const currentSignal = signal[currentIndex];
  if (previousMacd === null || currentMacd === null || previousSignal === null || currentSignal === null) return null;

  if (previousMacd <= previousSignal && currentMacd > currentSignal) return "rise";
  if (previousMacd >= previousSignal && currentMacd < currentSignal) return "fall";
  return null;
}

export class MacdEntryGate {
  private lastEvaluatedTickCount: number;

  constructor(initialTickCount = 0) {
    this.lastEvaluatedTickCount = initialTickCount;
  }

  evaluate(prices: readonly number[], hasUnsettledContract: boolean): TradeDirection | null {
    if (prices.length <= this.lastEvaluatedTickCount) return null;
    this.lastEvaluatedTickCount = prices.length;
    if (hasUnsettledContract) return null;
    return evaluateMacdCross(prices);
  }
}