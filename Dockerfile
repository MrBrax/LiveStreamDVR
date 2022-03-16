FROM node:17-alpine3.15
USER root

# system packages
RUN apk --no-cache add \
    gcc g++ libc-dev git \
    ca-certificates \
    composer \
    python3 py3-pip py3-wheel \
    ffmpeg mediainfo \
    util-linux busybox-initscripts procps gcompat \
    libxml2-dev libxslt-dev python3-dev \
    bash icu-libs krb5-libs libgcc libintl libssl1.1 libstdc++ zlib fontconfig

# install yarn
# RUN npm install -g yarn
    
# libfontconfig1 can't be found

# pip packages
COPY ./requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt

# copy app
RUN mkdir -p /usr/local/share/twitchautomator
COPY . /usr/local/share/twitchautomator/
# RUN git clone https://github.com/MrBrax/TwitchAutomator /var/www/twitchautomator/

# server
RUN cd /usr/local/share/twitchautomator/server && yarn install && yarn build

# client
RUN cd /usr/local/share/twitchautomator/client-vue && yarn install && yarn build

# install chat dumper dependencies, test
RUN cd /usr/local/share/twitchautomator/twitch-chat-dumper && yarn install

# install dotnet for twitchdownloader
# ADD https://dot.net/v1/dotnet-install.sh /tmp/dotnet-install.sh
# RUN chmod +x /tmp/dotnet-install.sh && /tmp/dotnet-install.sh --channel 3.1 --verbose --install-dir /usr/share/dotnet
# --runtime dotnet

# download twitchdownloader, is this legal? lmao
COPY ./docker/fetch-tdl.sh /tmp/fetch-tdl.sh
RUN sh /tmp/fetch-tdl.sh
ENV TCD_TWITCHDOWNLOADER_PATH=/usr/local/bin/TwitchDownloaderCLI


# src perms
RUN chown -R nobody:nobody /usr/local/share/twitchautomator && chmod -R 775 /usr/local/share/twitchautomator

# make home folder
RUN mkdir -p /home/nobody && chown -R nobody:nobody /home/nobody
ENV HOME /home/nobody

# fonts
RUN mkdir /home/nobody/.fonts && chown nobody:nobody /home/nobody/.fonts
COPY ./docker/fonts /home/nobody/.fonts

# get certs
RUN wget https://curl.haxx.se/ca/cacert.pem -O /tmp/cacert.pem

# twitchautomator docker specific configs
ENV TCD_BIN_DIR=/usr/bin
ENV TCD_FFMPEG_PATH=/usr/bin/ffmpeg
ENV TCD_MEDIAINFO_PATH=/usr/bin/mediainfo
ENV TCD_DOCKER=1
ENV TCD_WEBSOCKET_ENABLED=1
ENV TCD_CA_PATH=/tmp/cacert.pem

USER nobody
WORKDIR /usr/local/share/twitchautomator

ENTRYPOINT [ "yarn start" ]