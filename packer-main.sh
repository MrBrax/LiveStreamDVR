#!/bin/bash
set set -euxo pipefail # exit with nonzero exit code if anything fails

client_version=$(cat ./client-vue/package.json | jq -r '.version')
server_version=$(cat ./server/package.json | jq -r '.version')
dumper_version=$(cat ./twitch-chat-dumper/package.json | jq -r '.version')
vodchat_version=$(cat ./twitch-vod-chat/package.json | jq -r '.version')

echo "Client version: $client_version"
echo "Server version: $server_version"
echo "twitch-chat-dumper version: $dumper_version"
echo "twitch-vod-chat version: $vodchat_version"

prerelease=false
if [[ "$@" == *"--prerelease"* ]]; then
    prerelease=true
fi

# simple iso date string without time
date_string=$(date -u +"%Y-%m-%d")

release_name="LiveStreamDVR-${date_string}-c${client_version}-s${server_version}-d${dumper_version}-v${vodchat_version}"
if [ "$prerelease" = true ]; then
    release_name="${release_name}-alpha"
fi

if [ -f "./release/${release_name}.zip" ]; then
    rm "./release/${release_name}.zip"
fi

echo "Release name: $release_name"
echo "Building..."

# build twitch-vod-chat
cd twitch-vod-chat && yarn install && yarn run buildlib && cd ..

echo "twitch-vod-chat built"

# build client
cd client-vue && yarn install && yarn run build && cd ..

echo "Client built"

# build server
cd server && yarn install && yarn run build && cd ..

echo "Server built"

# build twitch-chat-dumper
cd twitch-chat-dumper && yarn install && yarn run build && cd ..

echo "twitch-chat-dumper built"

# package files
7za a -tzip -xr!node_modules "./release/${release_name}.zip" \
    "client-vue/dist" \
    "client-vue/package.json" \
    "server/build" \
    "server/package.json" \
    "server/tsconfig.json" \
    "twitch-chat-dumper/build" \
    "start.bat" \
    "start.sh" \
    "requirements.txt" \
    "binaries.txt" \
    "Pipfile" \
    "Pipfile.lock" \
    "README.md" \
    "LICENSE"

echo "Files packaged"

# output metadata
echo "{\"client_version\":\"$client_version\",\"server_version\":\"$server_version\",\"dumper_version\":\"$dumper_version\",\"vodchat_version\":\"$vodchat_version\",\"release_name\":\"$release_name\"}" > "./release/${release_name}.json"

echo "$release_name" > "./release_name.txt"

echo -e "This release was created automatically by the build script.\n\nIt includes the following versions:\n\n* Client: $client_version\n* Server: $server_version\n* twitch-chat-dumper: $dumper_version\n* twitch-vod-chat: $vodchat_version\n\n## Changelog\n\n" > "./release_notes.md"

# upload to github
if [ "$prerelease" = true ]; then
    gh release create ${release_name} \
    "./release/${release_name}.zip" \
    -t "${release_name}" \
    --notes-file "./release_notes.md" \
    --prerelease \
    -R "mrbrax/LiveStreamDVR" \
    --draft
else
    gh release create ${release_name} \
    "./release/${release_name}.zip" \
    -t "${release_name}" \
    --notes-file "./release_notes.md" \
    -R "mrbrax/LiveStreamDVR" \
    --draft
fi

echo "Release created"