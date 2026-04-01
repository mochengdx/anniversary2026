const fs = require('fs');
const data = fs.readFileSync('public/whale.gltf', 'utf8');
const gltf = JSON.parse(data);

console.log("Root scene nodes:", gltf.scenes[0].nodes);
gltf.nodes.forEach((n, i) => {
  if (n.children) {
    console.log(`Node ${i} (${n.name}) children:`, n.children);
  }
});
