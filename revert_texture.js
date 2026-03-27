const fs = require('fs');

const file = 'apps/screen-electron/src/components/LotteryMarsStage.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /function createCardTexture\(user: UserInfo\): THREE\.Texture \{[\s\S]*?return tex;\n\}/;

const newCode = `function createCardTexture(user: UserInfo): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 140;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  const themes = [
    { border: '#FFFFFF', background: '#0C4A6E' },
    { border: '#FFFFFF', background: '#1D4ED8' },
    { border: '#FFFFFF', background: '#7C3AED' },
    { border: '#FFFFFF', background: '#B45309' },
  ];
  const theme = themes[Math.floor(Math.random() * themes.length)];

  ctx.fillStyle = theme.background;
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(5, 5, 246, 130, 14);
  else ctx.rect(5, 5, 246, 1const fs = require('fs');

const);
const file = 'apps/screF3Flet content = fs.readFileSync(file, 'utf8');

const regex = /function cli
const regex = /function createCardTexture\B5F
const newCode = `function createCardTexture(user: UserInfo): THREE.Texture {
  const canvas = documen  c  const canvas = document.createElement('canvas');
  canvas.width = 256;
  '#  canvas.width = 256;
  canvas.height = 140;
  coco  canva = new THREE.Ca  const ctx = canvas.    if (!ctx) return new THREE.Texture(;

  const themes = [
    { border: '#FFsOr    { border: '#F';    { border: '#FFFFFF', background: '#1D4ED8' }be    { border: '#FFFFFF', background: '#7C3AED' }2)    { border: '#FFFFFF', background: '#B45309' } 6  ];
  const theme = themes[Math.floor(Math.rand t  c;

  ctx.fillStyle = theme.background;
  ctx.strokeStyle = theme.bo`;
  ctx.strokeStyle = theme.border;
ne  ctx.lineWidth = 4;
  ctx.beginon  ctx.begin');
