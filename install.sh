#!/bin/bash
set -euxo pipefail

# check for python installed
if ! command -v python &> /dev/null
then
    echo "python could not be found"
    exit
fi

# check for pip installed
if ! command -v pip &> /dev/null
then
    echo "pip could not be found"
    exit
fi

# check for pipenv installed
if ! command -v pipenv &> /dev/null
then
    echo "pipenv could not be found"
    exit
fi

# check for node installed
if ! command -v node &> /dev/null
then
    echo "node could not be found"
    exit
fi

# check for yarn installed
if ! command -v yarn &> /dev/null
then
    echo "yarn could not be found"
    exit
fi

# check for ffmpeg installed
if ! command -v ffmpeg &> /dev/null
then
    echo "ffmpeg could not be found"
    exit
fi

# install pipenv environment
pipenv install

# build server
cd server
yarn build

# build twitch-chat-dumper
cd ../twitch-chat-dumper
yarn build

# build twitch-vod-chat
cd ../twitch-vod-chat
yarn buildlib

# build client-vue
cd ../client-vue
yarn build
