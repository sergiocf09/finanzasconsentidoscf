

## Diagnóstico

**Problema 1 — Gasto en USD desde cuenta USD no calcula `amount_in_base`**

En `TransactionForm.tsx` línea 291, la condición `crossCurrency = data.currency !== account.currency` es `false` cuando ambos son USD. Resultado: `amount_in_base` queda `undefined`, y el trigger de presupuestos usa `COALESCE(amount_in_base, amount)` = 30 USD en lugar de ~600 MXN. El gasto acumulado en presupuestos y reportes queda subvaluado.

La misma lógica aplica en `VoiceButton.tsx` línea 237: `editCurrency !== acc.currency` es `false` cuando ambos son USD, así que `amount_in_base` queda igual al monto en USD.

**Problema 2 — Voice UI no muestra selector de moneda**

En el modo de edición del VoiceButton (líneas 684-760), no hay ningún `Select` para `editCurrency`. El usuario no puede cambiar la moneda del gasto por voz. En la vista de confirmación (líneas 460-500) tampoco se muestra la moneda.

## Plan de cambios

### Cambio 1 — TransactionForm: calcular `amount_in_base` cuando la cuenta NO es MXN

En `TransactionForm.tsx`, después de la lógica de `crossCurrency` (línea 313), agregar un bloque `else if` para el caso "same currency but not MXN":

```
// Cuenta y gasto son misma moneda pero no es MXN → calcular equivalente
if (!crossCurrency && account && account.currency !== "MXN" && fxRate > 0) {
  amountInBase = data.amount * fxRate;  // e.g. 30 USD * 20.5 = 615 MXN
  exchangeRate = fxRate;
  notes = `$${data.amount} ${account.currency} · TC: $${fxRate.toFixed(2)} · Equivalente: $${amountInBase.toFixed(2)} MXN`;
}
```

Esto asegura que `amount_in_base` tenga el equivalente en MXN para presupuestos y reportes, sin alterar el débito real de la cuenta (que sigue siendo en USD).

### Cambio 2 — VoiceButton handleConfirm: misma corrección

En `VoiceButton.tsx`, en el bloque `else` de handleConfirm (línea 229-264), después de la lógica de cross-currency, agregar el mismo bloque para "same currency, not MXN":

```
// Same currency but not MXN → set amount_in_base
if (editCurrency === acc.currency && acc.currency !== "MXN") {
  const rateForCurrency = fxRates[acc.currency] || 0;
  if (rateForCurrency > 0) {
    amountInBase = amount * rateForCurrency;
    exchangeRate = rateForCurrency;
    notes = `$${amount} ${acc.currency} · TC: $${rateForCurrency.toFixed(2)} · Equivalente: $${amountInBase.toFixed(2)} MXN`;
  }
}
```

### Cambio 3 — VoiceButton: agregar selector de moneda en la UI

**En la vista de confirmación** (alrededor de línea 470): mostrar la moneda junto al monto parseado, y agregar chips de moneda para poder cambiarla.

**En el modo de edición** (líneas 711-714): agregar un `Select` de moneda debajo del campo de monto, con opciones MXN/USD/EUR.

### Cambio 4 — VoiceButton: preview de conversión en vista de confirmación

Cuando `editCurrency !== "MXN"`, mostrar un indicador del equivalente en MXN debajo del resumen parseado (similar al cross-currency indicator que ya existe en líneas 503-531), pero también para el caso "same currency, not MXN".

### Archivos a modificar
- `src/components/transactions/TransactionForm.tsx` — agregar cálculo de `amount_in_base` para cuentas no-MXN
- `src/components/voice/VoiceButton.tsx` — agregar selector de moneda + cálculo de `amount_in_base` para cuentas no-MXN

