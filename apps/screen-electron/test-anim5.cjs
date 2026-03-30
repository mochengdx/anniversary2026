const fs = require('fs');
const data = fs.readFileSync('public/whale.gltf', 'utf8');
const gltf = JSON.parse(data);

const jon1NodeIndex = gltf.nodes.findIndex(n => n.name === 'jon1');
console.log("jon1 index:", jon1NodeIndex);
gltf.nodes.forEach((n, i) => {
  if (n.children && n.children.includes(jon1NodeIndex)) {
    console.log("jon1 parent:", i, n.name);
  }
});

const meshNodes = gltf.nodes.map((n, i) => n.mesh !== undefined ? {i, name: n.name, mesh: n.mesh} : null).filter(Boolean);
console.log("Meshes:", meshNodes);

