# Unraid and inventory.gibbhub.io

These instructions use your Unraid server at **192.168.0.88**, your existing **Nginx Proxy Manager**, and **Namecheap DNS**. The new address is **https://inventory.gibbhub.io**. Existing sites such as water.gibbhub.io stay as they are.

## 1. Upload the application

The deployment archive contains the source and seeded catalog, without local inventory data. Run this on your Windows computer in PowerShell (requires SSH enabled on Unraid):

```powershell
scp 'C:\Users\Blain\OneDrive\Documents\water-treatment-tools\deployment\operator-inventory.tar.gz' root@192.168.0.88:/mnt/user/appdata/
```

If SSH is disabled, you can instead copy the archive to the appdata share in File Explorer if that share is exported. Either way, the archive should land at `/mnt/user/appdata/operator-inventory.tar.gz`.

Open the terminal from the Unraid web interface and run:

```sh
mkdir -p /mnt/user/appdata/operator-inventory-source
tar -xzf /mnt/user/appdata/operator-inventory.tar.gz -C /mnt/user/appdata/operator-inventory-source
cd /mnt/user/appdata/operator-inventory-source
mkdir -p /mnt/user/appdata/operator-inventory
chown 1000:1000 /mnt/user/appdata/operator-inventory
```

Source files and saved inventory data live in separate folders. Do not replace or delete the data folder when uploading an update. The first image build downloads the Node base image and needs internet connectivity.

## 2. Start with Docker Compose

From the extracted source directory, run:

```sh
cd /mnt/user/appdata/operator-inventory-source
docker compose up -d --build
```

The included compose.yaml builds the image, exposes port 3080, mounts the data folder at /data, and sets restart to unless-stopped. Use your installed Compose tooling on Unraid; do not also create a manual container with the same name.

Visit **http://192.168.0.88:3080** from your computer. Create a test inventory, enter a count, wait for “All changes saved,” then reload and resume it from history. Restart the container from Unraid and check the count again to verify persistence.

For future updates, upload the refreshed archive, extract it into the same source folder, and run `docker compose up -d --build` there again. The source archive excludes inventory data. On startup, this version permanently removes the old combined inventories from `/mnt/user/appdata/operator-inventory/inventories.json`, while retaining separate worksheet inventories and their counts.

If the app does not start, inspect its Unraid container log or run:

```sh
docker logs --tail 100 operator-inventory
curl -i http://192.168.0.88:3080/api/health
```

The health endpoint should return `{"ok":true}`. A permission error usually means the data folder is not writable by UID/GID 1000. If host port 3080 is already in use, choose a different host port and use it in the browser and proxy settings below; keep the container port at 3080.

## Optional: email Order Needed reports

After uploading and extracting the updated archive, create the mailbox configuration in the source folder on Unraid. Do this once; `.env` is excluded from deployment archives and Docker images.

```sh
cd /mnt/user/appdata/operator-inventory-source
cp -n .env.example .env
chmod 600 .env
nano .env
```

Fill in your full sending mailbox and its mailbox password (or application password supported by your account). These are your email credentials, not your Namecheap website login. Do not put them into HTML or send them in chat.

```dotenv
SMTP_HOST=mail.privateemail.com
SMTP_PORT=465
SMTP_USER=your-mailbox@gibbhub.io
SMTP_PASSWORD='your-mailbox-password'
EMAIL_DEFAULT_TO=recipient@example.com
```

`EMAIL_DEFAULT_TO` is optional and can be changed on each report. Single-quote the password to keep literal dollar signs from being expanded by Compose. If it contains a single quote, escape that quote with a backslash inside the quoted value.

