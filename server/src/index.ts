import express from 'express';
import * as Settings from './Controllers/Settings';
import { TwitchConfig } from './TwitchConfig';

const app = express();
const port = 3000;

app.use(express.json());

// app.get("/", (req, res) => {
//     // res.send(TwitchConfig.cfg<string>("app_url", "test"));
//     res.send(TwitchConfig.config);
// });

app.get("/api/v0/settings", Settings.GetSettings);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
});