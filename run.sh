#!/bin/bash

cd /root/timestamperino-kripperino/

node_modules/youtube-dl-exec/bin/yt-dlp -U

/root/.bun/bin/bun run src/index.ts
