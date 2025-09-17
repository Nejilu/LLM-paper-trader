"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  TimeScale,
  Tooltip
} from "chart.js";
import "chartjs-adapter-date-fns";
import { Line } from "react-chartjs-2";
import { useMemo } from "react";
import type { HistoryCandle } from "@/hooks/api";

ChartJS.register(CategoryScale, LinearScale, TimeScale, PointElement, LineElement, Tooltip, Legend);

interface PriceChartProps {
  candles: HistoryCandle[];
}

export function PriceChart({ candles }: PriceChartProps) {
  const chartData = useMemo(
    () => ({
      labels: candles.map((candle) => candle.date),
      datasets: [
        {
          label: "Close",
          data: candles.map((candle) => candle.close ?? null),
          borderColor: "#1e40af",
          backgroundColor: "rgba(30, 64, 175, 0.15)",
          spanGaps: true,
          tension: 0.25
        }
      ]
    }),
    [candles]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" as const },
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          type: "time" as const,
          time: { unit: "month" }
        }
      }
    }),
    []
  );

  return (
    <div className="h-64 w-full">
      <Line data={chartData} options={options} />
    </div>
  );
}
