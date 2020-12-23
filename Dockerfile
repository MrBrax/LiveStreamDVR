FROM erseco/alpine-php7-webserver:edge
USER root

# system packages
RUN apk --no-cache add gcc libc-dev git \
    python3 py3-pip composer ffmpeg mediainfo \
    util-linux busybox-initscripts procps gcompat

# pip packages
RUN pip install streamlink youtube-dl tcd

# supercronic
# ENV SUPERCRONIC_URL=https://github.com/aptible/supercronic/releases/download/v0.1.12/supercronic-linux-amd64 \
#     SUPERCRONIC=supercronic-linux-amd64 \
#     SUPERCRONIC_SHA1SUM=048b95b48b708983effb2e5c935a1ef8483d9e3e
# 
# RUN curl -fsSLO "$SUPERCRONIC_URL" \
#  && echo "${SUPERCRONIC_SHA1SUM}  ${SUPERCRONIC}" | sha1sum -c - \
#  && chmod +x "$SUPERCRONIC" \
#  && mv "$SUPERCRONIC" "/usr/local/bin/${SUPERCRONIC}" \
#  && ln -s "/usr/local/bin/${SUPERCRONIC}" /usr/local/bin/supercronic

# copy app
RUN mkdir -p /var/www/twitchautomator
COPY . /var/www/twitchautomator/
# RUN git clone https://github.com/MrBrax/TwitchAutomator /var/www/twitchautomator/

# composer
COPY ./docker/memory_limit.ini /etc/php7/conf.d/memory_limit.ini
ENV COMPOSER_MEMORY_LIMIT=256M
ENV MEMORY_LIMIT=256M
ENV PHP_MEMORY_LIMIT=256M
ENV PHP7_MEMORY_LIMIT=256M
RUN cd /var/www/twitchautomator/ && composer install --optimize-autoloader --no-interaction --no-dev
# RUN cd /var/www/twitchautomator/ && npm install # nodejs

# install dotnet for twitchdownloader
# ADD https://dot.net/v1/dotnet-install.sh /tmp/dotnet-install.sh
# RUN chmod +x /tmp/dotnet-install.sh && /tmp/dotnet-install.sh --channel 3.1 --verbose --install-dir /usr/share/dotnet
# --runtime dotnet

# download twitchdownloader, is this legal? lmao
RUN sh /var/www/twitchautomator/src/Utilities/fetch-tdl.sh
ENV TCD_TWITCHDOWNLOADER_PATH=/usr/local/bin/TwitchDownloaderCLI

# src perms
RUN chown -R nobody:nobody /var/www/twitchautomator && chmod -R 775 /var/www/twitchautomator

# nginx config
COPY ./docker/nginx.conf /etc/nginx/nginx.conf

# make home folder
RUN mkdir -p /home/nobody && chown -R nobody:nobody /home/nobody
ENV HOME /home/nobody

# twitchautomator docker specific configs
ENV TCD_BIN_DIR=/usr/bin
ENV TCD_FFMPEG_PATH=/usr/bin/ffmpeg
ENV TCD_MEDIAINFO_PATH=/usr/bin/mediainfo
ENV TCD_DOCKER=1

USER nobody
WORKDIR /var/www/twitchautomator

# cron, no support in alpine
# COPY ./docker/crontab /etc/crontab
# COPY ./docker/crontab /etc/crontabs/nobody
# COPY ./docker/crontab /etc/crontabs/root

# COPY ./config/cron.txt /etc/crontabs/nobody
# RUN chown nobody:nobody /etc/crontabs/nobody && chmod 775 /etc/crontabs/nobody
# RUN echo "* * * * * echo \"Crontab is working - watchdog 1\"" > /etc/crontabs/test
# CMD ["exec", "crond", "-f", "-l", "2"]

# RUN /usr/bin/crontab /var/www/twitchautomator/config/cron.txt
# CMD ["/var/www/twitchautomator/docker/entry.sh"]
# ENTRYPOINT ["/var/www/twitchautomator/docker/entry.sh"]

# RUN composer install \
#   --optimize-autoloader \
#   --no-interaction \
#   --no-progress
# 
# RUN
