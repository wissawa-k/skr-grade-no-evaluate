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

No environment variables are normally required. If Cloudflare blocks Railway's request to SKR, add this Railway variable and redeploy:

```text
SKR_CF_CLEARANCE=your_current_clearance_cookie
```

Credentials are passed to SKR for the current login request and are not saved. Login attempts are rate-limited.
