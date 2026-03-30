const fs = require('fs');
const data = fs.readFileSync('public/whale.gltf', 'utf8');
const gltf = JSON.parse(data);

const jon1NodeIndex = gltf.nodes.findIndex(n => n.name === 'jon1');
const ani = gltf.animations[0];
const tracks = ani.channels.filter(c => c.target.node === jon1NodeIndex).map(c => c.target.path);
console.log("jon1 tracks:", tracks);

const group1joinIndex = gltf.nodes.findIndex(n => n.name === 'group1join');
const group1joinTracks = ani.channels.filter(c => c.target.node === group1joinIndex).map(c => c.target.path);
console.log("group1join tracks:", group1joinTracks);
