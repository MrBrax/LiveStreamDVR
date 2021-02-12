FROM alpine:3.7
RUN apk --no-cache add nodejs yarn
COPY . /var/broker
WORKDIR /var/broker
RUN yarn install
ENTRYPOINT [ "yarn", "start" ]