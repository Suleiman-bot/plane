FROM node:22-alpine

WORKDIR /plane/api

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8000

CMD ["node", "server.js"]
