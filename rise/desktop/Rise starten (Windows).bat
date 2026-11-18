@echo off
rem Startet Rise als eigenes App-Fenster (Edge oder Chrome), ganz ohne Internet.
set "F=%~dp0Rise.html"
set "FLAGS=--autoplay-policy=no-user-gesture-required"
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%F%" %FLAGS%
  exit /b
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="%F%" %FLAGS%
  exit /b
)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="%F%" %FLAGS%
  exit /b
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
  start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" --app="%F%" %FLAGS%
  exit /b
)
start "" "%F%"
