const fs = require('fs');

const files = fs.readdirSync('recordings').filter(f => f.endsWith('.ogg')).sort().reverse();
if (files.length === 0) {
    console.log("No files to check");
    process.exit(0);
}

const file = 'recordings/' + files[0];
console.log("Reading " + file);
const buf = fs.readFileSync(file);

console.log("First 200 bytes:");
console.log(buf.subarray(0, 200).toString('hex').match(/.{1,32}/g).join('\n'));

// check for Opus tags
let str = buf.subarray(0, 200).toString('ascii');
console.log("ASCII:", str.replace(/[^ -~]/g, '.'));
