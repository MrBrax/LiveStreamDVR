#!/bin/bash
#
# Copyright 2020 lay295
# Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
# The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
#
# https://github.com/lay295/TwitchDownloader

set -euxo pipefail

# set version
TD_VERSION="1.53.0";

# set arch, compatible with Linux-x64, LinuxArm, and LinuxArm64
if [ "$(uname -m)" = "x86_64" ]; then
    TD_ARCH="Linux-x64"
elif [ "$(uname -m)" = "aarch64" ]; then
    TD_ARCH="LinuxArm64"
elif [ "$(uname -m)" = "armv7l" ]; then
    TD_ARCH="LinuxArm"
else
    echo "Unsupported architecture"
    exit
fi

# set archive name
TD_ARCHIVE="TwitchDownloaderCLI-${TD_VERSION}-${TD_ARCH}.zip"

# change directory
cd /tmp/

# download
curl -fsSLO https://github.com/lay295/TwitchDownloader/releases/download/${TD_VERSION}/${TD_ARCHIVE}

# unzip
unzip ${TD_ARCHIVE}

# move to bin
mv TwitchDownloaderCLI /usr/local/bin/TwitchDownloaderCLI

# set permission
chmod +x /usr/local/bin/TwitchDownloaderCLI

# clean up
rm -rf /tmp/${TD_ARCHIVE}

# create doc directory, maybe use local instead of share?
mkdir -p /usr/share/doc/twitchdownloader

# download readme and copyright (license)
curl -fsSL https://raw.githubusercontent.com/lay295/TwitchDownloader/master/README.md -o /usr/share/doc/twitchdownloader/README.md
curl -fsSL https://raw.githubusercontent.com/lay295/TwitchDownloader/master/LICENSE.txt -o /usr/share/doc/twitchdownloader/copyright

# check if TwitchDownloaderCLI is installed, if not, exit with error
if ! command -v TwitchDownloaderCLI &> /dev/null
then
    echo "TwitchDownloaderCLI could not be found"
    exit
fi

# set env
export TCD_TWITCHDOWNLOADER_PATH=/usr/local/bin/TwitchDownloaderCLI
