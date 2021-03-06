import { Message } from "discord.js";
import { HandlerBuilder, HandlerConfig } from "./handler-builder";
import { Utils, MessageType, ActionType } from "./utils";
import { ActionExecutor } from "./action-executor";
import { SimpleCallback, CommandCallback, LogCallback } from "./callbacks";

export class MessageHandler {

    private handlers: HandlerBuilder[] = [];
    private caseSensitive: boolean = false;
    private logFn: LogCallback | null = null;

    constructor(context?: MessageHandler) {
        if (context) {
            this.handlers = context.handlers;
            this.caseSensitive = context.caseSensitive;
            this.logFn = context.logFn;
        }
    }

    log(messageType: number, filter: string, message: Message) {
        const msgType = Utils.getKeyByValue(MessageType, messageType);

        if (this.logFn && typeof this.logFn == "function") {
            this.logFn(msgType as string, filter, message);
        }
    }

    setCaseSensitive(isCaseSensitive: boolean) {
        this.caseSensitive = isCaseSensitive;
    }

    enableLogging(logFn: LogCallback) {
        this.logFn = logFn;
    }

    whenMessageContains(text: string) {
        const builder = new HandlerBuilder().type(MessageType.MESSAGE_CONTAINS).query(text);
        this.handlers.push(builder);
        return builder;
    }

    whenMessageContainsExact(text: string) {
        const builder = new HandlerBuilder().type(MessageType.MESSAGE_CONTAINS_EXACT).query(text);
        this.handlers.push(builder);
        return builder;
    }

    whenMessageContainsWord(text: string) {
        const builder = new HandlerBuilder().type(MessageType.MESSAGE_CONTAINS_WORD).query(text);
        this.handlers.push(builder);
        return builder;
    }

    whenMessageContainsOne(array: string[]) {
        const builder = new HandlerBuilder().type(MessageType.MESSAGE_CONTAINS_ONE).query(array);
        this.handlers.push(builder);
        return builder;
    }

    whenMessageStartsWith(text: string) {
        const builder = new HandlerBuilder().type(MessageType.MESSAGE_STARTS_WITH).query(text);
        this.handlers.push(builder);
        return builder;
    }


    whenMessageEndsWith(text: string) {
        const builder = new HandlerBuilder().type(MessageType.MESSAGE_ENDS_WITH).query(text);
        this.handlers.push(builder);
        return builder;
    }

    onCommand(text: string) {
        const builder = new HandlerBuilder().type(MessageType.COMMAND).query(text);
        this.handlers.push(builder);
        return builder;
    }

    handleMessage(discordMessage: Message) {
        const messageRaw = discordMessage.content;

        this.handlers
            .map(builder => builder.handler)
            .filter(handler => {
                let message: string;
                let query: string | string[];

                if (this.caseSensitive) {
                    message = discordMessage.content;
                    query = handler.query;
                } else {
                    message = discordMessage.content.toLowerCase();

                    if (Array.isArray(handler.query)) {
                        query = Utils.arrayToLower(handler.query);
                    } else {
                        query = handler.query.toLowerCase()
                    }
                }

                switch (handler.type) {
                    case MessageType.MESSAGE_CONTAINS:
                        return message.includes(query as string);
                    case MessageType.MESSAGE_CONTAINS_EXACT:
                        return messageRaw.includes(handler.query as string);
                    case MessageType.MESSAGE_CONTAINS_WORD:
                        return message.split(" ").indexOf(query as string) >= 0;
                    case MessageType.MESSAGE_CONTAINS_ONE:
                        return (query as string[]).filter(queryParam => message.split(" ").indexOf(queryParam) >= 0).length > 0;
                    case MessageType.MESSAGE_STARTS_WITH:
                    case MessageType.COMMAND:
                        if (handler.aliases) {
                            handler.aliases.push(query as string);
                            let check = handler.aliases.map(q => Utils.startsWithWord(message, q));
                            return check.reduce((a, b) => a || b);
                        } else {
                            return Utils.startsWithWord(message, query as string);
                        }
                    case MessageType.MESSAGE_ENDS_WITH:
                        return message.endsWith(query as string);
                    default:
                        return false;
                }
            })
            .forEach((handler: HandlerConfig) => {
                this.log(handler.type, handler.query.toString(), discordMessage);
                let executor = new ActionExecutor(discordMessage);

                if(this.checkChance(handler)) {
                    switch (handler.action) {
                        case ActionType.REPLY:
                            executor.reply(handler.actionArgs);
                            break;
                        case ActionType.REPLY_SOMETIMES:
                            executor.replySometimes(handler.actionArgs);
                            break;
                        case ActionType.REPLY_ONE:
                            executor.replyOne(handler.actionArgs);
                            break;
                        case ActionType.THEN:
                            executor.then(handler.callback as SimpleCallback);
                            break;
                        case ActionType.DO:
                            executor.do(handler.callback as CommandCallback, handler.minArgs, handler.matches, handler.allowedChannels, handler.errorMessage);
                            break;
                        default:
                            break;
                    }

                    this.checkDeletion(handler, discordMessage);
                } else {
                    this.log(MessageType.CANCELLED, "Action failed the 'sometimes' chance.", discordMessage);
                }

            });

    }

    private checkChance(handler: HandlerConfig) {
        if (handler && handler.chance) {
            return Utils.random(1, 100) <= handler.chance;
        } else {
            return true;
        }
    }

    private checkDeletion(handler: HandlerConfig, message: Message) {
        if (handler.deleteTimer != null) {
            setTimeout(() => {
                message.delete();
            }, handler.deleteTimer);
        }
    }

}
