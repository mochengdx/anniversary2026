const fs = require('fs');
const data = fs.readFileSync('public/whale.gltf', 'utf8');
const gltf = JSON.parse(data);
const jon1NodeIndex = gltf.nodes.findIndex(n => n.name === 'jon1');
console.log("jon1 node:", gltf.nodes[jon1NodeIndex]);

const ani = gltf.animations?.[0];
if(ani){
  const jon1Channels = ani.channels.filter(c => c.target.node === jon1NodeIndex);
  console.log("jon1 channels:", jon1Channels.map(c => c.target.path));
}
