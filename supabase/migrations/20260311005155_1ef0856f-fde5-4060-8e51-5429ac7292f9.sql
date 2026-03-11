
-- Step 1: Delete system categories that have no references in transactions, budgets, budget_lines, or recurring_payments
DELETE FROM public.categories 
WHERE is_system = true 
AND id NOT IN (
  SELECT DISTINCT category_id FROM public.transactions WHERE category_id IS NOT NULL
  UNION
  SELECT DISTINCT category_id FROM public.budgets WHERE category_id IS NOT NULL
  UNION
  SELECT DISTINCT category_id FROM public.budget_lines WHERE category_id IS NOT NULL
  UNION
  SELECT DISTINCT category_id FROM public.recurring_payments WHERE category_id IS NOT NULL
);

-- Step 2: Update remaining system categories with correct bucket/keywords
UPDATE public.categories SET bucket = 'stability', keywords = ARRAY['renta','hipoteca','predial','mantenimiento','condominio']::TEXT[] WHERE is_system = true AND name ILIKE '%vivienda%';
UPDATE public.categories SET name = 'Alimentación básica', bucket = 'stability', keywords = ARRAY['super','despensa','walmart','soriana','heb','chedraui','costco','mercado','bodega','aurrera']::TEXT[] WHERE is_system = true AND name ILIKE '%alimenta%';
UPDATE public.categories SET bucket = 'stability', keywords = ARRAY['gasolina','gas','uber','didi','taxi','metro','autobus','estacionamiento','caseta','tenencia']::TEXT[] WHERE is_system = true AND name ILIKE '%transporte%';
UPDATE public.categories SET name = 'Servicios del hogar', bucket = 'stability', keywords = ARRAY['luz','cfe','agua','gas natural','internet','telefono','telmex','izzi','totalplay','megacable']::TEXT[] WHERE is_system = true AND name ILIKE '%servicio%';
UPDATE public.categories SET bucket = 'stability', keywords = ARRAY['doctor','hospital','farmacia','medicina','consulta','dentista','laboratorio','analisis']::TEXT[] WHERE is_system = true AND name ILIKE '%salud%';
UPDATE public.categories SET bucket = 'stability', keywords = ARRAY['colegiatura','escuela','universidad','guarderia','kinder','inscripcion']::TEXT[] WHERE is_system = true AND name ILIKE '%educaci%';
UPDATE public.categories SET name = 'Restaurantes y cafés', bucket = 'lifestyle', keywords = ARRAY['restaurante','cafe','starbucks','tacos','sushi','pizza','comida rapida','oxxo','antojitos']::TEXT[] WHERE is_system = true AND name ILIKE '%aliment%' AND bucket = 'lifestyle';
UPDATE public.categories SET bucket = 'lifestyle', keywords = ARRAY['cine','teatro','concierto','bar','antro','evento','fiesta','boliche','parque']::TEXT[] WHERE is_system = true AND name ILIKE '%entretenimiento%';
UPDATE public.categories SET bucket = 'lifestyle', keywords = ARRAY['ropa','zapatos','zara','liverpool','palacio','mango','shein','nike','adidas']::TEXT[] WHERE is_system = true AND name ILIKE '%ropa%';

-- Step 3: Insert new system categories that don't exist yet
INSERT INTO public.categories (user_id, name, type, icon, is_system, bucket, keywords)
SELECT vals.* FROM (VALUES
  (NULL::uuid, 'Seguros', 'expense', 'shield', true, 'stability', ARRAY['seguro','deducible','coaseguro','prima','poliza']::TEXT[]),
  (NULL::uuid, 'Créditos y deudas', 'expense', 'credit-card', true, 'stability', ARRAY['credito','prestamo','abono','pago minimo','mensualidad','cuota']::TEXT[]),
  (NULL::uuid, 'Suscripciones', 'expense', 'tv', true, 'lifestyle', ARRAY['netflix','spotify','disney','hbo','youtube','apple','amazon','paramount']::TEXT[]),
  (NULL::uuid, 'Cuidado personal', 'expense', 'sparkles', true, 'lifestyle', ARRAY['salon','peluqueria','spa','cosmeticos','barberia','estetica','maquillaje']::TEXT[]),
  (NULL::uuid, 'Deportes y bienestar', 'expense', 'activity', true, 'lifestyle', ARRAY['gym','gimnasio','yoga','crossfit','pilates','natacion','futbol','padel']::TEXT[]),
  (NULL::uuid, 'Viajes y vacaciones', 'expense', 'plane', true, 'lifestyle', ARRAY['hotel','vuelo','airbnb','viaje','tour','vacaciones','hospedaje','pasaje']::TEXT[]),
  (NULL::uuid, 'Mascotas', 'expense', 'paw-print', true, 'lifestyle', ARRAY['veterinario','mascota','perro','gato','petco','pienso','pet']::TEXT[]),
  (NULL::uuid, 'Hogar y decoración', 'expense', 'sofa', true, 'lifestyle', ARRAY['mueble','decoracion','ikea','ferreteria','home depot','truper']::TEXT[]),
  (NULL::uuid, 'Fondo de emergencia', 'expense', 'umbrella', true, 'build', ARRAY['fondo','emergencia','colchon','reserva','ahorro emergencia']::TEXT[]),
  (NULL::uuid, 'Ahorro', 'expense', 'piggy-bank', true, 'build', ARRAY['ahorro','ahorrar','guardado','alcancia']::TEXT[]),
  (NULL::uuid, 'Inversiones', 'expense', 'trending-up', true, 'build', ARRAY['inversion','cetes','gbm','fondos','acciones','etf','bursatil']::TEXT[]),
  (NULL::uuid, 'Retiro', 'expense', 'building-2', true, 'build', ARRAY['afore','retiro','jubilacion','pension ahorro','ppro']::TEXT[]),
  (NULL::uuid, 'Metas específicas', 'expense', 'target', true, 'build', ARRAY['meta','objetivo','proyecto','enganche','auto nuevo']::TEXT[]),
  (NULL::uuid, 'Negocio propio', 'income', 'store', true, NULL, ARRAY['negocio','venta','ingreso negocio','caja','cobro']::TEXT[]),
  (NULL::uuid, 'Renta de propiedades', 'income', 'key', true, NULL, ARRAY['renta cobrada','arrendamiento','inquilino','departamento renta']::TEXT[]),
  (NULL::uuid, 'Inversiones y rendimientos', 'income', 'bar-chart-2', true, NULL, ARRAY['dividendo','interes','rendimiento','cetes ganancia','plusvalia']::TEXT[])
) AS vals(user_id, name, type, icon, is_system, bucket, keywords)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories 
  WHERE is_system = true AND name ILIKE vals.name
);
