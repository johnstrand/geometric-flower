const svg = document.querySelector('#figure');
const art = document.querySelector('#figure-art');

const controls = {
  generations: document.querySelector('#generations'),
  arcs: document.querySelector('#arcs'),
  height: document.querySelector('#height'),
  arcHeight: document.querySelector('#arc-height'),
  scale: document.querySelector('#scale'),
  lineThickness: document.querySelector('#line-thickness'),
};

const outputs = {
  generations: document.querySelector('#generations-value'),
  arcs: document.querySelector('#arcs-value'),
  height: document.querySelector('#height-value'),
  arcHeight: document.querySelector('#arc-height-value'),
  scale: document.querySelector('#scale-value'),
  lineThickness: document.querySelector('#line-thickness-value'),
};

const randomizeButton = document.querySelector('#randomize');
const seedValue = document.querySelector('#seed-value');
const fillArcs = document.querySelector('#fill-arcs');
const paletteSelect = document.querySelector('#palette');

const palettes = {
  moonflower: ['#ef795e', '#80aebb', '#d7a36e', '#8296b2', '#db806d', '#73a6a7', '#d6a167', '#cf799e'],
  'sunset-caravan': ['#ef795e', '#e2ac62', '#d66f73', '#9a6b89', '#6e9ea5', '#f1c184', '#bb6570', '#e18459'],
  'moss-mercury': ['#718c68', '#d1a84f', '#b8705e', '#779b93', '#9581a2', '#d7c383', '#55796d', '#a6a25d'],
  'electric-meadow': ['#d95778', '#ed9956', '#6e9fca', '#9581c5', '#86a95a', '#d2c84f', '#5e9f9b', '#c66ba7'],
  'desert-daydream': ['#c86f5b', '#e0a45d', '#d5c083', '#6d9994', '#7c779f', '#b87970', '#e8c99c', '#9d6c78'],
};
const NS = 'http://www.w3.org/2000/svg';

let currentSeed = null;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randomStep(random, control) {
  const min = Number(control.min);
  const max = Number(control.max);
  const step = Number(control.step);
  const steps = Math.round((max - min) / step);
  return (min + randomInt(random, 0, steps) * step).toFixed(step < 1 ? 1 : 0);
}

function setSeed(seed) {
  currentSeed = seed >>> 0;
  seedValue.textContent = currentSeed.toString(16).padStart(8, '0');
  history.replaceState(null, '', `#seed=${currentSeed}`);
}

function applySeed(seed) {
  const random = seededRandom(seed);
  controls.generations.value = randomStep(random, controls.generations);
  controls.arcs.value = randomStep(random, controls.arcs);
  controls.height.value = randomStep(random, controls.height);
  controls.arcHeight.value = randomStep(random, controls.arcHeight);
  controls.scale.value = randomStep(random, controls.scale);
  controls.lineThickness.value = randomStep(random, controls.lineThickness);
  fillArcs.checked = random() > 0.5;
  paletteSelect.selectedIndex = randomInt(random, 0, paletteSelect.options.length - 1);
  setSeed(seed);
  Object.keys(controls).forEach(updateControl);
  draw();
}

function readSeedFromHash() {
  const match = window.location.hash.match(/^#seed=(\d+)$/i);
  return match ? Number(match[1]) >>> 0 : null;
}

function newSeed() {
  if (window.crypto?.getRandomValues) {
    return window.crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 4294967296);
}

function pointOnCircle(cx, cy, radius, angle) {
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, angle, radius };
}

