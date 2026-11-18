const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
}

resize();
window.addEventListener('resize', resize);

// Rectangle affiché en rouge
// ctx.fillStyle = 'red';
// ctx.fillRect(20, 20, 100, 100);

//affichage d'un point aux détection du clic
// canvas.addEventListener('pointerdown', (e) => {
//   const rect = canvas.getBoundingClientRect();
//   const x = e.clientX - rect.left;
//   const y = e.clientY - rect.top;

//   ctx.beginPath();
//   ctx.arc(x, y, 3, 0, Math.PI * 2);
//   ctx.fill();
// });

let drawing = false;
let last = null;

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

canvas.addEventListener('pointerdown', (e) => {
  drawing = true;
  canvas.setPointerCapture(e.pointerId);
  last = getPos(e);
});

canvas.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  const p = getPos(e);

  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();

  last = p;
});

canvas.addEventListener('pointerup', () => { drawing = false; });
canvas.addEventListener('pointercancel', () => { drawing = false; });