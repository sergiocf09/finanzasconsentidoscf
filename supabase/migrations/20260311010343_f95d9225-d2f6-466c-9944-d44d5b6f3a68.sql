
-- Step 1: Create unique index for system categories upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_system_name_type 
ON public.categories (name, type) WHERE is_system = true;

-- Step 2: Upsert all default system categories
INSERT INTO public.categories (user_id, name, type, icon, is_system, bucket, keywords)
VALUES
  -- ESTABILIDAD
  (NULL, 'Vivienda', 'expense', 'home', true, 'stability', ARRAY['renta','hipoteca','predial','mantenimiento','condominio']::TEXT[]),
  (NULL, 'Alimentación básica', 'expense', 'shopping-cart', true, 'stability', ARRAY['super','despensa','walmart','soriana','heb','chedraui','costco','mercado','bodega','aurrera']::TEXT[]),
  (NULL, 'Transporte', 'expense', 'car', true, 'stability', ARRAY['gasolina','gas','uber','didi','taxi','metro','autobus','estacionamiento','caseta','tenencia']::TEXT[]),
  (NULL, 'Servicios del hogar', 'expense', 'zap', true, 'stability', ARRAY['luz','cfe','agua','gas natural','internet','telefono','telmex','izzi','totalplay','megacable']::TEXT[]),
  (NULL, 'Salud', 'expense', 'heart-pulse', true, 'stability', ARRAY['doctor','hospital','farmacia','medicina','consulta','dentista','laboratorio','analisis']::TEXT[]),
  (NULL, 'Educación', 'expense', 'graduation-cap', true, 'stability', ARRAY['colegiatura','escuela','universidad','guarderia','kinder','inscripcion']::TEXT[]),
  (NULL, 'Seguros', 'expense', 'shield', true, 'stability', ARRAY['seguro','deducible','coaseguro','prima','poliza']::TEXT[]),
  (NULL, 'Créditos y deudas', 'expense', 'credit-card', true, 'stability', ARRAY['credito','prestamo','abono','pago minimo','mensualidad','cuota']::TEXT[]),
  -- CALIDAD DE VIDA
  (NULL, 'Restaurantes y cafés', 'expense', 'utensils', true, 'lifestyle', ARRAY['restaurante','cafe','starbucks','tacos','sushi','pizza','comida rapida','oxxo','antojitos']::TEXT[]),
  (NULL, 'Entretenimiento', 'expense', 'gamepad-2', true, 'lifestyle', ARRAY['cine','teatro','concierto','bar','antro','evento','fiesta','boliche','parque']::TEXT[]),
  (NULL, 'Suscripciones', 'expense', 'tv', true, 'lifestyle', ARRAY['netflix','spotify','disney','hbo','youtube','apple','amazon','paramount']::TEXT[]),
  (NULL, 'Ropa y calzado', 'expense', 'shirt', true, 'lifestyle', ARRAY['ropa','zapatos','zara','liverpool','palacio','mango','shein','nike','adidas']::TEXT[]),
  (NULL, 'Cuidado personal', 'expense', 'sparkles', true, 'lifestyle', ARRAY['salon','peluqueria','spa','cosmeticos','barberia','estetica','maquillaje']::TEXT[]),
  (NULL, 'Deportes y bienestar', 'expense', 'activity', true, 'lifestyle', ARRAY['gym','gimnasio','yoga','crossfit','pilates','natacion','futbol','padel']::TEXT[]),
  (NULL, 'Viajes y vacaciones', 'expense', 'plane', true, 'lifestyle', ARRAY['hotel','vuelo','airbnb','viaje','tour','vacaciones','hospedaje','pasaje']::TEXT[]),
  (NULL, 'Mascotas', 'expense', 'paw-print', true, 'lifestyle', ARRAY['veterinario','mascota','perro','gato','petco','pienso','pet']::TEXT[]),
  (NULL, 'Hogar y decoración', 'expense', 'sofa', true, 'lifestyle', ARRAY['mueble','decoracion','ikea','ferreteria','home depot','truper']::TEXT[]),
  (NULL, 'Otros gastos', 'expense', 'more-horizontal', true, 'lifestyle', ARRAY[]::TEXT[]),
  -- CONSTRUCCIÓN
  (NULL, 'Fondo de emergencia', 'expense', 'umbrella', true, 'build', ARRAY['fondo','emergencia','colchon','reserva','ahorro emergencia']::TEXT[]),
  (NULL, 'Ahorro', 'expense', 'piggy-bank', true, 'build', ARRAY['ahorro','ahorrar','guardado','alcancia']::TEXT[]),
  (NULL, 'Inversiones', 'expense', 'trending-up', true, 'build', ARRAY['inversion','cetes','gbm','fondos','acciones','etf','bursatil']::TEXT[]),
  (NULL, 'Retiro', 'expense', 'building-2', true, 'build', ARRAY['afore','retiro','jubilacion','pension ahorro']::TEXT[]),
  (NULL, 'Metas específicas', 'expense', 'target', true, 'build', ARRAY['meta','objetivo','proyecto','enganche','auto nuevo']::TEXT[]),
  -- INGRESOS
  (NULL, 'Salario / Nómina', 'income', 'banknote', true, NULL, ARRAY['salario','sueldo','nomina','quincena','pago','deposito nomina']::TEXT[]),
  (NULL, 'Freelance / Honorarios', 'income', 'laptop', true, NULL, ARRAY['freelance','honorarios','proyecto','cliente','factura','servicio profesional']::TEXT[]),
  (NULL, 'Negocio propio', 'income', 'store', true, NULL, ARRAY['negocio','venta','ingreso negocio','caja','cobro']::TEXT[]),
  (NULL, 'Renta de propiedades', 'income', 'key', true, NULL, ARRAY['renta cobrada','arrendamiento','inquilino','departamento renta']::TEXT[]),
  (NULL, 'Inversiones y rendimientos', 'income', 'bar-chart-2', true, NULL, ARRAY['dividendo','interes','rendimiento','cetes ganancia','plusvalia']::TEXT[]),
  (NULL, 'Pensión / Jubilación', 'income', 'calendar', true, NULL, ARRAY['pension','jubilacion','afore retiro']::TEXT[]),
  (NULL, 'Otros ingresos', 'income', 'plus-circle', true, NULL, ARRAY[]::TEXT[]),
  -- TRANSFERENCIAS
  (NULL, 'Transferencia', 'transfer', 'arrow-left-right', true, NULL, ARRAY['transferencia','traspaso','spei']::TEXT[])
ON CONFLICT (name, type) WHERE is_system = true
DO UPDATE SET
  bucket = EXCLUDED.bucket,
  keywords = EXCLUDED.keywords,
  icon = EXCLUDED.icon;
