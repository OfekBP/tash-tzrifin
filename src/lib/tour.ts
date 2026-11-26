/**
 * הדרכה קצרה על העמוד הנוכחי. נטענת רק כשלוחצים על כפתור סימן השאלה.
 * צעד שהאלמנט שלו לא קיים או מוסתר בעמוד פשוט מדולג.
 */
import { tours, type Step } from './tour-steps';

const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
};
const targets = (s: Step) => {
  const found = s.sel ? [...document.querySelectorAll<HTMLElement>(s.sel)].filter(visible) : [];
  return s.all ? found : found.slice(0, 1);
};

/** המלבן שמקיף את כל האלמנטים של הצעד */
function box(els: HTMLElement[]) {
  const rs = els.map((e) => e.getBoundingClientRect());
  const top = Math.min(...rs.map((r) => r.top));
  const left = Math.min(...rs.map((r) => r.left));
  return { top, left, width: Math.max(...rs.map((r) => r.right)) - left, height: Math.max(...rs.map((r) => r.bottom)) - top };
}

const isFixed = (el: HTMLElement) => {
  for (let e: HTMLElement | null = el; e && e !== document.body; e = e.parentElement) {
    const p = getComputedStyle(e).position;
    if (p === 'fixed' || p === 'sticky') return true;
  }
  return false;
};

export function startTour(page: string, opener: HTMLElement) {
  if (document.querySelector('dialog.tour')) return;
  const usable = (s: Step) => !s.sel || targets(s).length > 0;
  let steps = (tours[page] ?? tours.other).filter(usable);
  // עמוד שאף צעד שלו לא קיים בו (למשל עמוד 404): נשאר הצעד הכללי, ואם גם הוא חסר לא נפתחת הדרכה
  if (!steps.length) steps = tours.other.filter(usable);
  if (!steps.length) return;
  const startY = scrollY;
  let i = 0;

  const dlg = document.createElement('dialog');
  dlg.className = 'tour';
  dlg.setAttribute('aria-labelledby', 'tour-title');
  dlg.setAttribute('aria-describedby', 'tour-text');
  dlg.innerHTML = `
    <div class="tour-spot" aria-hidden="true"></div>
    <div class="tour-card">
      <div class="tour-top"><span class="tour-count"></span><button type="button" class="tour-x">דילוג</button></div>
      <div aria-live="polite"><h2 id="tour-title"></h2><p id="tour-text"></p></div>
      <div class="tour-dots" aria-hidden="true">${steps.map(() => '<i></i>').join('')}</div>
      <div class="tour-nav"><button type="button" class="tour-next"></button><button type="button" class="tour-prev">הקודם</button></div>
    </div>`;
  document.body.append(dlg);

  const $ = <T extends HTMLElement>(s: string) => dlg.querySelector<T>(s)!;
  const spot = $('.tour-spot');
  const card = $('.tour-card');
  const next = $<HTMLButtonElement>('.tour-next');
  const prev = $<HTMLButtonElement>('.tour-prev');
  const dots = [...dlg.querySelectorAll<HTMLElement>('.tour-dots i')];

  // גובה ההדגשה המרבי, כך שתמיד נשאר מקום לכרטיס ההסבר מתחתיה
  const maxSpot = () => Math.min(innerHeight * 0.5, Math.max(72, innerHeight - card.offsetHeight - 90));

  function place() {
    const els = targets(steps[i]);
    const vw = document.documentElement.clientWidth;
    const vh = innerHeight;
    const ch = card.offsetHeight;
    if (!els.length) {
      spot.style.cssText = `top:${vh / 2}px;left:${vw / 2}px;width:0;height:0;border-width:0`;
      card.style.top = `${Math.max(8, (vh - ch) / 2)}px`;
      return;
    }
    const r = box(els);
    const pad = 6;
    const top = Math.max(4, r.top - pad);
    // אלמנט גבוה: מדגישים רק את חלקו העליון כדי שיישאר מקום להסבר
    const height = Math.min(r.top + r.height + pad, top + maxSpot(), vh - 4) - top;
    const left = Math.max(4, r.left - pad);
    const width = Math.min(r.width + pad * 2, vw - left - 4);
    spot.style.cssText = `top:${top}px;left:${left}px;width:${width}px;height:${height}px`;
    const below = top + height + 12;
    const above = top - 12 - ch;
    card.style.top = `${below + ch <= vh - 8 ? below : above >= 8 ? above : vh - ch - 8}px`;
  }

  function show(n: number) {
    i = n;
    const s = steps[i];
    $('.tour-count').textContent = `${i + 1} מתוך ${steps.length}`;
    $('#tour-title').textContent = s.title;
    $('#tour-text').textContent = s.text;
    prev.hidden = i === 0;
    next.textContent = i === steps.length - 1 ? 'סיום' : 'הבא';
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    const els = targets(s);
    if (els.length && !isFixed(els[0])) {
      const r = box(els);
      const vh = innerHeight;
      const goal = r.height + 12 >= maxSpot() ? 70 : Math.max(70, (vh - r.height) * 0.3);
      scrollTo({ top: Math.max(0, scrollY + r.top - goal), behavior: 'instant' });
    }
    place();
    next.focus({ preventScroll: true });
  }

  const close = () => {
    removeEventListener('resize', place);
    dlg.close();
    dlg.remove();
    scrollTo({ top: startY, behavior: 'instant' });
    opener.focus({ preventScroll: true });
  };

  next.addEventListener('click', () => (i === steps.length - 1 ? close() : show(i + 1)));
  prev.addEventListener('click', () => show(i - 1));
  $('.tour-x').addEventListener('click', close);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  // בכתיבה מימין לשמאל: החץ השמאלי מקדם
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' && i < steps.length - 1) show(i + 1);
    else if (e.key === 'ArrowRight' && i > 0) show(i - 1);
  });
  addEventListener('resize', place);

  dlg.showModal();
  show(0);
}
