const util = require("util");
const fs = require("fs");
const exec = util.promisify(require("child_process").exec);
const client_version = require("./client-vue/package.json").version;
const server_version = require("./server/package.json").version;

console.log(`Client version: ${client_version}`);
console.log(`Server version: ${server_version}`);

const release_name = `TwitchAutomator-s${server_version}-c${client_version}`;

if (fs.existsSync(`./release/${release_name}.zip`)) {
    fs.unlinkSync(`./release/${release_name}.zip`);
}

// build client
exec('cd client-vue && yarn install && yarn run build').then(() => {
    console.log("Client built");
    
    // build server
    exec('cd server && yarn install && yarn run build').then(() => {
        console.log("Server built");

        // package files
        exec(
            `7za a -tzip -xr!node_modules ./release/${release_name}.zip ` +
            `client-vue/dist ` + 
            `client-vue/package.json ` +
            `server/build ` + 
            `server/package.json ` +
            `server/tsconfig.json ` + 
            `requirements.txt ` + 
            `Pipfile ` + 
            `Pipfile.lock ` + 
            `vodplayer ` + 
            `twitch-chat-dumper ` +
            `README.md ` +
            `LICENSE `
        ).then(() => {
            console.log("Files packaged");
        });
    });
});