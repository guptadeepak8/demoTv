
FROM node:18-slim 


RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/* # Clean up apt cache to keep image small


WORKDIR /app


COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build 


EXPOSE 4001


CMD ["node", "dist/index.js"] 