@echo off
cd /d "%~dp0"
echo Deploying the complete portfolio including Ask Azhan AI...
netlify link
netlify deploy --prod --dir .
pause
