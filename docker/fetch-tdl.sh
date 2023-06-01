#!/bin/bash
#
# Copyright 2020 lay295
# Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
# The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
#
# https://github.com/lay295/TwitchDownloader

set -euxo pipefail
TD_VERSION=1.52.8
cd /tmp/
curl -fsSLO https://github.com/lay295/TwitchDownloader/releases/download/${TD_VERSION}/TwitchDownloaderCLI-${TD_VERSION}-Linux-x64.zip
unzip TwitchDownloaderCLI-${TD_VERSION}-Linux-x64.zip
mv TwitchDownloaderCLI /usr/local/bin/TwitchDownloaderCLI
chmod +x /usr/local/bin/TwitchDownloaderCLI
rm -rf /tmp/TwitchDownloaderCLI-${TD_VERSION}-Linux-x64.zip
export TCD_TWITCHDOWNLOADER_PATH=/usr/local/bin/TwitchDownloaderCLI
