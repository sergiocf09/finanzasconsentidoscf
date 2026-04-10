import React from "react";
import type { PdfReportData } from "./PdfReportData";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(Math.round(n));

const BLOCK_COLORS: Record<string, { main: string; light: string }> = {
  "Estabilidad":     { main: "#3a5a40", light: "#8caf92" },
  "Calidad de Vida": { main: "#4b58c8", light: "#9da8e1" },
  "Construcción":    { main: "#af9450", light: "#d7c38c" },
};

function semaforo(nivel: "verde" | "amarillo" | "rojo"): {
  bg: string; border: string; circleBg: string;
  textColor: string; subColor: string; symbol: string;
} {
  if (nivel === "verde") return {
    bg: "#f0f7f2", border: "#227746", circleBg: "#227746",
    textColor: "#1a5c30", subColor: "#3a7a4a", symbol: "✓",
  };
  if (nivel === "amarillo") return {
    bg: "#fef9ec", border: "#c28a00", circleBg: "#e0a800",
    textColor: "#7a5500", subColor: "#9a7000", symbol: "!",
  };
  return {
    bg: "#faeaea", border: "#af3030", circleBg: "#af3030",
    textColor: "#7a1a1a", subColor: "#9a3030", symbol: "↑",
  };
}

function DonutChart({ pcts }: { pcts: number[] }) {
  const R = 50;
  const C = 2 * Math.PI * R;
  const colors = ["#8caf92", "#9da8e1", "#d7c38c"];
  let offset = 0;
  const arcs = pcts.map((pct, i) => {
    const dash = (pct / 100) * C;
    const gap = C - dash;
    const arc = (
      <circle
        key={i}
        cx="70" cy="70" r={R}
        fill="none"
        stroke={colors[i]}
        strokeWidth="22"
        strokeDasharray={`${dash.toFixed(2)} ${gap.toFixed(2)}`}
        strokeDashoffset={-offset}
        transform="rotate(-90 70 70)"
      />
    );
    offset += dash;
    return arc;
  });

  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      {arcs}
      <text x="70" y="66" textAnchor="middle"
        fontSize="11" fontWeight="600" fill="#1a1a1a">
        Gasto
      </text>
      <text x="70" y="80" textAnchor="middle"
        fontSize="11" fontWeight="600" fill="#1a1a1a">
        total
      </text>
    </svg>
  );
}

