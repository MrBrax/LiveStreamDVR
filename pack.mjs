import util from "node:util";
import fs from "node:fs";
import exec from "node:child_process";
const client_version = JSON.parse(fs.readFileSync("./client-vue/package.json")).version;
const server_version = JSON.parse(fs.readFileSync("./server/package.json")).version;
const dumper_version = JSON.parse(fs.readFileSync("./twitch-chat-dumper/package.json")).version;
const vodchat_version = JSON.parse(fs.readFileSync("./twitch-vod-chat/package.json")).version;

const pexec = util.promisify(exec.exec);

console.log(`Client version: ${client_version}`);
console.log(`Server version: ${server_version}`);
console.log(`twitch-chat-dumper version: ${dumper_version}`);
console.log(`twitch-vod-chat version: ${vodchat_version}`);

// simple iso date string without time
const date_string = new Date().toISOString().split('T')[0];

const release_name = `LiveStreamDVR-${date_string}-c${client_version}-s${server_version}-d${dumper_version}-v${vodchat_version}`;

if (fs.existsSync(`./release/${release_name}.zip`)) {
    fs.unlinkSync(`./release/${release_name}.zip`);
}

console.log(`Release name: ${release_name}`);
console.log("Building...");

// build twitch-vod-chat
await pexec('cd twitch-vod-chat && yarn install && yarn run buildlib');
console.log("twitch-vod-chat built");

// build client
await pexec('cd client-vue && yarn install && yarn run build');
console.log("Client built");

// build server
await pexec('cd server && yarn install && yarn run build');
console.log("Server built");

// build twitch-chat-dumper
await pexec('cd twitch-chat-dumper && yarn install && yarn run build');
console.log("twitch-chat-dumper built");

// package files
await pexec(
    `7za a -tzip -xr!node_modules ./release/${release_name}.zip ` +
    `client-vue/dist ` + 
    `client-vue/package.json ` +
    `server/build ` + 
    `server/package.json ` +
    `server/tsconfig.json ` + 
    `twitch-chat-dumper/build ` +
    // `twitch-vod-chat/dist ` +
    `start.bat ` +
    `start.sh ` +
    `requirements.txt ` + 
    `binaries.txt ` +
    `Pipfile ` + 
    `Pipfile.lock ` + 
    `README.md ` +
    `LICENSE `
);

console.log("Files packaged");

// output metadata
fs.writeFileSync(
    `./release/${release_name}.json`,
    JSON.stringify({
        client_version,
        server_version,
        dumper_version,
        vodchat_version,
        release_name
    })
);

fs.writeFileSync(
    `./release_name.txt`,
    release_name
);

fs.writeFileSync(
    `./release_notes.md`,
    `This release was created automatically by the build script.\n\n` +
    `It includes the following versions:\n\n` +
    `* Client: ${client_version}\n` +
    `* Server: ${server_version}\n` +
    `* twitch-chat-dumper: ${dumper_version}\n` +
    `* twitch-vod-chat: ${vodchat_version}\n\n` +
    `## Changelog\n\n` +
    `TODO: make better commit messages so this can be generated automatically\n\n`
);

console.log("Metadata written");

// upload to github
await pexec(
    `gh release create ${release_name} ` +
    `./release/${release_name}.zip ` +
    `-t "${release_name}" ` + // title
    // `-n "${release_name}" ` + // description
    // `--generate-notes ` + // TODO: generate release notes automatically
    `--notes-file ./release_notes.md ` +
    (process.argv.includes("--prerelease") ? "--prerelease " : "") +
    `-R "mrbrax/LiveStreamDVR" ` +
    `--draft`
);

console.log("Release created");
