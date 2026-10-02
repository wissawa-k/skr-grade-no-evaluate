# SKR Grade Reader

An old-school web interface that logs in to `grade.skr.ac.th` through a small Flask proxy and displays the returned grade report.

## Run locally

```bash
python3 -m pip install -r requirements.txt
python3 app.py
```

Open <http://127.0.0.1:8000>.

## Deploy to Railway

1. Push this directory to a GitHub repository.
2. In Railway, choose **New Project → Deploy from GitHub repo**.
3. Select the repository and deploy. Railway uses `railway.json` automatically.
4. Open **Settings → Networking → Generate Domain**.

No environment variables are normally required. Requests use a Chrome-compatible TLS fingerprint to avoid false automated-client detection by Cloudflare.

Optional Railway variables:

```text
SKR_CF_CLEARANCE=your_current_clearance_cookie
SKR_BROWSER=chrome
SKR_HTTP_PROXY=http://username:password@proxy-host:port
```

`SKR_CF_CLEARANCE` is temporary and may be tied to the browser or IP that created it. `SKR_HTTP_PROXY` is only needed if Cloudflare blocks Railway's outbound IP even with browser impersonation.

Credentials are passed to SKR for the current login request and are not saved. Login attempts are rate-limited.
