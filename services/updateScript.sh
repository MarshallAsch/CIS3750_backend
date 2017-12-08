#!/bin/bash

# This script would be run by a continuous integration server to update the
# server to the latest version.
#
#

cd  /path/to/server || exit 1


eval "$(ssh-agent -s)"
ssh-add /path/to/deployment/key
git pull

npm install
sudo systemctl restart server.service

echo "Server is now up to date."
