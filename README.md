# SKR Grade Reader

A simple, static viewer for saved HTML result pages from `grade.skr.ac.th`.

## Use locally

Open `index.html` in a browser. No server or installation is required.

1. Log in at <https://grade.skr.ac.th/>.
2. Open the result page and save it as HTML (`Ctrl+S`).
3. Select the saved file in SKR Grade Reader.

The file is parsed entirely in the browser and is never uploaded.

## GitHub Pages

Push these files to a GitHub repository, open **Settings → Pages**, and select **Deploy from a branch** using the repository root.

The site cannot log in to SKR directly because browsers prevent a static site on another domain from reading the authenticated SKR response. Importing the saved result file avoids that restriction without transmitting credentials or student data.
