# Plan: aislar presupuestos de ingreso y de gasto

## Diagnóstico

Al crear un presupuesto de ingresos para mayo, el wizard borró el presupuesto de gastos que ya existía. La causa está en `useBudgetWizard.ts` y `BudgetCreationWizard.tsx`:

1. `checkExistingBudgets(year, month)` cuenta TODOS los presupuestos del mes sin filtrar por `budget_type`. Si ya hay gastos cargados y se va a crear un ingreso, dispara el diálogo "Ya hay presupuestos" como si fueran del mismo tipo.
2. Si el usuario elige "Reemplazar", `deactivateOldBudgets(year, month)` marca `is_active = false` en **todos** los presupuestos del mes, incluyendo los de gasto. Resultado: el presupuesto de gastos de mayo desaparece tras cargar el de ingresos.
3. La constraint única de la tabla (`user_id, category_id, period, month, year`) tampoco distingue tipo, lo cual deja la puerta abierta a colisiones en upsert si una categoría llegara a usarse en ambos lados.

Esto también explica por qué abril (sin ingreso aún) se ve "completo" y mayo se ve "modificado": en mayo el bloque de gastos fue desactivado, así que el resumen, la comparativa vs mes anterior y los bloques de gasto ya no tienen datos que mostrar.

## Solución (sólo frontend + 1 migración mínima)

### 1. `src/hooks/useBudgetWizard.ts`
- `checkExistingBudgets(year, month, budgetType)` → agregar `.eq("budget_type", budgetType)`.
- `deactivateOldBudgets(year, month, budgetType)` → agregar `.eq("budget_type", budgetType)`.
- Ajustar firmas y tipos.

### 2. `src/components/budgets/BudgetCreationWizard.tsx`
- Pasar `budgetType` a `checkExistingBudgets` y `deactivateOldBudgets`.
- En `handleCopyAsBase` el query de "existing" también filtra por `budget_type = budgetType` (sólo copia presupuestos del mismo tipo como base).
- Los mensajes del `AlertDialog` aclaran el tipo: "Ya existe un presupuesto de **ingresos** para mayo 2026" (o "de **gastos**").

### 3. Migración SQL (recomendada, no destructiva)
Cambiar el índice único del upsert para incluir `budget_type`:

```text
DROP existing unique index/constraint on (user_id, category_id, period, month, year)
CREATE UNIQUE INDEX ... ON budgets (user_id, category_id, period, month, year, budget_type) WHERE is_active = true
```

Y actualizar el `onConflict` del upsert en `useBudgetWizard.ts` para incluir `budget_type`. Esto evita que un futuro upsert pise el otro tipo aunque compartan `category_id`.

## Lo que NO se toca
- Lógica de `useBudgets`, totales, comparativa vs mes anterior, `BudgetSummary`, `BudgetCategoryDetail`, `PeriodSummaryCards`.
- UI de la sección de ingresos esperados.
- Datos ya existentes en mayo: si el presupuesto de gastos ya fue desactivado, se podrá restaurar manualmente (o con un script breve) — lo confirmo antes de tocar nada en BD.

## Pregunta para ti antes de ejecutar
¿Quieres que, además del fix, intente **restaurar el presupuesto de gastos de mayo 2026** que quedó desactivado? Puedo reactivar las filas con `is_active = false` de ese mes y tipo `expense` si no hay un set nuevo creado después.