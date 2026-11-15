@echo off
cd /d "%~dp0"
echo La compilation Android necessite Android Studio et son JDK 21.
echo Configurez JAVA_HOME et ANDROID_HOME avant de continuer.
if not defined ANDROID_HOME (
  echo ANDROID_HOME absent. Installez le SDK dans Android Studio.
  pause
  exit /b 1
)
call npm.cmd run android:sync
if errorlevel 1 goto error
pushd android
call gradlew.bat assembleDebug
if errorlevel 1 (
  popd
  goto error
)
popd
echo APK : android\app\build\outputs\apk\debug\app-debug.apk
pause
exit /b 0
:error
echo Compilation echouee. Consultez le message ci-dessus.
pause
exit /b 1
