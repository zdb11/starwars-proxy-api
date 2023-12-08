FROM node:20.10.0-alpine3.18 as build

# Set the working directory in the container
WORKDIR /usr/src/app

COPY ./src ./src
COPY package.json ./
COPY tsconfig.json ./

RUN npm install
RUN npx tsc

FROM node:20.10.0-alpine3.18

WORKDIR /usr/src/app
COPY package.json ./
RUN npm install --omit=dev

COPY --from=build /usr/src/app/build build
COPY .env ./
EXPOSE 3000

CMD ["npm", "run", "server"]
