# Deploy

Documentation around how this app is deployed to an nginx server.

The app is scoped to `/play/` after the domain in the URL.

A second checkout, `mudslinger_builders`, serves the Builders MUD port at
`/coding/play/` simultaneously — separate checkout because each build's
`.env` bakes in a different `VITE_MUD_URL`/`VITE_MUD_NAME`/`VITE_BASE_PATH`
and overwrites `static/public/` (`emptyOutDir: true`), so one checkout can't
hold both builds' output at once. See `README.md` for the env vars.

`/home/mud/mudslinger/.env`:
```
VITE_MUD_URL=ws://localhost:10002
VITE_MUD_NAME=Merentha
```

`/home/mud/mudslinger_builders/.env`:
```
VITE_MUD_URL=ws://localhost:<builders-port>
VITE_MUD_NAME=Merentha Builders
VITE_BASE_PATH=/coding/play/
```

Build each independently:
```bash
cd /home/mud/mudslinger && npm install && npm run build
cd /home/mud/mudslinger_builders && npm install && npm run build
```

Edit nginx site config to add both paths before the rest of the config.

`/etc/nginx/sites-available/merentha`
```
server {
    listen 80 default_server;
    server_name _;

    location = /play { return 301 /play/; }

    location /play/ {
        alias /home/mud/mudslinger/static/public/;
        index index.html;
        try_files $uri $uri/ /play/index.html;
    }

    location = /coding/play { return 301 /coding/play/; }

    location /coding/play/ {
        alias /home/mud/mudslinger_builders/static/public/;
        index index.html;
        try_files $uri $uri/ /coding/play/index.html;
    }

    // snip
}

server {
    server_name merentha.com; # managed by Certbot

    location = /play { return 301 /play/; }

    location /play/ {
        alias /home/mud/mudslinger/static/public/;
        index index.html;
        try_files $uri $uri/ /play/index.html;
    }

    location = /coding/play { return 301 /coding/play/; }

    location /coding/play/ {
        alias /home/mud/mudslinger_builders/static/public/;
        index index.html;
        try_files $uri $uri/ /coding/play/index.html;
    }

    // snip
}
```

After editing, reload nginx:
```bash
nginx -t && systemctl reload nginx
```