export function PdfPage1({ data }: { data: PdfReportData }) {
  const balance = data.totals.income - data.totals.expense;
  const balancePositive = balance >= 0;
  const balancePct = data.totals.income > 0
    ? ((balance / data.totals.income) * 100).toFixed(1)
    : "0.0";

  const maxCatPct = data.topCategories.length > 0
    ? data.topCategories[0].pct : 1;

  const donutPcts = data.blockSummaries.map(b => b.percent);

  const totalMovimientos = data.transactions.length;
  const mayorGasto = data.topCategories[0] ?? null;
  const mayorGastoPctIngreso = data.totals.income > 0 && mayorGasto
    ? (mayorGasto.amount / data.totals.income) * 100 : 0;

  // ── Indicadores del semáforo ──
  const tasaAhorro = parseFloat(balancePct);
  const nivelAhorro = tasaAhorro >= 20 ? "verde"
    : tasaAhorro >= 10 ? "amarillo" : "rojo";
  const fraseAhorro = tasaAhorro >= 20
    ? "Guardaste más de lo que la regla del 20% recomienda. Ese excedente es libertad futura."
    : tasaAhorro >= 10
    ? "Vas por buen camino, aunque hay margen para ahorrar un poco más cada mes."
    : "Este mes el margen fue ajustado. Vale la pena identificar qué gastos se pueden reducir.";

  const calVida = data.blockSummaries.find(b => b.label === "Calidad de Vida");
  const pctCalVida = calVida?.percent ?? 0;
  const nivelCalVida = pctCalVida <= 30 ? "verde"
    : pctCalVida <= 40 ? "amarillo" : "rojo";
  const fraseCalVida = pctCalVida <= 30
    ? "Excelente equilibrio. Disfrutas sin comprometer tu estabilidad ni construcción."
    : pctCalVida <= 40
    ? "Dentro del rango, pero cerca del límite. Revisa qué parte de esto es placer real vs hábito."
    : "Este bloque está presionando el resto. Pequeños ajustes aquí liberan mucho margen.";

  const construccion = data.blockSummaries.find(b => b.label === "Construcción");
  const pctConstruccion = construccion?.percent ?? 0;
  const nivelConstruccion = pctConstruccion >= 20 ? "verde"
    : pctConstruccion >= 10 ? "amarillo" : "rojo";
  const fraseConstruccion = pctConstruccion >= 20
    ? "Estás construyendo activos reales. Cada peso aquí trabaja para tu versión futura."
    : pctConstruccion >= 10
    ? "Estás aportando a tu patrimonio. Aumentar este bloque tiene un impacto exponencial."
    : "Este mes la construcción fue mínima. Es el bloque que más retorno da a largo plazo.";

  const nivelConcentracion = mayorGastoPctIngreso <= 20 ? "verde"
    : mayorGastoPctIngreso <= 30 ? "amarillo" : "rojo";
  const fraseConcentracion = mayorGastoPctIngreso <= 20
    ? "El gasto está bien distribuido. Sin una categoría que domine desproporcionadamente."
    : mayorGastoPctIngreso <= 30
    ? `Una sola categoría concentró ${mayorGastoPctIngreso.toFixed(0)}% del ingreso. Puede ser normal si fue planeado.`
    : `Una sola categoría concentró ${mayorGastoPctIngreso.toFixed(0)}% del ingreso. Vale la pena revisar si fue algo extraordinario.`;

  const indicadores = [
    { label: "Tasa de ahorro", valor: `${balancePct}%`, nivel: nivelAhorro, frase: fraseAhorro },
    { label: "Calidad de vida", valor: `${pctCalVida.toFixed(1)}%`, nivel: nivelCalVida, frase: fraseCalVida },
    { label: "Construcción patrimonial", valor: `${pctConstruccion.toFixed(1)}%`, nivel: nivelConstruccion, frase: fraseConstruccion },
    { label: "Gasto concentrado en", valor: mayorGasto ? fmt(mayorGasto.amount) : "—", nivel: nivelConcentracion, frase: fraseConcentracion },
  ] as const;

  return (
    <div style={{
      width: 794, minHeight: 1123, background: "#ffffff",
      fontFamily: "inherit", position: "relative",
    }}>
      {/* ── PORTADA ── */}
      <div style={{
        background: "#1c2c20", color: "#ffffff",
        padding: "56px 40px 48px", textAlign: "center",
      }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: "#d2e4d4",
          letterSpacing: "0.05em", marginBottom: 10,
        }}>
          Finanzas con Sentido™
        </div>
        <div style={{
          fontSize: 36, fontWeight: 800, color: "#ffffff",
          marginBottom: 8, lineHeight: 1.1,
        }}>
          {data.periodTitle}
        </div>
        <div style={{
          fontSize: 12, color: "#a5c2a8",
          fontStyle: "italic", marginBottom: 6,
        }}>
          Tu fotografía financiera
        </div>
        <div style={{ fontSize: 11, color: "#d2e4d4" }}>
          {data.periodLabel}
        </div>
        <div style={{ fontSize: 10, color: "#7a9e7e", marginTop: 8 }}>
          {data.generatedAt}
        </div>
        <div style={{
          width: 48, height: 2, background: "#4a7a50",
          margin: "16px auto 0", borderRadius: 1,
        }} />
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "flex", gap: 12, padding: "24px 32px 20px" }}>
        <div style={{
          flex: 1, background: "#e6f5eb", padding: "20px 24px",
          borderLeft: "4px solid #227746", borderRadius: 0,
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: "#227746",
            letterSpacing: "0.08em", marginBottom: 8,
          }}>INGRESOS ▲</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#1a1a1a" }}>
            {fmt(data.totals.income)}
          </div>
          <div style={{
            width: 32, height: 2, background: "#227746",
            borderRadius: 1, marginTop: 8,
          }} />
        </div>

        <div style={{
          flex: 1, background: "#faeaea", padding: "20px 24px",
          borderLeft: "4px solid #af3030", borderRadius: 0,
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: "#af3030",
            letterSpacing: "0.08em", marginBottom: 8,
          }}>GASTOS ▼</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#1a1a1a" }}>
            {fmt(data.totals.expense)}
          </div>
          <div style={{
            width: 32, height: 2, background: "#af3030",
            borderRadius: 1, marginTop: 8,
          }} />
        </div>

        <div style={{
          flex: 1,
          background: balancePositive ? "#eaeeff" : "#faeaea",
          padding: "20px 24px",
          borderLeft: `4px solid ${balancePositive ? "#4b58c8" : "#af3030"}`,
          borderRadius: 0,
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700,
            color: balancePositive ? "#4b58c8" : "#af3030",
            letterSpacing: "0.08em", marginBottom: 8,
          }}>BALANCE NETO</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#1a1a1a" }}>
            {fmt(balance)}
          </div>
          <div style={{
            fontSize: 10,
            color: balancePositive ? "#4b58c8" : "#af3030",
            marginTop: 4,
          }}>
            {balancePct}% del ingreso
          </div>
        </div>
      </div>

      {/* ── Donut + Scorecards ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "200px 1fr",
        gap: 0, padding: "0 32px 20px",
      }}>
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <DonutChart pcts={donutPcts} />
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {data.blockSummaries.map((b) => {
              const c = BLOCK_COLORS[b.label] || { main: "#888", light: "#ccc" };
              return (
                <div key={b.label} style={{
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: 2,
                    background: c.light, flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: c.main,
                  }}>
                    {b.label} {b.percent.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 10, paddingLeft: 16, alignContent: "center",
        }}>
          <div style={{
            background: "#f7f7f5", borderRadius: 10, padding: "14px 16px",
          }}>
            <div style={{
              fontSize: 9, color: "#888", fontWeight: 600,
              letterSpacing: "0.08em", marginBottom: 5,
            }}>AHORRO REAL</div>
            <div style={{
              fontSize: 20, fontWeight: 800, color: "#1a1a1a",
            }}>{fmt(balance)}</div>
            <div style={{
              fontSize: 9, color: "#3a5a40", marginTop: 3,
            }}>del período</div>
          </div>

          <div style={{
            background: "#f7f7f5", borderRadius: 10, padding: "14px 16px",
          }}>
            <div style={{
              fontSize: 9, color: "#888", fontWeight: 600,
              letterSpacing: "0.08em", marginBottom: 5,
            }}>% INGRESO GUARDADO</div>
            <div style={{
              fontSize: 20, fontWeight: 800, color: "#1a1a1a",
            }}>{balancePct}%</div>
            <div style={{
              fontSize: 9,
              color: tasaAhorro >= 20 ? "#3a5a40" : "#c28a00",
              marginTop: 3,
            }}>
              {tasaAhorro >= 20 ? "por encima de la meta" : "meta: 20%"}
            </div>
          </div>

          <div style={{
            background: "#f7f7f5", borderRadius: 10, padding: "14px 16px",
          }}>
            <div style={{
              fontSize: 9, color: "#888", fontWeight: 600,
              letterSpacing: "0.08em", marginBottom: 5,
            }}>MAYOR GASTO ÚNICO</div>
            <div style={{
              fontSize: 20, fontWeight: 800, color: "#1a1a1a",
            }}>
              {mayorGasto ? fmt(mayorGasto.amount) : "—"}
            </div>
            <div style={{
              fontSize: 9, color: "#888", marginTop: 3,
              overflow: "hidden", textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {mayorGasto?.name ?? "—"}
            </div>
          </div>

          <div style={{
            background: "#f7f7f5", borderRadius: 10, padding: "14px 16px",
          }}>
            <div style={{
              fontSize: 9, color: "#888", fontWeight: 600,
              letterSpacing: "0.08em", marginBottom: 5,
            }}>MOVIMIENTOS</div>
            <div style={{
              fontSize: 20, fontWeight: 800, color: "#1a1a1a",
            }}>{totalMovimientos}</div>
            <div style={{
              fontSize: 9, color: "#888", marginTop: 3,
            }}>en el período</div>
          </div>
        </div>
      </div>

      {/* ── Distribución del gasto ── */}
      <div style={{ padding: "0 32px 20px" }}>
        <div style={{
          fontSize: 9, fontWeight: 700, color: "#5a5a5a",
          letterSpacing: "0.1em", marginBottom: 10,
          paddingTop: 14, borderTop: "1px solid #e8e8e8",
        }}>
          CÓMO SE DISTRIBUYÓ EL GASTO
        </div>

        {data.blockSummaries.map((b) => {
          const colors = BLOCK_COLORS[b.label]
            || { main: "#5a5a5a", light: "#c0c0c0" };
          return (
            <div key={b.label} style={{ marginBottom: 18 }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                marginBottom: 7,
              }}>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: colors.main,
                }}>{b.label}</span>
                <span>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: colors.main,
                  }}>{b.percent.toFixed(1)}%</span>
                  <span style={{
                    fontSize: 12, color: "#3a3a3a", marginLeft: 8,
                  }}>{fmt(b.amount)}</span>
                </span>
              </div>
              <div style={{
                height: 16, background: "#ebebeb",
                borderRadius: 8, position: "relative",
              }}>
                <div style={{
                  position: "absolute", height: 16, borderRadius: 8,
                  width: `${Math.min(b.percent, 100)}%`,
                  background: colors.light, top: 0, left: 0,
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Top categorías ── */}
      <div style={{ padding: "0 32px 20px" }}>
        <div style={{
          fontSize: 9, fontWeight: 700, color: "#5a5a5a",
          letterSpacing: "0.1em", marginBottom: 10,
          paddingTop: 14, borderTop: "1px solid #e8e8e8",
        }}>
          EN QUÉ GASTASTE MÁS
        </div>

        {data.topCategories.slice(0, 5).map((c, i) => {
          const normW = maxCatPct > 0 ? (c.pct / maxCatPct) * 100 : 0;
          return (
            <div key={c.name} style={{
              display: "flex", alignItems: "center",
              gap: 10, marginBottom: 13,
            }}>
              <span style={{
                minWidth: 22, fontSize: 11, fontWeight: 800,
                color: i === 0 ? "#af9450" : "#8a8a8a",
              }}>#{i + 1}</span>
              <span style={{
                flex: 1, fontSize: 13, fontWeight: 600, color: "#1a1a1a",
                whiteSpace: "nowrap", overflow: "hidden",
                textOverflow: "ellipsis",
              }}>{c.name}</span>
              <div style={{
                flex: 2, position: "relative", height: 8,
                background: "#ebebeb", borderRadius: 4,
              }}>
                <div style={{
                  width: `${normW}%`, background: "#d7c38c",
                  borderRadius: 4, height: 8,
                  position: "absolute", top: 0, left: 0,
                }} />
              </div>
              <span style={{
                minWidth: 38, textAlign: "right",
                fontSize: 11, fontWeight: 600, color: "#5a5a5a",
              }}>{c.pct.toFixed(1)}%</span>
              <span style={{
                minWidth: 80, textAlign: "right",
                fontSize: 13, fontWeight: 800, color: "#1a1a1a",
              }}>{fmt(c.amount)}</span>
            </div>
          );
        })}
      </div>

      {/* ── Semáforo financiero ── */}
      <div style={{ padding: "0 32px 80px" }}>
        <div style={{
          fontSize: 9, fontWeight: 700, color: "#5a5a5a",
          letterSpacing: "0.1em", marginBottom: 14,
          paddingTop: 14, borderTop: "1px solid #e8e8e8",
        }}>
          DIAGNÓSTICO DEL MES
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}>
          {indicadores.map((ind) => {
            const s = semaforo(ind.nivel);
            return (
              <div key={ind.label} style={{
                display: "flex", alignItems: "flex-start",
                gap: 12, padding: "12px 14px",
                borderRadius: 8, background: s.bg,
                borderLeft: `3px solid ${s.border}`,
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%",
                  background: s.circleBg, flexShrink: 0,
                  display: "flex", alignItems: "center",
                  justifyContent: "center", marginTop: 2,
                  fontSize: 13, fontWeight: 700, color: "#fff",
                }}>
                  {s.symbol}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "baseline", marginBottom: 4,
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: s.textColor,
                    }}>{ind.label}</span>
                    <span style={{
                      fontSize: 15, fontWeight: 800, color: s.textColor,
                    }}>{ind.valor}</span>
                  </div>
                  <div style={{
                    fontSize: 10, color: s.subColor,
                    fontStyle: "italic", lineHeight: 1.4,
                  }}>
                    "{ind.frase}"
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "12px 32px",
        borderTop: "1px solid #e8e8e8",
        display: "flex", justifyContent: "space-between",
        alignItems: "center", background: "#ffffff",
      }}>
        <span style={{
          fontSize: 9, fontStyle: "italic", color: "#3a5a40",
        }}>
          Tu dinero con calma. Tu vida con sentido.
        </span>
        <span style={{ fontSize: 8, color: "#888" }}>Página 1 de 3</span>
        <span style={{
          fontSize: 8, color: "#af9450", fontWeight: 600,
        }}>
          finanzasconsentidoscf.com
        </span>
      </div>
    </div>
  );
}
