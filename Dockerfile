FROM node:10

WORKDIR /app
COPY . /app

COPY .env.example /app/.env

RUN yarn install --silent \
    && yarn run compile

COPY .compiled /.compiled