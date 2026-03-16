# DNS Configuration for agitebrand.com

## Server
- **IP**: 46.62.231.10

## Subdomains

| Subdomain | Type | Value | Port | Service |
|-----------|------|-------|------|---------|
| `agitebrand.com` | A | 46.62.231.10 | 4004 | Frontend (Landing Page) |
| `admin.agitebrand.com` | A | 46.62.231.10 | 4005 | Admin Dashboard |
| `api.agitebrand.com` | A | 46.62.231.10 | 4003 | Backend API |

## Setup Steps

1. Go to your domain registrar's DNS settings
2. Add the following **A records**:

```
Type    Name     Value          TTL
A       @        46.62.231.10   3600
A       admin    46.62.231.10   3600
A       api      46.62.231.10   3600
```

3. After DNS propagates, set up a reverse proxy (Nginx) on the server to route subdomains to the correct ports:

```nginx
# /etc/nginx/sites-available/agitebrand.com

# Frontend - agitebrand.com
server {
    listen 80;
    server_name agitebrand.com www.agitebrand.com;

    location / {
        proxy_pass http://127.0.0.1:4004;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# Admin - admin.agitebrand.com
server {
    listen 80;
    server_name admin.agitebrand.com;

    location / {
        proxy_pass http://127.0.0.1:4005;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# API - api.agitebrand.com
server {
    listen 80;
    server_name api.agitebrand.com;

    location / {
        proxy_pass http://127.0.0.1:4003;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

4. Enable the sites and restart Nginx:

```bash
ln -s /etc/nginx/sites-available/agitebrand.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

5. Add SSL with Certbot:

```bash
certbot --nginx -d agitebrand.com -d www.agitebrand.com -d admin.agitebrand.com -d api.agitebrand.com
```

## After SSL

Update `REACT_APP_API_URL` in the frontend and admin configs to use `https://api.agitebrand.com/api` instead of the IP:port URL.
