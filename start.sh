#!/bin/bash
if [ ! -f tools/yt-dlp ]; then mkdir -p tools && curl -L -o tools/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp && chmod +x tools/yt-dlp; fi
export PATH="$PWD/tools:$PATH"
exec node server.js
