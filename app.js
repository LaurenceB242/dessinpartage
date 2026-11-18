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

// Rectangle de test
ctx.fillStyle = 'red';
ctx.fillRect(20, 20, 100, 100);