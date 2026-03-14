This directory is the protected downloads folder. Place release artifacts here (e.g., ConvertTheSpireReborn.zip, ConvertTheSpireReborn.apk, linux.zip, ConvertTheSpireReborn-macOS.zip).

Do NOT commit large binary releases into the repository. Move them here on the server and ensure `PROTECTED_DOWNLOADS_DIR` points to this directory (or leave default). The backend will serve files from here via authenticated/tracked endpoints.

Example (on server):

mkdir -p /var/data/protected_downloads
rsync -av --progress /local/path/*.zip /var/data/protected_downloads/
# set environment variable if using a different directory
export PROTECTED_DOWNLOADS_DIR=/var/data/protected_downloads

