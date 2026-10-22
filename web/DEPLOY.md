# Deploying to an Ubuntu VPS

This puts the site on your domain with nginx, gunicorn and a free HTTPS certificate.
Run everything as `root` on the VPS. Replace `yourdomain.com` with your domain.

## 0. DNS (at your domain registrar)

| Type | Name | Value |
|---|---|---|
| A | @ | your VPS IP |
| A | www | your VPS IP |

## 1. Install system packages and the firewall

```bash
DOMAIN=yourdomain.com        # run this again if you log in again later

apt update && apt -y upgrade
apt -y install python3 python3-venv python3-dev build-essential nginx certbot python3-certbot-nginx git ufw sqlite3
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
```

If you followed the earlier guide (the pre-Django `server.py`), switch the old site off first:
```bash
systemctl disable --now deutsch 2>/dev/null; rm -f /etc/nginx/sites-enabled/deutsch
```

## 2. User, folders and code

```bash
adduser --system --group --home /srv/zema zema
mkdir -p /srv/zema/data
git clone -b main https://github.com/yohannes11/ZemaLearnGermany.git /srv/zema/app
python3 -m venv /srv/zema/venv
/srv/zema/venv/bin/pip install --upgrade pip
/srv/zema/venv/bin/pip install -r /srv/zema/app/requirements.txt
```

## 3. Settings (`/srv/zema/.env`)

```bash
cp /srv/zema/app/.env.example /srv/zema/.env
SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
sed -i "s|^DJANGO_SECRET_KEY=.*|DJANGO_SECRET_KEY=$SECRET|" /srv/zema/.env
sed -i "s|example.com|$DOMAIN|g" /srv/zema/.env
nano /srv/zema/.env          # check the values; set DJANGO_ADMIN_URL to something only you know
```

## 4. Database, static files and your admin account

```bash
chmod 755 /srv/zema
chown -R zema:www-data /srv/zema/app /srv/zema/venv       # nginx (www-data) reads the static files
chown zema:zema /srv/zema/data && chmod 700 /srv/zema/data  # only the app reads the database
chown root:root /srv/zema/.env && chmod 600 /srv/zema/.env  # secrets: systemd reads this as root

cd /srv/zema/app
run() { sudo -u zema env $(grep -v '^#' /srv/zema/.env | xargs) DJANGO_SETTINGS_MODULE=config.settings.prod /srv/zema/venv/bin/python manage.py "$@"; }
run migrate
run collectstatic --noinput
run check --deploy
run createsuperuser          # asks for a username, email, name and password
```

`check --deploy` should say "no issues (2 silenced)".

## 5. gunicorn service

```bash
cp /srv/zema/app/deploy/zema.service /etc/systemd/system/zema.service
systemctl daemon-reload
systemctl enable --now zema
systemctl status zema --no-pager
```

It should say `active (running)`.

## 6. nginx and HTTPS

```bash
sed "s/example.com/$DOMAIN/g" /srv/zema/app/deploy/nginx.conf > /etc/nginx/sites-available/zema
ln -sf /etc/nginx/sites-available/zema /etc/nginx/sites-enabled/zema
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

getent hosts $DOMAIN          # must print your VPS IP before the next step
certbot --nginx -d $DOMAIN -d www.$DOMAIN --redirect --agree-tos -m you@example.com
```

Open `https://yourdomain.com` (the course) and `https://yourdomain.com/dashboard/` (sign in with the
account from step 4).

## Updating the site later

```bash
cd /srv/zema/app && git pull
/srv/zema/venv/bin/pip install -r requirements.txt
run migrate && run collectstatic --noinput     # define run() as in step 4 first
systemctl restart zema
```

## Backups

```bash
sqlite3 /srv/zema/data/db.sqlite3 ".backup /root/zema-$(date +%F).sqlite3"
```

## Moving data from the old server

If the old `server.py` site already had users, copy its database and import it once, right after
`migrate` in step 4 and before anyone uses the new site:
```bash
cp /srv/deutsch/data/usage.db /srv/zema/data/legacy-usage.db && chown zema /srv/zema/data/legacy-usage.db
run import_legacy_usage /srv/zema/data/legacy-usage.db
```

## Troubleshooting

| Problem | Look at |
|---|---|
| 502 Bad Gateway | `journalctl -u zema -n 50 --no-pager` |
| 400 Bad Request | `DJANGO_ALLOWED_HOSTS` in `/srv/zema/.env` must list your domain |
| CSRF errors on sign-in | `DJANGO_CSRF_TRUSTED_ORIGINS` must list `https://yourdomain.com` |
| Styles or audio missing | re-run `collectstatic`, then check `nginx -t` |
