import fs from "fs";
export class ChatDumper {
    constructor(input_username: string, file_output: string, overwrite?: boolean);
    client: ChatClient;
    input_username: string;
    file_output: string;
    overwrite: boolean;
    comments: any[];
    setup(): void;
    chatStream: fs.WriteStream;
    textStream: fs.WriteStream;
    start(): void;
    stop(): void;
    saveJSON(): void;
}
import { ChatClient } from "dank-twitch-irc/dist/client/client";
