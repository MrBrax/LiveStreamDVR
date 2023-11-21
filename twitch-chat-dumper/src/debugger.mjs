import fs from 'fs';

const f = fs.readFileSync(process.argv[2], 'utf8');
const json = JSON.parse(f);

const index = process.argv[3] || 0;

const comment = json.comments[index];

console.log(JSON.stringify(comment, null, 4));
