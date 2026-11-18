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

document.getElementById('clear').addEventListener('click', () => {
    void ctx.clearRect(0, 0, canvas.width, canvas.height);
});

function drawSegment(from, to) {
  const t = TOOLS[tool];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = t.alpha;
  ctx.lineWidth = sizeInput.value * t.mult;
  ctx.strokeStyle = colorInput.value;
  ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

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
  drawSegment(last, last); // un simple clic laisse un point
});

canvas.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  const p = getPos(e);
  drawSegment(last, p);
  last = p;
});

canvas.addEventListener('pointerup', () => { drawing = false; });
canvas.addEventListener('pointercancel', () => { drawing = false; });