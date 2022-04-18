cd .\client-vue
REM call yarn run build
cd ..\server
REM call yarn run build
cd ..
del automator.zip
REM make zip with today's date
SET DATE=%date:~0,10%
7za a -tzip -mx=9 automator-%DATE%.zip client-vue\dist
7za a -tzip -mx=9 automator-%DATE%.zip server\build server\tsconfig.json
7za a -tzip -mx=9 automator-%DATE%.zip requirements.txt Pipfile Pipfile.lock
7za a -tzip -mx=9 -xr!node_modules automator-%DATE%.zip vodplayer twitch-chat-dumper