// Injected into the website: a cursor that follows the mouse and a caption pill, since headless Chromium draws neither.
export const TOUR_OVERLAY = `
  try { localStorage.setItem('kombinat-website:star-bar-closed', 'true'); } catch {}
  window.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = [
      'section[aria-roledescription="carousel"] { display: none !important; }',
      '#tour-cursor { position: fixed; left: 0; top: 0; width: 22px; height: 22px; margin: -3px 0 0 -4px; pointer-events: none; z-index: 2147483647; transform-origin: 4px 3px; transition: scale 0.12s ease-out; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5)); }',
      '#tour-caption { position: fixed; left: 50%; bottom: 28px; translate: -50% 8px; opacity: 0; padding: 9px 18px; border-radius: 9999px; background: rgba(24, 24, 27, 0.92); box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1), 0 12px 32px -8px rgba(0, 0, 0, 0.7); color: #ececee; font: 500 17px/24px Geist, sans-serif; white-space: nowrap; pointer-events: none; z-index: 2147483646; transition: opacity 0.3s ease-out, translate 0.3s ease-out; }',
      '#tour-caption[data-visible] { opacity: 1; translate: -50% 0; }',
    ].join('\\n');
    document.head.append(style);

    const cursor = document.createElement('div');
    cursor.id = 'tour-cursor';
    cursor.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2.5 L4 19.5 L8.6 15.3 L11.6 21.8 L14.6 20.4 L11.6 14 L17.8 14 Z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.body.append(cursor);
    window.addEventListener('mousemove', event => { cursor.style.translate = event.clientX + 'px ' + event.clientY + 'px'; }, true);
    window.addEventListener('mousedown', () => { cursor.style.scale = '0.82'; }, true);
    window.addEventListener('mouseup', () => { cursor.style.scale = '1'; }, true);

    const caption = document.createElement('div');
    caption.id = 'tour-caption';
    document.body.append(caption);

    // The screencast only sends a frame when something paints, so a pixel keeps changing during holds.
    const tick = document.createElement('div');
    tick.style.cssText = 'position: fixed; left: 0; bottom: 0; width: 1px; height: 1px; opacity: 0.01; pointer-events: none;';
    document.body.append(tick);
    let isOn = false;
    setInterval(() => { isOn = !isOn; tick.style.background = isOn ? '#000' : '#010101'; }, 16);
  });
`;
