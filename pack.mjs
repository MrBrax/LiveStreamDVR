import util from "util";
import fs from "fs";
import exec from "child_process";
const client_version = JSON.parse(fs.readFileSync("./client-vue/package.json")).version;
const server_version = JSON.parse(fs.readFileSync("./server/package.json")).version;

const pexec = util.promisify(exec.exec);

console.log(`Client version: ${client_version}`);
console.log(`Server version: ${server_version}`);

const release_name = `LiveStreamDVR-s${server_version}-c${client_version}`;

if (fs.existsSync(`./release/${release_name}.zip`)) {
    fs.unlinkSync(`./release/${release_name}.zip`);
}

// build client
await pexec('cd client-vue && yarn install && yarn run build');
console.log("Client built");
    
// build server
await pexec('cd server && yarn install && yarn run build');
console.log("Server built");

// build twitch-chat-dumper
await pexec('cd twitch-chat-dumper && yarn install && yarn run build');
console.log("twitch-chat-dumper built");

// build twitch-vod-chat
await pexec('cd twitch-vod-chat && yarn install && yarn run build --base=/vodplayer');
console.log("twitch-vod-chat built");

// package files
await pexec(
    `7za a -tzip -xr!node_modules ./release/${release_name}.zip ` +
    `client-vue/dist ` + 
    `client-vue/package.json ` +
    `server/build ` + 
    `server/package.json ` +
    `server/tsconfig.json ` + 
    `twitch-chat-dumper/build ` +
    `twitch-vod-chat/dist ` +
    `requirements.txt ` + 
    `Pipfile ` + 
    `Pipfile.lock ` + 
    `README.md ` +
    `LICENSE `
);

console.log("Files packaged");