function makePath(start, end, apex) {
  // A quadratic's control point is placed so its midpoint lands exactly on the apex.
  const control = {
    x: apex.x * 2 - (start.x + end.x) / 2,
    y: apex.y * 2 - (start.y + end.y) / 2,
  };
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} Q ${control.x.toFixed(2)} ${control.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function addElement(type, attributes, parent = art) {
  const element = document.createElementNS(NS, type);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  parent.appendChild(element);
  return element;
}

function makeArc(start, end, apex, layer, index, total, lineThickness, shouldFill, colors) {
  const color = colors[(layer - 1) % colors.length];
  const opacity = Math.max(0.39, 0.94 - layer * 0.065);
  const path = addElement('path', {
    d: `${makePath(start, end, apex)}${shouldFill ? ' Z' : ''}`,
    stroke: color,
    'stroke-width': lineThickness,
    'stroke-linecap': 'round',
    fill: shouldFill ? color : 'none',
    'fill-opacity': shouldFill ? Math.max(0.08, opacity * 0.32) : 0,
    opacity,
    class: 'growth-arc',
    style: `--arc-delay: ${index * 0.035 + layer * 0.08}s; --arc-opacity: ${opacity}`,
  });
  path.setAttribute('vector-effect', 'non-scaling-stroke');

  // Tiny apex markers make the hand-off between generations visible without cluttering it.
  if (layer < 4 || total < 8) {
    addElement('circle', { cx: apex.x, cy: apex.y, r: layer === 2 ? 2.8 : 1.7, fill: color, opacity: 0.9 });
  }
}

function draw() {
  const generationCount = Number(controls.generations.value);
  const arcCount = Number(controls.arcs.value);
  const height = Number(controls.height.value);
  const arcHeight = Number(controls.arcHeight.value);
  const scale = Number(controls.scale.value);
  const lineThickness = Number(controls.lineThickness.value);
  const shouldFill = fillArcs.checked;
  const colors = palettes[paletteSelect.value];
  const seedRadius = height / 2;
  const arcRise = arcHeight;
  let outerRadius = seedRadius;
  let currentRise = arcRise;
  for (let layer = 2; layer <= generationCount + 1; layer += 1) {
    outerRadius += currentRise;
    currentRise *= scale;
  }
  const viewSize = Math.max(520, outerRadius * 2 + 100);
  const centerOffset = viewSize / 2;
  const angleOffset = -Math.PI / 2;

  art.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${viewSize} ${viewSize}`);

  const glow = addElement('circle', {
    cx: centerOffset,
    cy: centerOffset,
    r: seedRadius + 4,
    fill: 'none',
    stroke: '#ef795e',
    'stroke-width': 14,
    opacity: 0.11,
    filter: 'url(#soft-glow)',
  });
  glow.classList.add('seed-glow');
  addElement('circle', {
    cx: centerOffset,
    cy: centerOffset,
    r: seedRadius,
    fill: 'url(#seed-fill)',
    'fill-opacity': 0.12,
    stroke: '#f2b78e',
    'stroke-width': 2.8,
    'stroke-dasharray': '1 9',
    'stroke-linecap': 'round',
    class: 'seed-circle',
  });

  // The first ring divides the circle's complete circumference into continuous sections.
  let endpoints = Array.from({ length: arcCount }, (_, index) => {
    const angle = angleOffset + index * (Math.PI * 2 / arcCount);
    return pointOnCircle(centerOffset, centerOffset, seedRadius, angle);
  });

  let rise = arcRise;
  for (let layer = 2; layer <= generationCount + 1; layer += 1) {
    const nextApexes = [];
    endpoints.forEach((start, index) => {
      const end = endpoints[(index + 1) % endpoints.length];
      // Unwrap the closing segment from the final point back to the first point.
      // Later generations start at the previous ring's first apex, not angleOffset.
      const nextAngle = index === endpoints.length - 1 ? endpoints[0].angle + Math.PI * 2 : endpoints[index + 1].angle;
      const midAngle = (start.angle + nextAngle) / 2;
      const averageRadius = (start.radius + end.radius) / 2;
      const apex = pointOnCircle(centerOffset, centerOffset, averageRadius + rise, midAngle);
      makeArc(start, end, apex, layer, index, arcCount, lineThickness, shouldFill, colors);
      nextApexes.push(apex);
    });
    endpoints = nextApexes;
    rise *= scale;
  }

  addElement('circle', { cx: centerOffset, cy: centerOffset, r: 3.5, fill: '#f4eddf' });
  document.querySelector('#badge-generations').textContent = String(generationCount).padStart(2, '0');
  const fillLabel = shouldFill ? ' · filled' : '';
  document.querySelector('#coordinates').textContent = `${String(arcCount).padStart(2, '0')} × ${String(generationCount).padStart(2, '0')} · C${height} · A${arcHeight} · ${scale.toFixed(1)}x · T${lineThickness.toFixed(1)}${fillLabel}`;
}

function updateControl(controlName) {
  const control = controls[controlName];
  const value = Number(control.value);
  const min = Number(control.min);
  const max = Number(control.max);
  control.style.setProperty('--progress', `${((value - min) / (max - min)) * 100}%`);
  if (controlName === 'height' || controlName === 'arcHeight' || controlName === 'lineThickness') {
    outputs[controlName].firstChild.textContent = `${value} `;
  } else if (controlName === 'scale') {
    outputs[controlName].textContent = value.toFixed(1);
  } else {
    outputs[controlName].textContent = String(value);
  }
}

Object.keys(controls).forEach((name) => {
  updateControl(name);
  controls[name].addEventListener('input', () => {
    updateControl(name);
    draw();
  });
});

randomizeButton.addEventListener('click', () => applySeed(newSeed()));
fillArcs.addEventListener('change', draw);
paletteSelect.addEventListener('change', draw);

window.addEventListener('hashchange', () => {
  const hashSeed = readSeedFromHash();
  if (hashSeed !== null && hashSeed !== currentSeed) applySeed(hashSeed);
});

const hashSeed = readSeedFromHash();
if (hashSeed !== null) {
  applySeed(hashSeed);
} else {
  seedValue.textContent = '--------';
  draw();
}
