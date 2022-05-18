FROM node:17-bullseye-slim
# USER root

# system packages
#RUN apk --no-cache add \
#    gcc g++ libc-dev git curl \
#    ca-certificates \
#    python3 py3-pip py3-wheel \
#    ffmpeg mediainfo \
#    util-linux busybox-initscripts procps gcompat \
#    libxml2-dev libxslt-dev python3-dev \
#    bash icu-libs krb5-libs libgcc libintl libssl1.1 libstdc++ zlib fontconfig

RUN apt-get update && apt-get install -y \
    python3 python3-pip \
    ffmpeg mediainfo \
    bash git curl unzip \
    && apt-get clean

# install yarn
# RUN npm install -g yarn
    
# libfontconfig1 can't be found

# pip packages
COPY ./requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt \
    && rm /tmp/requirements.txt \
    && pip cache purge

# copy app
RUN mkdir -p /usr/local/share/twitchautomator \
    && chown -R node:node /usr/local/share/twitchautomator \
    && chmod -R 775 /usr/local/share/twitchautomator
COPY --chown=node:node --chmod=775 . /usr/local/share/twitchautomator/
# RUN git clone https://github.com/MrBrax/TwitchAutomator /var/www/twitchautomator/

# server
RUN cd /usr/local/share/twitchautomator/server \
    && yarn install --frozen-lockfile \
    && yarn lint:ts \
    && yarn build \
    && rm -rf node_modules \
    && yarn cache clean --all

# client
RUN cd /usr/local/share/twitchautomator/client-vue \
    && yarn install --frozen-lockfile \
    && yarn build \
    && rm -rf node_modules \
    && yarn cache clean --all

# chat dumper
RUN cd /usr/local/share/twitchautomator/twitch-chat-dumper \
    && yarn install --frozen-lockfile \
    && yarn build \
    && rm -rf node_modules && yarn cache clean --all

# vod player
RUN cd /usr/local/share/twitchautomator/twitch-vod-chat \
    && yarn install --frozen-lockfile \
    && yarn build --base=/vodplayer \
    && rm -rf node_modules && yarn cache clean --all

# install dotnet for twitchdownloader
# ADD https://dot.net/v1/dotnet-install.sh /tmp/dotnet-install.sh
# RUN chmod +x /tmp/dotnet-install.sh && /tmp/dotnet-install.sh --channel 3.1 --verbose --install-dir /usr/share/dotnet
# --runtime dotnet

# download twitchdownloader, is this legal? lmao
COPY ./docker/fetch-tdl.sh /tmp/fetch-tdl.sh
RUN sh /tmp/fetch-tdl.sh
ENV TCD_TWITCHDOWNLOADER_PATH=/usr/local/bin/TwitchDownloaderCLI

# application folder permissions
# seems like docker does not support recursive chown in the copy command
# so this is a workaround, doubling the layer size unfortunately.
# it also takes a very long time on slow storage
# RUN chown -c -R node:node /usr/local/share/twitchautomator && chmod -R 775 /usr/local/share/twitchautomator
# RUN chown -c -R node:node /usr/local/share/twitchautomator/data && chmod -R 775 /usr/local/share/twitchautomator/data

# make home folder
RUN mkdir -p /home/node && chown -R node:node /home/node
ENV HOME /home/node

# fonts
RUN mkdir /home/node/.fonts && chown node:node /home/node/.fonts
COPY ./docker/fonts /home/node/.fonts

# get certs
# RUN wget https://curl.haxx.se/ca/cacert.pem -O /tmp/cacert.pem

# twitchautomator docker specific configs
ENV TCD_BIN_DIR=/usr/local/bin
ENV TCD_FFMPEG_PATH=/usr/bin/ffmpeg
ENV TCD_MEDIAINFO_PATH=/usr/bin/mediainfo
ENV TCD_NODE_PATH=/usr/local/bin/node
ENV TCD_DOCKER=1
ENV TCD_WEBSOCKET_ENABLED=1
# ENV TCD_CA_PATH=/tmp/cacert.pem
ENV TCD_SERVER_PORT=8080

# USER node
WORKDIR /usr/local/share/twitchautomator/server

ENTRYPOINT [ "yarn", "run", "start" ]
EXPOSE 8080