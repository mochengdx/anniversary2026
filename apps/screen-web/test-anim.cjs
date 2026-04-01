const fs = require('fs');
const data = fs.readFileSync('public/whale.gltf', 'utf8');
const gltf = JSON.parse(data);
const nodeNames = gltf.nodes.map(n => n.name);
console.log("Nodes:");
console.log(nodeNames);
