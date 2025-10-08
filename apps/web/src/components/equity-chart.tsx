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
import type { ChartOptions, TooltipItem } from "chart.js";

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

  const options = useMemo<ChartOptions<"line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" as const },
      stacked: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: TooltipItem<"line">) => {
              const parsedValue =
                typeof context.parsed === "number"
                  ? context.parsed
                  : typeof context.parsed === "object" && context.parsed !== null && "y" in context.parsed
                    ? Number((context.parsed as { y: number }).y)
                    : null;

              return parsedValue !== null
                ? `Equity: ${parsedValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                : "Equity";
            }
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
