import React from "react";
import type { PdfReportData } from "./PdfReportData";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n));

export function PdfPage2({ data }: { data: PdfReportData }) {
  const totalFinActivos = data.activeAssets.reduce(
    (sum, a) => sum + data.convertToMXN(a.current_balance ?? 0, a.currency),
    0
  );
  const activeNfa = data.nfAssets.filter((a) => a.is_active);
  const totalNFA = activeNfa.reduce(
    (sum, a) => sum + data.convertToMXN(a.current_value, a.currency),
    0
  );
  const totalPasivos = data.activeLiabs.reduce(
    (sum, a) => sum + data.convertToMXN(Math.abs(a.current_balance ?? 0), a.currency),
    0
  );
  const totalActivos = totalFinActivos + totalNFA;
  const patrimonioNeto = totalActivos - totalPasivos;
  const netoPositive = patrimonioNeto >= 0;

  const dotLine: React.CSSProperties = {
    flex: 1,
    borderBottom: "1px dashed #d0d0d0",
    margin: "0 6px",
    marginBottom: 3,
  };

  const renderAccountRow = (name: string, bal: number, currency: string, color: string) => (
    <div
      key={name + bal}
      style={{ display: "flex", alignItems: "baseline", marginBottom: 4, fontSize: 11 }}
    >
      <span style={{ color: "#1a1a1a", whiteSpace: "nowrap" }}>{name}</span>
      <span style={dotLine} />
      <span style={{ fontWeight: 600, color, whiteSpace: "nowrap" }}>
        {fmt(bal)}
        {currency !== "MXN" && (
          <span style={{ fontSize: 9, color: "#8a8a8a", marginLeft: 3 }}>{currency}</span>
        )}
      </span>
    </div>
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
        FOTOGRAFÍA PATRIMONIAL — {data.periodTitle}
      </div>

      {/* SECCIÓN B: Dos columnas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, padding: "24px 32px" }}>
        {/* Columna izquierda — Lo que tengo */}
        <div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "#3a5a40",
              letterSpacing: "0.08em",
              marginBottom: 12,
            }}
          >
            LO QUE TENGO
          </div>

          <div style={{ fontSize: 8, color: "#8a8a8a", marginBottom: 6 }}>Cuentas financieras</div>
          {data.activeAssets.map((a) =>
            renderAccountRow(a.name, a.current_balance ?? 0, a.currency, "#227746")
          )}

          <div style={{ height: 1, background: "#ebebeb", margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
            <span style={{ fontWeight: 700, color: "#3a5a40" }}>Total cuentas</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#227746" }}>
              {fmt(totalFinActivos)}
            </span>
          </div>

          {activeNfa.length > 0 && (
            <>
              <div style={{ fontSize: 8, color: "#8a8a8a", marginBottom: 6, marginTop: 12 }}>
                Activos no financieros
              </div>
              {activeNfa.map((a) =>
                renderAccountRow(a.name, a.current_value, a.currency, "#3a5a40")
              )}
              <div style={{ height: 1, background: "#ebebeb", margin: "8px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                <span style={{ fontWeight: 700, color: "#3a5a40" }}>Total no financiero</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#3a5a40" }}>
                  {fmt(totalNFA)}
                </span>
              </div>
            </>
          )}

          {/* Doble línea + total activos */}
          <div style={{ margin: "8px 0" }}>
            <div style={{ height: 1, background: "#3a5a40" }} />
            <div style={{ height: 2 }} />
            <div style={{ height: 1, background: "#3a5a40" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#3a5a40" }}>TOTAL ACTIVOS</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#3a5a40" }}>
              {fmt(totalActivos)}
            </span>
          </div>
        </div>

        {/* Columna derecha — Lo que debo */}
        <div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "#af3030",
              letterSpacing: "0.08em",
              marginBottom: 12,
            }}
          >
            LO QUE DEBO
          </div>

          {data.activeLiabs.map((a) =>
            renderAccountRow(a.name, Math.abs(a.current_balance ?? 0), a.currency, "#af3030")
          )}

          <div style={{ height: 1, background: "#ebebeb", margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#af3030" }}>TOTAL PASIVOS</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#af3030" }}>
              {fmt(totalPasivos)}
            </span>
          </div>
        </div>
      </div>

      {/* SECCIÓN C: Patrimonio neto */}
      <div
        style={{
          padding: "16px 32px",
          background: netoPositive ? "#e6f5eb" : "#faeaea",
          borderTop: `2px solid ${netoPositive ? "#3a5a40" : "#af3030"}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: netoPositive ? "#3a5a40" : "#af3030",
              letterSpacing: "0.05em",
            }}
          >
            PATRIMONIO NETO
          </div>
          <div style={{ fontSize: 9, color: "#8a8a8a", marginTop: 2 }}>
            (Activos totales − Pasivos)
          </div>
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: netoPositive ? "#3a5a40" : "#af3030",
          }}
        >
          {fmt(patrimonioNeto)}
        </div>
      </div>

      {/* SECCIÓN D: Metas de construcción */}
      {data.activeGoals.length > 0 && (
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
            TUS METAS DE CONSTRUCCIÓN
          </div>
          <div style={{ height: 1, background: "#e8e8e8", marginBottom: 14 }} />

          {data.activeGoals.slice(0, 4).map((g, idx) => {
            const pct =
              g.target_amount > 0
                ? Math.min(g.current_amount / g.target_amount, 1)
                : 0;
            const rem = g.target_amount - g.current_amount;
            const months =
              g.monthly_contribution && g.monthly_contribution > 0 && rem > 0
                ? Math.ceil(rem / g.monthly_contribution)
                : 0;

            return (
              <div
                key={g.id}
                style={{
                  marginBottom: 16,
                  paddingBottom: 16,
                  borderBottom:
                    idx < data.activeGoals.slice(0, 4).length - 1
                      ? "1px solid #f0f0f0"
                      : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>
                    {g.name}
                  </span>
                  <span style={{ fontSize: 11, color: "#8a8a8a" }}>
                    {fmt(g.current_amount)} / {fmt(g.target_amount)}
                  </span>
                </div>

                <div
                  style={{
                    height: 8,
                    background: "#ebebeb",
                    borderRadius: 4,
                    margin: "8px 0",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: `${pct * 100}%`,
                      background: "#d7c38c",
                      borderRadius: 4,
                      height: 8,
                      position: "absolute",
                      top: 0,
                      left: 0,
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#af9450" }}>
                    {(pct * 100).toFixed(0)}%
                  </span>
                  {months > 0 && (
                    <span style={{ fontSize: 10, color: "#8a8a8a", fontStyle: "italic" }}>
                      {months} meses estimados
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
