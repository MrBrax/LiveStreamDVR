cd /tmp/
curl -fsSLO https://github.com/lay295/TwitchDownloader/releases/download/1.40.4/TwitchDownloaderCLI-LinuxAlpine-x64.zip
unzip TwitchDownloaderCLI-LinuxAlpine-x64.zip
mv TwitchDownloaderCLI /usr/local/bin/TwitchDownloaderCLI
chmod +x /usr/local/bin/TwitchDownloaderCLI
export TCD_TWITCHDOWNLOADER_PATH=/usr/local/bin/TwitchDownloaderCLI
