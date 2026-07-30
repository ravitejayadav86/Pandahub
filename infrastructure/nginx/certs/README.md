# TLS Certificates for PandaHub

This directory holds TLS certificates for the nginx reverse proxy.

## Local Development

Generate a self-signed certificate:

```bash
bash infrastructure/nginx/certs/generate-dev-certs.sh
```

This creates `server.crt` and `server.key` for local use.

> ⚠️ Browsers will show a "Not Secure" warning for self-signed certs — this is expected.

## Production (Let's Encrypt)

1. Point your domain DNS to the server.
2. Run Certbot:
   ```bash
   certbot certonly --webroot -w /var/www/certbot -d pandahub.yourdomain.com
   ```
3. Update `nginx.conf`:
   ```nginx
   ssl_certificate     /etc/letsencrypt/live/pandahub.yourdomain.com/fullchain.pem;
   ssl_certificate_key /etc/letsencrypt/live/pandahub.yourdomain.com/privkey.pem;
   ```
4. Mount the Let's Encrypt directory in `docker-compose.yml`:
   ```yaml
   volumes:
     - /etc/letsencrypt:/etc/letsencrypt:ro
   ```

## Files (git-ignored)

- `server.crt` — certificate (public, safe to share)
- `server.key` — **PRIVATE KEY** — never commit to git!