These defaults follow [Namecheap Private Email SMTP settings](https://www.namecheap.com/support/knowledgebase/article.aspx/1179/2175/general-private-email-configuration-for-mail-clients-and-mobile-devices/): `mail.privateemail.com`, port 465 with encrypted SMTP. Port 587 also works; the app requires STARTTLS when that port is selected. If your mailbox is hosted through Namecheap cPanel rather than Private Email, use the SMTP hostname shown in that mailbox's mail-client settings instead.

Save the file and recreate the app:

```sh
docker compose up -d --build
```

Open an Order Needed report, enter the recipient, and press **Send report by email**. Completing inventory does not send mail automatically. Draft messages are labeled DRAFT and exclude uncounted items. Messages contain text and HTML versions of the report, including manual-review items. Success means the SMTP server accepted the email; inbox delivery is not guaranteed. Check the recipient inbox and spam folder for your first send. After a send, wait 30 seconds before sending another.

Without a configured mailbox, the email form remains disabled and inventory entry still works. Credentials stay on the server; only email availability and the optional default recipient are returned to the browser. Keep the Nginx Proxy Manager password-protected access list enabled for this app. No router port-forwarding changes are needed for outbound email.

## 3. Add the Namecheap DNS record

In **Domain List → Manage** beside gibbhub.io → **Advanced DNS → Host Records → Add New Record**, add:

| Field | Value |
| --- | --- |
| Type | CNAME Record |
| Host | `inventory` |
| Value / Target | `water.gibbhub.io` |
| TTL | Automatic |

This reuses the public destination of your working water.gibbhub.io site. It assumes that hostname points to your existing Nginx Proxy Manager gateway. A CNAME controls DNS resolution only; Nginx Proxy Manager still receives the requested hostname inventory.gibbhub.io and routes it separately. Do not put a URL scheme, path, or port in the DNS value. Do not replace existing root or water records.

If water.gibbhub.io uses a tunnel or another service that accepts only configured hostnames, add the new hostname in that service too instead of relying on the CNAME alone. If Namecheap shows no editable Host Records, check the domain's nameservers and edit DNS at the authoritative provider.

## 4. Add a password-protected proxy host

The app currently has no built-in login. Before publishing it, in Nginx Proxy Manager open **Access Lists → Add Access List**:

- Name it `Inventory operators`.
- In **Authorization**, add a username and a strong password; save the user entry and the list.
- Leave **Satisfy Any** off so an IP allow rule cannot bypass the password requirement.

Then open **Hosts → Proxy Hosts → Add Proxy Host**:

| Field | Value |
| --- | --- |
| Domain Names | `inventory.gibbhub.io` |
| Scheme | `http` |
| Forward Hostname / IP | `192.168.0.88` |
| Forward Port | `3080` |
| Access List | `Inventory operators` |
| Cache Assets | Off |
| Websockets Support | Not required |

In the **SSL** tab, select an existing certificate that covers inventory.gibbhub.io (such as *.gibbhub.io), or request a new Let's Encrypt certificate for inventory.gibbhub.io. Enable **Force SSL**, accept the certificate terms if requesting a certificate, and save. An existing certificate for only water.gibbhub.io will not cover the inventory hostname.

Use the existing Nginx Proxy Manager gateway and router forwarding that already serve your sites. Do not forward port 3080 or Nginx Proxy Manager's admin port to the internet. If the proxy's Docker network cannot reach the host's LAN address, inspect its networking before changing the app; a shared Docker network is another supported routing method.

## 5. Verify outside your home network

On your phone, turn off Wi-Fi and open **https://inventory.gibbhub.io**:

1. Confirm the browser asks for the proxy username/password before showing the app.
2. Sign in and create a dated inventory with your operator name.
3. Enter a count, wait for it to save, and verify it from another browser.

If you use the NPM Basic Auth access list above, this unauthenticated check should return HTTP 401, not the inventory catalog:

```sh
curl -I https://inventory.gibbhub.io/api/catalog
```

Common failures:

| Result | What to check |
| --- | --- |
| 502 Bad Gateway | Local app works, correct forward port, NPM can reach 192.168.0.88 |
| Domain has broken styling but local port works | Turn Cache Assets off on the NPM proxy host; test in a private browser window; remove any custom CSS/JS locations pointing to a different upstream |
| DNS error | inventory CNAME saved at the authoritative DNS provider and has propagated |
| Certificate request fails | DNS points to the existing gateway; existing HTTP challenge route reaches NPM, or use your configured DNS challenge |
| Opens without a password | Correct access list assigned; Satisfy Any off; test in a fresh private browser session |
| Works on cellular but not home Wi-Fi | Router NAT loopback or local DNS override for inventory.gibbhub.io |

Back up `/mnt/user/appdata/operator-inventory`, which holds `inventories.json`. Source files alone do not contain your saved counts.

References: [Unraid container settings](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/managing-and-customizing-containers/), [Nginx Proxy Manager guide](https://nginxproxymanager.com/guide/), [Namecheap CNAME setup](https://www.namecheap.com/support/knowledgebase/article.aspx/9646/2237/how-to-create-a-cname-record-for-your-domain/).

## One-command updates from this PC

From the repository folder in PowerShell, run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\apps\operator-inventory\deploy.ps1
```

This runs local tests, creates the archive, uploads it and the Bash update script with SCP, then runs the Unraid update over SSH. Defaults are root@192.168.0.88 and the existing appdata paths above. SSH must be enabled and Docker Compose installed. The execution-policy override applies only to this PowerShell process, not your Windows policy settings. Accept a first-use SSH host key only after verifying it belongs to your server. Password authentication may prompt during each upload and SSH connection. Existing SSH key authentication works without changes to the script.

The server script backs up inventories.json, .env, and previous source files in a dated folder under /mnt/user/appdata/operator-inventory-backups before extracting. It preserves the live .env and data folder, rebuilds with Docker Compose, and checks http://127.0.0.1:3080/api/health for up to 60 seconds. It stops on command failure and prints recent container logs if the health check fails. A failed deployment does not automatically restore backups. Backups include mailbox secrets and are restricted to the server owner. Inventory counts entered after the backup are not in that backup. No Nginx Proxy Manager or DNS changes are made.

To build the package without contacting Unraid:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\apps\operator-inventory\deploy.ps1 -PackageOnly
```

Use -Server to override the IP, -User to override the SSH user, or -SkipTests to explicitly skip local tests. Keep the Bash paths and port in deploy-unraid.sh aligned with your Compose setup if those change.
