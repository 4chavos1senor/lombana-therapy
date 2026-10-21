@echo off
setlocal
title Iniciar Lombana Therapy
rem Colocar junto a docker-compose.yml o compose.yaml y al archivo .env.
pushd "%~dp0"
if errorlevel 1 goto carpeta_error

echo ========================================
echo       Iniciar Lombana Therapy
echo ========================================
echo.

if exist "compose.yaml" goto compose_ok
if exist "compose.yml" goto compose_ok
if exist "docker-compose.yaml" goto compose_ok
if exist "docker-compose.yml" goto compose_ok
echo ERROR: No se encontro el archivo de Docker Compose.
echo Coloca este .bat en la misma carpeta que el archivo compose.
goto error

:compose_ok
if not exist ".env" (
    echo ERROR: Falta el archivo .env en esta carpeta.
    echo Utiliza el .env que ya configuraste para este proyecto.
    goto error
)

where docker >nul 2>&1
if errorlevel 1 (
    echo ERROR: No se encontro Docker. Instala Docker Desktop.
    goto error
)

docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker no esta disponible.
    echo Abre Docker Desktop, espera a que inicie y ejecuta este archivo otra vez.
    goto error
)

docker compose version >nul 2>&1
if errorlevel 1 (
    echo ERROR: No esta disponible Docker Compose.
    echo Revisa tu instalacion de Docker Desktop.
    goto error
)

echo Iniciando los servicios del proyecto...
docker compose --env-file ".env" up -d
if errorlevel 1 (
    echo ERROR: No se pudieron iniciar los servicios.
    echo Revisa el mensaje de Docker que aparece arriba.
    goto error
)

echo.
echo Esperando respuesta de http://localhost:3000 ...
powershell.exe -NoLogo -NoProfile -Command "$ready=$false; for($i=0;$i -lt 60;$i++){try{$r=Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000' -TimeoutSec 2; if($r.StatusCode -eq 200){$ready=$true; break}}catch{}; Start-Sleep -Seconds 2}; if($ready){exit 0}else{exit 1}"
if errorlevel 1 (
    echo ERROR: La pagina no respondio a tiempo en el puerto 3000.
    echo Comprueba el estado de los servicios:
    docker compose --env-file ".env" ps
    echo Para revisar el backend, ejecuta en esta carpeta:
    echo docker compose logs --tail=30 backend
    goto error
)

echo.
echo Proyecto disponible. Abriendo el navegador...
start "" "http://localhost:3000"
echo Puedes cerrar esta ventana. Los contenedores siguen ejecutandose.
popd
pause
exit /b 0

:error
echo.
echo Corrige el problema indicado y vuelve a ejecutar este archivo.
popd
pause
exit /b 1

:carpeta_error
echo ERROR: No se pudo abrir la carpeta del proyecto.
pause
exit /b 1
