import express from 'express';
import * as Settings from './Controllers/Settings';
import * as Channels from './Controllers/Channels';
import * as Log from './Controllers/Log';
import { TwitchConfig } from './Core/TwitchConfig';
import history from "connect-history-api-fallback";
import path from 'path';

const app = express();
const port = 8080;

app.use(express.json());



// app.get("/", (req, res) => {
//     // res.send(TwitchConfig.cfg<string>("app_url", "test"));
//     res.send(TwitchConfig.config);
// });

// single page app
app.use(history());
app.use(express.static( path.join(__dirname, "..", "..", "client-vue", "dist")) );

app.get("/api/v0/settings", Settings.GetSettings);

app.get("/api/v0/channels", Channels.ListChannels);

app.get("/api/v0/log/:filename/?:last_line?", Log.GetLog);


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
});