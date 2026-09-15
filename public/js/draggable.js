/**
 * StepAway Draggable Overlay Module
 * Enables streamers to drag and reposition overlay cards freely in the preview or browser source.
 */
function makeDraggable(element) {
  if (!element) return;
  let isDragging = false;
  let startX = 0, startY = 0;
  let currentX = 0, currentY = 0;

  element.style.cursor = 'grab';
  element.style.userSelect = 'none';
  element.style.touchAction = 'none';

  // Load saved position from session/localStorage if available
  const storageKey = `stepaway_pos_${element.id || 'widget'}`;
  const savedPos = sessionStorage.getItem(storageKey);
  if (savedPos) {
    try {
      const { x, y } = JSON.parse(savedPos);
      currentX = x;
      currentY = y;
      element.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    } catch (e) {}
  }

  const onPointerDown = (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'A') return;
    isDragging = true;
    startX = e.clientX - currentX;
    startY = e.clientY - currentY;
    element.style.cursor = 'grabbing';
    element.style.zIndex = '9999';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const onPointerMove = (e) => {
    if (!isDragging) return;
    currentX = e.clientX - startX;
    currentY = e.clientY - startY;
    element.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
  };

  const onPointerUp = () => {
    if (!isDragging) return;
    isDragging = false;
    element.style.cursor = 'grab';
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ x: currentX, y: currentY }));
    } catch (e) {}
  };

  element.addEventListener('pointerdown', onPointerDown);
}
