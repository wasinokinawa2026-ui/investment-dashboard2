export type StockPoint = {
  time: string;
  value: number;
};

function generateMockData(
  startDate: string,
  days: number,
  startPrice: number,
  volatility: number
): StockPoint[] {
  const data: StockPoint[] = [];
  const currentDate = new Date(startDate);
  let price = startPrice;

  for (let i = 0; i < days; i++) {
    const day = currentDate.getDay();

    // 토/일 제외
    if (day !== 0 && day !== 6) {
      const change = (Math.random() - 0.5) * volatility;
      price = Math.max(50, price + change);

      data.push({
        time: currentDate.toISOString().split("T")[0],
        value: Number(price.toFixed(2)),
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return data;
}

export const nvdaData: StockPoint[] = generateMockData(
  "2023-04-24",
  1100,
  280,
  12
);

export const avgoData: StockPoint[] = generateMockData(
  "2023-04-24",
  1100,
  620,
  10
);