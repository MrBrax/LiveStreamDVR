# twitch-chat-dumper
Dump twitch chat live to JSON

## Usage
```
node .\index.js

    --channel <string>
    Select channel to capture

    --userid <int>
    Userid, not used

    --date <string>
    Date for capture start, not used

    --output <string>
    Output file, .line and .text will be appended to secondary files

    --overwrite
    Force overwrite (append) to files
```