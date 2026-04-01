const fs = require('fs');
// It's a gltf file, which is uncompressed JSON if it's .gltf
// we can just read it and parse JSON.
const data = fs.readFileSync('public/whale.gltf', 'utf8');
const gltf = JSON.parse(data);
console.log(gltf.animations[0].channels.map(c => c.target.node));
console.log(gltf.nodes[gltf.animations[0].channels[0].target.node]);
