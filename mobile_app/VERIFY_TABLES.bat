@echo off
echo ========================================
echo Verifying Database Tables
echo ========================================
echo.

cd /d "%~dp0"

mysql -h 13.202.34.243 -u root -pYcsPass@2025 -e "USE DJTDB; SHOW TABLES;"

echo.
echo ========================================
echo Table verification complete
echo ========================================
echo.

pause
