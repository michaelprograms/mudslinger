# Deploy

Documentation around how this app is deployed to an nginx server.

The app is scoped to `/play/` after the domain in the URL.

Edit nginx site config to add the `/play/` path before the rest of the config.

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

    // snip
}
```