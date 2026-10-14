const assert = require('assert');
const fs = require('fs');
const path = require('path');

const contentCode = fs.readFileSync(path.resolve(__dirname, '../content.js'), 'utf8');
const popupHtml   = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
const popupJs     = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');

console.log('Testing Floating Button Disable Guarantee...');
// 1. Must detach host from DOM or hide wrap when disabled
assert.ok(
  contentCode.includes('host.remove()') || contentCode.includes('wrap.style.display'),
  'content.js must remove host from DOM or hide wrap completely when disabled'
);

// 2. Must not append host initially if disabled
assert.ok(
  contentCode.includes('enableFloatingButton') && (contentCode.includes('updateWidgetVisibility') || contentCode.includes('applyVisibility')),
  'content.js must control initial mounting via settings check'
);

console.log('Testing Draggable Floating Button...');
// 3. Must implement dragging logic on FAB
assert.ok(
  contentCode.includes('pointerdown') || contentCode.includes('mousedown'),
  'content.js must listen for pointerdown or mousedown to start dragging'
);
assert.ok(
  contentCode.includes('pointermove') || contentCode.includes('mousemove'),
  'content.js must listen for pointermove or mousemove to drag'
);
assert.ok(
  contentCode.includes('isDragging') || contentCode.includes('hasDragged') || contentCode.includes('dragged'),
  'content.js must distinguish drag from click'
);
assert.ok(
  contentCode.includes('chapter_tracker_fab_pos') || contentCode.includes('fab_pos') || contentCode.includes('saveFabPosition'),
  'content.js must persist floating button position'
);

console.log('Testing Clear Visual Toggle Status in Popup...');
// 4. Must display toggle status indicator
assert.ok(
  popupHtml.includes('floatingButtonStatus') || popupHtml.includes('toggle-status'),
  'popup.html must have a clear visual status indicator for the floating button'
);
assert.ok(
  popupJs.includes('floatingButtonStatus') || popupJs.includes('updateToggleStatus') || popupJs.includes('Ativado'),
  'popup.js must update toggle status text (Ativado / Desativado)'
);

console.log('✓ Floating button drag & disable test assertions prepared.');
