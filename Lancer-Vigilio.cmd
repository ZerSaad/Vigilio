@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Installez Node.js puis relancez ce fichier.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm.cmd ci
  if errorlevel 1 goto error
)
if not exist public\models\face_landmarker.task (
  call npm.cmd run assets
  if errorlevel 1 goto error
)
if not exist public\models\hand_landmarker.task (
  call npm.cmd run assets
  if errorlevel 1 goto error
)
echo.
echo Vigilio : ouvrez http://localhost:5173 dans Edge ou Chrome.
echo Gardez cette fenetre ouverte. Ctrl+C pour arreter le serveur.
echo.
call npm.cmd run dev
exit /b
:error
echo Echec de la preparation. Verifiez votre connexion puis reessayez.
pause
exit /b 1
