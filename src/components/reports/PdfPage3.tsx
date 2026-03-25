import React from "react";
import type { PdfReportData } from "./PdfReportData";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n));

export function PdfPage3({ data }: { data: PdfReportData }) {
  const incomeTxs = data.transactions
    .filter((t) => t.type === "income")
    .sort((a, b) => (b.amount_in_base ?? b.amount) - (a.amount_in_base ?? a.amount));

  const expenseTxs = data.transactions
    .filter((t) => t.type === "expense")
    .sort((a, b) => (b.amount_in_base ?? b.amount) - (a.amount_in_base ?? a.amount))
    .slice(0, 20);

  const leftExp = expenseTxs.slice(0, 10);
  const rightExp = expenseTxs.slice(10, 20);

  const thStyle: React.CSSProperties = {
    padding: "8px 10px",
    fontSize: 10,
    fontWeight: 600,
    textAlign: "left",
  };

  const tdStyle: React.CSSProperties = {
    padding: "7px 10px",
    fontSize: 10,
  };

  const renderExpenseTable = (rows: typeof leftExp, startIdx: number) => (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "#962626", color: "#ffffff" }}>
          <th style={{ ...thStyle, width: 30 }}>#</th>
          <th style={thStyle}>Descripción</th>
          <th style={{ ...thStyle, textAlign: "right", width: 90 }}>Monto</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((tx, i) => (
          <tr
            key={tx.id}
            style={{ background: i % 2 === 0 ? "#fdf0f0" : "#ffffff" }}
          >
            <td style={{ ...tdStyle, fontWeight: 700, color: "#af3030" }}>
              {startIdx + i + 1}
            </td>
            <td style={tdStyle}>
              {tx.description || data.categoryMap[tx.category_id ?? ""] || "—"}
            </td>
            <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#af3030" }}>
              {fmt(tx.amount_in_base ?? tx.amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div style={{ width: 794, minHeight: 1123, background: "#ffffff", fontFamily: "inherit" }}>
      {/* SECCIÓN A: Encabezado */}
      <div
        style={{
          background: "#1c2c20",
          padding: "16px 32px",
          color: "#d2e4d4",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
        }}
      >
        MOVIMIENTOS DEL PERIODO — {data.periodTitle}
      </div>

      {/* SECCIÓN B: Ingresos */}
      <div style={{ padding: "20px 32px 0" }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "#5a5a5a",
            letterSpacing: "0.1em",
            marginBottom: 14,
          }}
        >
          INGRESOS DEL PERIODO
        </div>
        <div style={{ height: 1, background: "#e8e8e8", marginBottom: 12 }} />

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#3a5a40", color: "#ffffff" }}>
              <th style={{ ...thStyle, width: 80 }}>Fecha</th>
              <th style={thStyle}>Descripción</th>
              <th style={{ ...thStyle, width: 120 }}>Cuenta</th>
              <th style={{ ...thStyle, textAlign: "right", width: 100 }}>Monto</th>
            </tr>
          </thead>
          <tbody>
            {incomeTxs.length > 0 ? (
              incomeTxs.map((tx, i) => (
                <tr
                  key={tx.id}
                  style={{ background: i % 2 === 0 ? "#f0f7f2" : "#ffffff" }}
                >
                  <td style={tdStyle}>{tx.transaction_date}</td>
                  <td style={tdStyle}>
                    {tx.description || data.categoryMap[tx.category_id ?? ""] || "—"}
                  </td>
                  <td style={tdStyle}>{data.accountMap[tx.account_id] || ""}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#227746" }}>
                    {fmt(tx.amount_in_base ?? tx.amount)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={4}
                  style={{ ...tdStyle, textAlign: "center", color: "#8a8a8a" }}
                >
                  Sin ingresos en este periodo
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SECCIÓN C: Top gastos */}
      <div style={{ padding: "20px 32px" }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "#5a5a5a",
            letterSpacing: "0.1em",
            marginBottom: 14,
          }}
        >
          TOP GASTOS DEL PERIODO
        </div>
        <div style={{ height: 1, background: "#e8e8e8", marginBottom: 12 }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>{leftExp.length > 0 && renderExpenseTable(leftExp, 0)}</div>
          <div>{rightExp.length > 0 && renderExpenseTable(rightExp, 10)}</div>
        </div>
      </div>
    </div>
  );
}
