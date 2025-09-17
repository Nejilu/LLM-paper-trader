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
import type { EquityPoint } from "@/hooks/api";

ChartJS.register(CategoryScale, LinearScale, TimeScale, PointElement, LineElement, Tooltip, Legend);

interface EquityChartProps {
  data: EquityPoint[];
}

export function EquityChart({ data }: EquityChartProps) {
  const chartData = useMemo(
    () => ({
      labels: data.map((point) => point.date),
      datasets: [
        {
          label: "Equity",
          data: data.map((point) => point.value),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.2)",
          tension: 0.3
        }
      ]
    }),
    [data]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" as const },
      stacked: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: { parsed: number }) =>
              `Equity: ${context.parsed.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
          }
        }
      },
      scales: {
        x: {
          type: "time" as const,
          time: { unit: "month" }
        },
        y: {
          ticks: {
            callback: (value: string | number) =>
              typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value
          }
        }
      }
    }),
    []
  );

  return (
    <div className="h-64 w-full">
      <Line options={options} data={chartData} />
    </div>
  );
}
