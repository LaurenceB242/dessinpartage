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

// affichage d'un point aux détection du clic

// METTRE LA BONNE TAILLE POUR LE POINT ET LE TRACER RENDRE PLUS UNIFORME
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
let tool = 'pencil';
const colorInput = document.getElementById('color');
const sizeInput = document.getElementById('size');

const TOOLS = {
  pencil: { mult: 0.5, alpha: 1 },
  brush:  { mult: 2,   alpha: 0.85 },
  eraser: { mult: 3,   alpha: 1 },
};

document.querySelectorAll('[data-tool]').forEach((btn) => {
  btn.addEventListener('click', () => {
    tool = btn.dataset.tool;
    document.querySelectorAll('[data-tool]').forEach((b) =>
      b.classList.toggle('active', b === btn)
    );
  });
});

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
  ctx.lineWidth = 1;
  ctx.lineCap = "round";
  ctx.strokeStyle = "blue"
  last = p;
});

canvas.addEventListener('pointerup', () => { drawing = false; });
canvas.addEventListener('pointercancel', () => { drawing = false; });