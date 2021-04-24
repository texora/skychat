import * as escapeHtml from "escape-html";
import {Config} from "./Config";
import { StickerManager } from './StickerManager';



/**
 * Singleton helper to format messages
 */
export class MessageFormatter {

    public static readonly IMAGE_REPLACE_LIMIT: number = Config.PREFERENCES.maxReplacedImagesPerMessage;

    public static readonly MAX_NEWLINES_PER_MESSAGE: number = Config.PREFERENCES.maxNewlinesPerMessage;

    private static instance?: MessageFormatter;

    /**
     * Escape a regexp
     * @param string
     */
    public static escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }

    public static getInstance(): MessageFormatter {
        if (! MessageFormatter.instance) {
            MessageFormatter.instance = new MessageFormatter();
        }
        return MessageFormatter.instance;
    }

    public stickers: {[code: string]: string} = {};

    /**
     * Format a raw message to html
     * @param message
     */
    public format(message: string, remove?: boolean, trusted?: boolean): string {
        message = this.replaceHtml(message);
        message = this.replaceNewlines(message, remove, trusted);
        message = this.replaceButtons(message, remove, trusted);
        message = this.replaceImages(message, remove, trusted);
        message = this.replaceRisiBankStickers(message, remove);
        message = this.replaceStickers(message, remove);
        message = this.replaceLinks(message, remove);
        return message;
    }

    /**
     * Escape html
     * @param message
     */
    public replaceHtml(message: string): string {
        return escapeHtml(message);
    }

    /**
     * Replace newlines with <br>
     * @param message
     * @param remove
     * @param trusted
     */
    public replaceNewlines(message: string, remove?: boolean, trusted?: boolean): string {
        if (remove) {
            return message.replace(/\n/g, ' ');
        }
        // If replacing newlines with html br
        if (trusted) {
            return message.replace(/\n/g, '<br>');
        }
        // If using max newlines / message
        let count = 0;
        return message.replace(/\n/g, () => {
            // If limit reached
            if (++ count > MessageFormatter.MAX_NEWLINES_PER_MESSAGE) {
                return "\n";
            }
            // Otherwise, replace with br
            return '<br>';
        })
    }

    /**
     * Replace buttons
     * @param message
     * @param trusted
     */
    public replaceButtons(message: string, remove?: boolean, trusted?: boolean): string {
        const regexStr = '\\[\\[(.+?)\/(.+?)\\]\\]';
        const matches = message.match(new RegExp(regexStr, 'g'));
        if (! matches) {
            return message;
        }
        for (const rawCode of matches) {
            const codeDetail = rawCode.match(new RegExp(regexStr));
            if (! codeDetail) {
                // Weird: not supposed to happen
                continue;
            }
            if (remove) {
                // Remove the button
                message = message.replace(rawCode, '');
            } else {
                // Replace the button by its html code
                const buttonCode = this.getButtonHtml(codeDetail[1], codeDetail[2], trusted);
                message = message.replace(rawCode, buttonCode);
            }
        }
        return message;
    }

    /**
     * Get the html code of a button
     * @param title
     * @param action
     * @param escape
     * @param trusted
     */
    public getButtonHtml(title: string, action: string, trusted?: boolean) {
        // Escape title and actions to prevent XSS
        title = this.format(title, true);
        action = this.format(action, true);
        // Preview command if action is one
        if (action[0] === '/' && ! trusted) {
            title += ' <span class="skychat-button-info">(' + escapeHtml(action.split(' ')[0]) + ')</span>';
        }
        return `<button class="skychat-button" title="${action}" data-action="${action}" data-trusted="${trusted}">${title}</button>`;
    }

    /**
     * Replace images
     * @param message
     * @param remove
     * @param trusted Whether to limit the number of replacements
     */
    public replaceImages(message: string, remove?: boolean, trusted?: boolean): string {
        let matches = message.match(new RegExp(Config.LOCATION + '/uploads/([-\\/._a-zA-Z0-9]+)\\.(png|jpg|jpeg|gif)', 'g'));
        if (! matches) {
            return message;
        }
        matches = Array.from(new Set(matches));
        let count = 0;
        for (const imageUrl of matches) {
            const html = `<a class="skychat-image" href="${imageUrl}" target="_blank"><img src="${imageUrl}"></a>`;
            // If removing images
            if (remove) {
                // Remove all image urls without any limit
                message = message.replace(new RegExp(imageUrl, 'g'), '');
            } else {
                // If replacing images by html, replace within limit
                message = message.replace(new RegExp(imageUrl, 'g'), () => {
                    ++ count;
                    if (! trusted && count > MessageFormatter.IMAGE_REPLACE_LIMIT) {
                        return imageUrl;
                    }
                    return html;
                });
            }
            // If limit was reached when replacing this image, do not replace the next ones
            if (! trusted && count < MessageFormatter.IMAGE_REPLACE_LIMIT) {
                break;
            }
        }
        return message;
    }

    /**
     * Replace RisiBank images
     * @param message
     */
    public replaceRisiBankStickers(message: string, remove?: boolean): string {
        const risibankImageRegExp = /https:\/\/api.risibank.fr\/cache\/stickers\/d([0-9]+)\/([0-9]+)-([A-Za-z0-9-_\[\]]+?)\.(jpg|jpeg|gif|png)/g;
        const replaceStr = '<a class="skychat-risibank-sticker" href="//risibank.fr/stickers/$2-0" target="_blank"><img src="//api.risibank.fr/cache/stickers/d$1/$2-$3.$4"></a>';
        if (remove) {
            return message.replace(risibankImageRegExp, '');
        }
        return message.replace(risibankImageRegExp, replaceStr);
    }

    /**
     * Replace stickers in a raw message
     * @param message
     */
    public replaceStickers(message: string, remove?: boolean): string {
        for (const code in StickerManager.stickers) {
            const sticker = StickerManager.stickers[code];
            message = message.replace(new RegExp(MessageFormatter.escapeRegExp(code), 'g'), remove ? '' : `<img class="skychat-sticker" title="${code}" alt="${code}" src="${sticker}">`);
        }
        return message;
    }

    /**
     * Replace links in the message
     * @param text
     */
    public replaceLinks(text: string, remove?: boolean): string {
        let regExp = /(?:^|[ ])((http|https):\/\/[\w?=&.\/-;#~%+@,\[\]:!-]+(?![\w\s?&.\/;#~%"=+@,\[\]:!-]*>))/ig;
        if (remove) {
            text = text.replace(regExp, '');
        } else {
            text = text.replace(regExp, ($0, $1, $2, $3, $4, $5, $6) => {
                const start = $0[0] === 'h' ? '' : ' ';
                return `${start}<a class="skychat-link" target="_blank" rel="nofollow" href="${$1}">${$1}</a>`;
            });
        }
        return text;
    }
}
