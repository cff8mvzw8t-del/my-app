@echo off

:: The guard prevents an infinite loop since fnm env spawns a sub-shell
if not defined FNM_AUTORUN_GUARD (
    set "FNM_AUTORUN_GUARD=AutorunGuard"
    FOR /f "tokens=*" %%z IN ('fnm env --use-on-cd') DO CALL %%z
)

call fnm use 26
call node -v
call npm -v
call npx expo start --web --tunnel --port 8090
pause
