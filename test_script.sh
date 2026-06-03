#!/bin/bash
sudo -n docker exec onlyoffice cat /etc/onlyoffice/documentserver/default.json | grep -i allowPrivate
