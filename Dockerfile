FROM node:20-alpine
RUN apk add --no-cache ffmpeg curl unzip python3 && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp
WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY site.zip ./
RUN unzip -o site.zip -d public && rm site.zip
ENV PORT=7860
EXPOSE 7860
CMD ["node","server.js"]
