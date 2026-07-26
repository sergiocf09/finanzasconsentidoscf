/**
 * Guarda global contra cierres accidentales por gestos de zoom (pinch).
 *
 * En móvil, hacer zoom in/out dentro de un diálogo genera eventos táctiles
 * multi-touch que Radix puede interpretar como "interacción fuera" y cerrar
 * la plantilla. Aquí registramos cuándo hay un gesto de zoom activo (o recién
 * terminado) para ignorar esos cierres.
 */

let activeTouches = 0;
let lastPinchEnd = 0;
let visualZoomActive = false;
let lastZoomChange = 0;

const COOLDOWN_MS = 800;

if (typeof window !== "undefined") {
  const onTouchStart = (e: TouchEvent) => {
    activeTouches = e.touches.length;
    if (activeTouches > 1) lastPinchEnd = Date.now();
  };
  const onTouchMove = (e: TouchEvent) => {
    activeTouches = e.touches.length;
    if (activeTouches > 1) lastPinchEnd = Date.now();
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (activeTouches > 1) lastPinchEnd = Date.now();
    activeTouches = e.touches.length;
  };

  document.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
  document.addEventListener("touchmove", onTouchMove, { passive: true, capture: true });
  document.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });
  document.addEventListener("touchcancel", onTouchEnd, { passive: true, capture: true });

  const vv = window.visualViewport;
  if (vv) {
    const syncZoom = () => {
      const zoomed = vv.scale > 1.01;
      if (zoomed !== visualZoomActive) lastZoomChange = Date.now();
      visualZoomActive = zoomed;
      lastZoomChange = Date.now();
    };
    vv.addEventListener("resize", syncZoom);
    vv.addEventListener("scroll", syncZoom);
  }
}

/** true si hay un gesto de zoom en curso o terminó hace muy poco. */
export function isPinchGestureActive(): boolean {
  const now = Date.now();
  return (
    activeTouches > 1 ||
    now - lastPinchEnd < COOLDOWN_MS ||
    (visualZoomActive && now - lastZoomChange < COOLDOWN_MS)
  );
}

/** true si la vista está actualmente con zoom aplicado. */
export function isViewportZoomed(): boolean {
  return visualZoomActive;
}

/**
 * Handler reutilizable para Radix: bloquea el cierre por interacción externa
 * cuando el usuario está haciendo zoom.
 */
export function guardOutsideClose(event: { preventDefault: () => void }) {
  if (isPinchGestureActive() || isViewportZoomed()) {
    event.preventDefault();
  }
}
