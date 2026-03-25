import React from "react";
import type { PdfReportData } from "./PdfReportData";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n));

const BLOCK_COLORS: Record<string, { main: string; light: string }> = {
  Estabilidad: { main: "#3a5a40", light: "#8caf92" },
  "Calidad de Vida": { main: "#4b58c8", light: "#9da8e1" },
  Construcción: { main: "#af9450", light: "#d7c38c" },
};

export function PdfPage1({ data }: { data: PdfReportData }) {
  const balance = data.totals.income - data.totals.expense;
  const balancePositive = balance >= 0;
  const balancePct =
    data.totals.income > 0
      ? ((balance / data.totals.income) * 100).toFixed(1)
      : "0.0";

  const maxCatPct = data.topCategories.length > 0 ? data.topCategories[0].pct : 1;

  return (
    <div style={{ width: 794, minHeight: 1123, background: "#ffffff", fontFamily: "inherit" }}>
      {/* SECCIÓN A: Portada */}
      <div
        style={{
          background: "#1c2c20",
          color: "#ffffff",
          padding: "40px 32px 32px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "#d2e4d4", letterSpacing: "0.05em", marginBottom: 10 }}>
          Finanzas con Sentido™
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, color: "#ffffff", marginBottom: 8, lineHeight: 1.1 }}>
          {data.periodTitle}
        </div>
        <div style={{ fontSize: 12, color: "#a5c2a8", fontStyle: "italic", marginBottom: 6 }}>
          Tu fotografía financiera
        </div>
        <div style={{ fontSize: 11, color: "#d2e4d4" }}>{data.periodLabel}</div>
        <div style={{ fontSize: 10, color: "#7a9e7e", marginTop: 8 }}>{data.generatedAt}</div>
      </div>

      {/* SECCIÓN B: KPIs */}
      <div style={{ display: "flex", gap: 16, padding: "28px 32px 20px" }}>
        {/* Ingresos */}
        <div
          style={{
            flex: 1,
            background: "#e6f5eb",
            borderRadius: 12,
            padding: "16px 20px",
            borderLeft: "4px solid #227746",
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 700, color: "#227746", letterSpacing: "0.08em", marginBottom: 8 }}>
            INGRESOS ▲
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a" }}>{fmt(data.totals.income)}</div>
        </div>
        {/* Gastos */}
        <div
          style={{
            flex: 1,
            background: "#faeaea",
            borderRadius: 12,
            padding: "16px 20px",
            borderLeft: "4px solid #af3030",
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 700, color: "#af3030", letterSpacing: "0.08em", marginBottom: 8 }}>
            GASTOS ▼
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a" }}>{fmt(data.totals.expense)}</div>
        </div>
        {/* Balance */}
        <div
          style={{
            flex: 1,
            background: balancePositive ? "#eaeeff" : "#faeaea",
            borderRadius: 12,
            padding: "16px 20px",
            borderLeft: `4px solid ${balancePositive ? "#4b58c8" : "#af3030"}`,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: balancePositive ? "#4b58c8" : "#af3030",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            BALANCE NETO
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a" }}>{fmt(balance)}</div>
          <div
            style={{
              fontSize: 10,
              color: balancePositive ? "#4b58c8" : "#af3030",
              marginTop: 4,
            }}
          >
            {balancePct}% del ingreso
          </div>
        </div>
      </div>

      {/* SECCIÓN C: Distribución del gasto */}
      <div style={{ padding: "0 32px 24px" }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "#5a5a5a",
            letterSpacing: "0.1em",
            marginBottom: 14,
          }}
        >
          CÓMO SE DISTRIBUYÓ EL GASTO
        </div>
        <div style={{ height: 1, background: "#e8e8e8", marginBottom: 16 }} />

        {data.blockSummaries.map((b) => {
          const colors = BLOCK_COLORS[b.label] || { main: "#5a5a5a", light: "#c0c0c0" };
          return (
            <div key={b.label} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: colors.main }}>{b.label}</span>
                <span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: colors.main }}>
                    {b.percent.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: 12, color: "#3a3a3a", marginLeft: 8 }}>{fmt(b.amount)}</span>
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  background: "#ebebeb",
                  borderRadius: 4,
                  width: "100%",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    height: 8,
                    borderRadius: 4,
                    width: `${Math.min(b.percent, 100)}%`,
                    background: colors.light,
                    top: 0,
                    left: 0,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* SECCIÓN D: Top 5 categorías */}
      <div style={{ padding: "0 32px 32px" }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "#5a5a5a",
            letterSpacing: "0.1em",
            marginBottom: 14,
          }}
        >
          EN QUÉ GASTASTE MÁS
        </div>
        <div style={{ height: 1, background: "#e8e8e8", marginBottom: 16 }} />

        {data.topCategories.slice(0, 5).map((c, i) => {
          const normalizedWidth = maxCatPct > 0 ? (c.pct / maxCatPct) * 100 : 0;
          return (
            <div
              key={c.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  minWidth: 22,
                  fontSize: 11,
                  fontWeight: 800,
                  color: i === 0 ? "#af9450" : "#8a8a8a",
                }}
              >
                #{i + 1}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#1a1a1a",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {c.name}
              </span>
              <div
                style={{
                  flex: 2,
                  position: "relative",
                  height: 6,
                  background: "#ebebeb",
                  borderRadius: 3,
                }}
              >
                <div
                  style={{
                    width: `${normalizedWidth}%`,
                    background: "#d7c38c",
                    borderRadius: 3,
                    height: 6,
                    position: "absolute",
                    top: 0,
                    left: 0,
                  }}
                />
              </div>
              <span
                style={{
                  minWidth: 38,
                  textAlign: "right",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#5a5a5a",
                }}
              >
                {c.pct.toFixed(1)}%
              </span>
              <span
                style={{
                  minWidth: 80,
                  textAlign: "right",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#1a1a1a",
                }}
              >
                {fmt(c.amount)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
