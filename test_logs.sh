#!/bin/bash
sudo -n docker exec onlyoffice cat /var/log/onlyoffice/documentserver/nginx.error.log
echo "--- NGINX ACCESS ---"
sudo -n docker exec onlyoffice tail -n 20 /var/log/onlyoffice/documentserver/nginx.access.log
