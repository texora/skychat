import { useToast } from "vue-toastification";
import { defineStore } from 'pinia'
import { SkyChatClient } from '../../../api/client.ts';

// Connect to SkyChatClient
const protocol = document.location.protocol === 'http:' ? 'ws' : 'wss';
const url = protocol + '://' + document.location.host;
const client = new SkyChatClient(url);


export const useClientStore = defineStore('client', {

    state: () => ({

        /**
         * Accumulated client state from SkyChatClient
         */
        state: client.state,

        /**
         * Messages that are currently shown in the chat
         */
        messages: [],
    }),

    getters: {

        /**
         * Track only the last received message. Useful to be used in a watcher.
         */
        lastMessage: state => state.messages[state.messages.length - 1] || null,
    },

    actions: {

        /**
         * Initialize client (subscribe to relevant events) & make initial socket connection
         */
        init: function() {

            // On global client state changed
            client.on('update', () => {
                // Room id changed
                if (this.state.roomId !== client.state.roomId) {
                    // Clear messages
                    this.messages = [];
                }
                this.state = client.state;
            });

            // Audio received
            client.on('audio', blob => {
                new Audio(URL.createObjectURL(blob)).play();
            });

            // On new message
            client.on('message', message => {
                this.messages.push(message);
            });

            // On new messages
            client.on('messages', messages => {
                // Filter messages we already have, if any
                messages = messages.filter(message => message.id === 0 || ! this.messages.find(m => m.id === message.id));
                // Prepend new messages (we always get previous messages in this event)
                this.messages = messages.concat(this.messages);
            });

            // Message edit
            client.on('message-edit', message => {
                const messageIndex = this.messages.findIndex(m => m.id === message.id);
                if (messageIndex === -1) {
                    return;
                }
                this.messages[messageIndex] = message;
            });

            client.on('info', info => {
                const toast = useToast();
                toast.info(info);
            });
            client.on('error', error => {
                const toast = useToast();
                toast.error(error);
            });
            client.connect();
        },

        /**
         * Join a given room
         * @param {number} roomId 
         */
        join: function(roomId) {
            this.messages = [];
            client.join(roomId);
        },

        /**
         * Load previous messages
         */
        loadPreviousMessages: function() {
            // Find first message with non-zero id,
            // Because we need to give this reference to the server to get messages prior to it
            const realMessage = this.messages.find(m => m.id);
            if (! realMessage) {
                return false;
            }
            this.sendMessage('/messagehistory ' + realMessage.id);
        },

        /**
         * Login
         * @param {string} username 
         * @param {string} password 
         */
        login: ({ username, password }) => {
            client.login(username, password);
        },

        /**
         * Logout
         */
        logout: () => {
            client.logout();
        },

        /**
         * Register
         */
        register: ({ username, password }) => {
            client.register(username, password);
        },

        /**
         * Send a message to the server
         * @param {string} message
         */
        sendMessage: (message) => {
            client.sendMessage(message);
        },

        /**
         * Send an audio message to the server
         * @param {Blob} blob 
         */
        sendAudio: blob => {
            client.sendAudio(blob);
        },

        /**
         * Send user cursor position
         */
        sendCursorPosition: (x, y) => {
            client.sendCursorPosition(x, y);
        },

        /**
         * Send a last message seen notification
         * @param messageId
         */
        notifySeenMessage(messageId) {
            client.notifySeenMessage(messageId);
        },
    },
});
