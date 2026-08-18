#!/bin/bash
set -e
node scripts/fetch-news.js
node scripts/write-blogs.js
