
# Plan: unificar y enriquecer la creación de presupuestos (Ingresos y Gastos)

## Decisiones acordadas
1. **Horizonte por defecto:** "Sólo este mes".
2. **Trimestre:** calendario (Ene-Mar, Abr-Jun, Jul-Sep, Oct-Dic). Se ofrece el trimestre **en curso** según el mes seleccionado.
3. **Copiar del mes anterior:** búsqueda retroactiva hasta encontrar el presupuesto más reciente del **mismo tipo**.
4. **Resumen multi-mes:** sí, al finalizar muestra "Se crearon X de Y meses; los meses Z se omitieron".

---

## 1. Cambios en el wizard (`BudgetCreationWizard.tsx`)

### 1.1 Paridad de métodos por tipo

| Método | Gasto | Ingreso |
|---|---|---|
| Manual | ✅ | ✅ |
| Basado en histórico | ✅ | ✅ |
| **Copiar del mes anterior** *(nuevo)* | ✅ | ✅ |
| Plantilla | ✅ | ❌ |
| Inteligente | ✅ | ❌ |

El nuevo método **"Copiar del mes anterior"** busca hacia atrás (mes inmediato, luego previo, etc.) hasta encontrar el presupuesto activo más reciente del mismo `budget_type` y lo precarga en el paso "configure" para edición. Si no encuentra ninguno, el método aparece deshabilitado con tooltip "Sin presupuesto previo del mismo tipo".

### 1.2 Selector de horizonte (paso "period")

Añadir bajo Mes/Año:

```text
Aplicar a:
  ◉ Sólo este mes
  ○ Trimestre calendario (Abr-Jun 2026)   ← muestra el trimestre del mes elegido
  ○ Resto del año (May–Dic 2026)
  ○ Año completo 2026
```

El label del trimestre se calcula dinámicamente: `Math.floor((month-1)/3)` → meses 1-3, 4-6, 7-9, 10-12.

### 1.3 Detección de conflictos multi-mes

`checkExistingBudgets` se llama por cada mes del rango. Si hay conflictos en uno o más meses, mostrar AlertDialog consolidado:

```text
Ya existen presupuestos de [tipo] en:
  • Mayo 2026 (8 categorías)
  • Julio 2026 (3 categorías)

  ◉ Saltar esos meses (default)
  ○ Reemplazar todos
  ○ Cancelar
```

### 1.4 Guardado multi-mes

`handleSave` genera N batches de inserts (uno por mes del rango, mismo monto). Se ejecuta secuencialmente para que `recalculate_budget_spent` corra por cada mes. Al finalizar, toast resumen:

```text
✓ Presupuesto creado en 3 meses (May, Jun, Jul 2026).
✓ Presupuesto creado en 2 de 3 meses.
  Junio 2026 se omitió por presupuesto existente.
```

---

## 2. Cambios en `useBudgetWizard.ts`

- `checkExistingBudgets(year, month, budgetType)` ya filtra por tipo (✓ hecho).
- `deactivateOldBudgets(year, month, budgetType)` ya filtra por tipo (✓ hecho).
- **Nuevo:** `fetchPreviousBudget(budgetType, fromYear, fromMonth)` — busca hacia atrás hasta 24 meses y devuelve la lista de filas del primer mes con presupuesto activo del mismo tipo.
- **Nuevo:** `expandMonthRange(year, month, horizon)` — devuelve array `[{year, month}, ...]` según horizonte.

---

## 3. Migración SQL (defensiva)

```sql
-- Reemplazar unique index para incluir budget_type
DROP INDEX IF EXISTS budgets_user_id_category_id_period_month_year_key;

CREATE UNIQUE INDEX budgets_unique_active_key
ON public.budgets (user_id, category_id, period, month, year, budget_type)
WHERE is_active = true;
```

Y actualizar `upsertBudgets` con `onConflict: "user_id,category_id,period,month,year,budget_type"`.

---

## 4. Lo que NO se toca

- Triggers de `spent`, `update_income_budget`, `recalculate_budget_spent`.
- Bloques pedagógicos (Estabilidad / Calidad / Construcción).
- `BudgetCategoryDetail`, `BudgetSummary`, `PeriodSummaryCards`, comparativa vs mes anterior.
- Categorías ocultas / sistema.
- Lógica de edición ya existente desde `Budgets.tsx` (eliminar ítem, abrir detalle).

---

## 5. Archivos a modificar

- `src/components/budgets/BudgetCreationWizard.tsx` — método "Copiar del mes anterior", horizonte, conflict dialog multi-mes, save multi-mes con resumen.
- `src/hooks/useBudgetWizard.ts` — `fetchPreviousBudget`, `expandMonthRange`, ajuste `onConflict`.
- Migración SQL — unique index con `budget_type`.

Cambios aditivos; nada se rompe en mes individual.
