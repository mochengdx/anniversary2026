const fs = require('fs');
let content = fs.readFileSync('apps/screen-electron/src/components/LotteryMarsStage.tsx', 'utf-8');

const matches = [
  { old: 'config.modelUrl', new: 'localConfig.modelUrl' },
  { old: 'config.radius', new: 'localConfig.radius' },
  { old: 'config.displayCount', new: 'localConfig.displayCount' },
  { old: 'config.replaceInterval', new: 'localConfig.replaceInterval' },
  { old: 'config.bgmUrl', new: 'localConfig.bgmUrl' }
];

matches.forEach(m => {
  content = content.split(m.old).join(m.new);
});

fs.writeFileSync('apps/screen-electron/src/components/LotteryMarsStage.tsx', content);
console.log('done configs replace');
