const fs = require('fs');
const data = fs.readFileSync('public/whale.gltf', 'utf8');
const gltf = JSON.parse(data);

const jon1NodeIndex = gltf.nodes.findIndex(n => n.name === 'jon1');
const ani = gltf.animations[0];
const jon1TranslationChannel = ani.channels.find(c => c.target.node === jon1NodeIndex && c.target.path === 'translation');
const sampler = ani.samplers[jon1TranslationChannel.sampler];
const accessor = gltf.accessors[sampler.output];
console.log("accessor:", accessor);
