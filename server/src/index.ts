import express from 'express';
import { TwitchConfig } from './TwitchConfig';

const app = express();
const port = 3000;

app.get("/", (req, res) => {
    res.send(TwitchConfig.config);
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
});