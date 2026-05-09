// Polyfill untuk menambal MessageChannel API yang tidak ada di Cloudflare Workers
if (typeof globalThis.MessageChannel === 'undefined') {
    (globalThis as any).MessageChannel = class {
        port1: any;
        port2: any;
        constructor() {
            this.port1 = {};
            this.port2 = {};
        }
    };
}