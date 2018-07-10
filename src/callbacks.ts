import { Message } from "discord.js";

export interface SimpleCallback {
    (message: Message): void;
}

export interface CommandCallback {
    (args: string[], rawArgs: string, message: Message): void;
}