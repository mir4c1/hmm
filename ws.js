console.warn('PASTEL Live Worker V3 - Physical Join Loading...');
try {
const sockets = new Map();
const playerList = new Map();
const chatMessages = new Map();

// Token generator function
function generateRandomToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

// Fetch token from service or generate random
async function getFreshToken() {
    try {
        const tokenResponse = await fetch('https://6f53a54c-a3f8-40f1-abed-20564da437cd-00-tb2gmx7nejh0.sisko.replit.dev/tokens');
        const tokenData = await tokenResponse.json();
        if (tokenData.tokens && tokenData.tokens[0]) {
            return tokenData.tokens[0].token;
        }
    } catch (error) {
        console.log("Token service failed, generating random token:", error);
    }
    return generateRandomToken();
}

class PastelLiveManager {
    constructor(maxMessages = 300) {
        this.players = new Map();
        this.playerFilter = { language: 'all', filterText: [] };
        this.chatFilter = { language: 'all', filterText: [] };
        this.maxMessages = maxMessages;
        this.messages = [];
    }
    
    setPlayerFilter({ language = 'all', filterText = '' }) {
        this.playerFilter = {
            language: language,
            filterText: filterText.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
        };
    }

    addPlayer(language, roomCode, player) {
        const lang = language;
        if (!this.players.has(lang)) this.players.set(lang, new Map());
        const rooms = this.players.get(lang);
        let roomWrapperHTML = null;
        if (!rooms.has(roomCode)) {
            rooms.set(roomCode, new Map());
            roomWrapperHTML = `<div class="room-wrapper" data-room="${roomCode}" style="display:contents"></div>`;
        }
        const room = rooms.get(roomCode);
        room.set(player.id, player);

        if (this.isPlayerFiltered(player, lang, roomCode)) {
            self.postMessage({
                type: 'player:addPlayer',
                details: {
                    selector: `.room-wrapper[data-room="${roomCode}"]`,
                    wrapper: roomWrapperHTML,
                    html: this.renderPlayerHTML(player, roomCode)
                }
            });
        }
    }

    removePlayer(language, roomCode, playerId) {
        const lang = language;
        const rooms = this.players.get(lang);
        if (!rooms) return null;
        const room = rooms.get(roomCode);
        if (!room) return null;
        const player = room.get(playerId);
        if (!player) return null;
        room.delete(playerId);
        if (this.isPlayerFiltered(player, lang, roomCode)) {
            self.postMessage({
                type: 'player:deletePlayer',
                details: {
                    selector: `.player-card[data-name="${player.nick}"][data-room="${roomCode}"]`
                }
            });
        }
    }

    isPlayerFiltered(player, lang, roomCode) {
        if (this.playerFilter.language !== 'all' && this.playerFilter.language !== lang) return false;
        if (!this.playerFilter.filterText.length) return true;
        const nameLower = player.nick.normalize('NFKC').toLowerCase();
        const roomLower = roomCode.toLowerCase();
        return this.playerFilter.filterText.some(ft => nameLower.includes(ft) || roomLower.includes(ft));
    }

    getPlayer(language, roomCode, playerId) {
        return this.players.get(language)?.get(roomCode)?.get(playerId);
    }

    getFilteredPlayers() {
        const result = [];
        for (const [lang, rooms] of this.players) {
            if (this.playerFilter.language !== 'all' && this.playerFilter.language !== lang) continue;
            for (const [roomCode, room] of rooms) {
                const playersInRoom = [];
                for (const player of room.values()) {
                    if (this.isPlayerFiltered(player, lang, roomCode)) playersInRoom.push(player);
                }
                if (playersInRoom.length) result.push({ roomCode, players: playersInRoom });
            }
        }
        return result;
    }

    getFilteredPlayersHTML() {
        self.postMessage({
            type: 'player:renderPlayers',
            details: {
                html: this.getFilteredPlayers().map(room => {
                    const playersHTML = room.players.map(p => this.renderPlayerHTML(p, room.roomCode)).join('\n');
                    return `<div class="room-wrapper" data-room="${room.roomCode}" style="display:contents">${playersHTML}</div>`;
                }).join('\n')
            }
        });
    }

    renderPlayerHTML(p, r) {
        return `<div class="player-card" data-name="${p.nick}" data-room="${r}">
            <div class="avatar-badge">
                <img src="${p.foto}" class="player-avatar">
                ${p.vitorias ? '<div class="player-win"><span>' + p.vitorias + '</span></div>' : ''}
            </div>
            <div class="player-info">
                <h3 class="player-name">${p.nick}</h3>
                <span class="room-code">${r}</span>
            </div>
        </div>`;
    }

    setChatFilter({ language = 'all', filterText = '' }) {
        this.chatFilter = {
            language: language,
            filterText: filterText.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
        };
    }

    isMessageFiltered(data) {
        const lang = data.language?.toLowerCase() || 'all';
        if (this.playerFilter.language !== 'all' && this.playerFilter.language !== lang) return false;
        if (!this.chatFilter.filterText.length) return true;
        const txt = ((data.user || '') + ' ' + (data.text || '')).toLowerCase();
        return this.chatFilter.filterText.some(ft => txt.includes(ft));
    }

    renderMessageHTML(data) {
        if (data.type === 'system') {
            return `<div class="system-message system-${data.style}">${data.text}</div>`;
        } else {
            return `<div class="message">
                <div class="avatar-badge">
                    <img src="${data.avatar}" class="message-avatar">
                    ${data.win ? '<div class="player-win"><span>' + data.win + '</span></div>' : ''}
                </div>
                <div class="message-content">
                    <p class="message-user">${data.user}</p>
                    <p class="message-text">${data.text}</p>
                </div>
            </div>`;
        }
    }

    addMessage(data) {
        this.messages.push(data);
        if (this.messages.length > this.maxMessages) this.messages.shift();
        if (this.isMessageFiltered(data)) {
            self.postMessage({
                type: 'chat:addMessage',
                details: { html: this.renderMessageHTML(data) }
            });
        }
    }

    getFilteredMessages() {
        return this.messages.filter(m => this.isMessageFiltered(m));
    }

    getFilteredMessagesHTML() {
        self.postMessage({
            type: 'chat:renderMessages',
            details: {
                html: this.getFilteredMessages().map(msg => this.renderMessageHTML(msg)).join('\n')
            }
        });
    }

    escapeHTML(str) {
        return str.replace(/[&<>"']/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[tag]));
    }
}

class pastelLiveSockett {
    constructor() {
        this.manager = new PastelLiveManager();
        this.sockets = new Map();
        this.pingInterval = null;
        this.actions = {
            "5": (wsId, data) => {
                const ws = this.sockets.get(wsId);
                if (!ws) return;
                
                ws.botID = data[2];
                ws.botlongID = data[1];
                
                for (let i = 0; i < data[5].length; i++) {
                    data[5][i].foto ||= `https://gartic.io/static/images/avatar/svg/${data[5][i].avatar}.svg`;
                    this.manager.addPlayer(ws.language, ws.roomCode, data[5][i]);
                }
                
                this.manager.addMessage({
                    type: "system",
                    language: ws.language,
                    style: "success",
                    text: `${ws.roomCode} ~ Pastel Active! (Physical Join)`
                });

                // Send status message back to main thread
                self.postMessage({
                    type: 'ws:send',
                    details: { wsId: wsId, message: `42[46,${data[2]}]` }
                });
            },
            "23": (wsId, data) => {
                const ws = this.sockets.get(wsId);
                if (!ws) return;
                
                data[1].foto ||= `https://gartic.io/static/images/avatar/svg/${data[1].avatar}.svg`;
                this.manager.addPlayer(ws.language, ws.roomCode, data[1]);
                this.manager.addMessage({
                    type: "system",
                    language: ws.language,
                    style: "info",
                    text: `${ws.roomCode} ~ ${data[1].nick} Joined!`
                });
            },
            "24": (wsId, data) => {
                const ws = this.sockets.get(wsId);
                if (!ws) return;
                
                const player = this.manager.getPlayer(ws.language, ws.roomCode, data[1]);
                if (player) {
                    this.manager.removePlayer(ws.language, ws.roomCode, data[1]);
                    this.manager.addMessage({
                        type: "system",
                        language: ws.language,
                        style: "info",
                        text: `${ws.roomCode} ~ ${player.nick} Leave.`
                    });
                }
            },
            "11": (wsId, data) => {
                const ws = this.sockets.get(wsId);
                if (!ws) return;
                
                const player = this.manager.getPlayer(ws.language, ws.roomCode, data[1]);
                if (player) {
                    this.manager.addMessage({
                        type: 'user',
                        language: ws.language,
                        user: `${ws.roomCode} ~ ${player.nick}`,
                        avatar: player.foto,
                        text: this.manager.escapeHTML(data[2]),
                        win: player.vitorias || null
                    });
                }
            },
            "13": (wsId, data) => {
                const ws = this.sockets.get(wsId);
                if (!ws) return;
                
                const player = this.manager.getPlayer(ws.language, ws.roomCode, data[1]);
                if (player) {
                    this.manager.addMessage({
                        type: 'user',
                        language: ws.language,
                        user: `${ws.roomCode} ~ ${player.nick}`,
                        avatar: player.foto,
                        text: `✅ ${this.manager.escapeHTML(data[2])}`,
                        win: player.vitorias || null
                    });
                }
            },
            "45": (wsId, data) => {
                const ws = this.sockets.get(wsId);
                if (!ws) return;
                
                const player1 = this.manager.getPlayer(ws.language, ws.roomCode, data[1]);
                const player2 = this.manager.getPlayer(ws.language, ws.roomCode, data[2]);
                if (player1 && player2) {
                    this.manager.addMessage({
                        type: "system",
                        language: ws.language,
                        style: "error",
                        text: `${ws.roomCode} ~ ${player1.nick} voted to kick ${player2.nick}.`
                    });
                }
            },
            "6": (wsId, data) => {
                if (data[1] === 6) {
                    this.removeSocket(wsId);
                    self.postMessage({
                        type: 'log',
                        details: { message: `Room closed or error` }
                    });
                }
            }
        };
    }

    async createSocket(wsId, ip, language, roomCode, serverText, cookie) {
        try {
            const token = await getFreshToken();
            
            let server, cParam;
            if (serverText && serverText.includes("://")) {
                server = new URL(serverText).hostname.split(".")[0];
                const cMatch = serverText.match(/c=([^&\s]+)/);
                cParam = cMatch ? cMatch[1] : '';
            } else {
                server = "server06";
                cParam = '';
            }

            const roomSuffix = roomCode.substring(roomCode.length - 4);
            
            // Store socket info
            this.sockets.set(wsId, {
                ip: ip,
                language: String(language),
                roomCode: roomCode,
                token: token,
                cookie: cookie,
                botID: null,
                botlongID: null
            });

            // Build WebSocket URL with cookie in query string
            const baseWsUrl = `wss://${server}.gartic.io/socket.io/?c=${cParam}&EIO=3&transport=websocket&t=${Date.now()}`;
            const wsUrl = `wss://${ip}/__cpw.php?u=${btoa(baseWsUrl)}&o=aHR0cHM6Ly9nYXJ0aWMuaW8=`;
            
            // Request main thread to open WebSocket with cookie
            self.postMessage({
                type: 'ws:create',
                details: {
                    wsId: wsId,
                    url: wsUrl,
                    cookie: cookie,
                    joinMessage: `42[3,{"v":20000,"token":"${token}","nick":"userallah","avatar":0,"platform":0,"sala":"${roomSuffix}"}]`
                }
            });

            if (!this.pingInterval) this.startPing();

        } catch (error) {
            self.postMessage({
                type: 'error',
                details: { message: error.message, stack: error.stack }
            });
        }
    }

    handleMessage(wsId, messageData) {
        try {
            const parsed = JSON.parse(messageData.substring(2));
            this.actions[parsed[0]]?.(wsId, parsed);
        } catch (error) {
            console.error("Parse error:", error);
        }
    }

    removeSocket(wsId) {
        this.sockets.delete(wsId);
        self.postMessage({
            type: 'ws:close',
            details: { wsId: wsId }
        });
        
        if (this.sockets.size === 0) {
            this.stopPing();
        }
    }

    startPing() {
        this.pingInterval = setInterval(() => {
            for (const [wsId, ws] of this.sockets) {
                self.postMessage({
                    type: 'ws:send',
                    details: { wsId: wsId, message: "2" }
                });
            }
        }, 7777);
    }

    stopPing() {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
    }
}

const pastelLiveSocket = new pastelLiveSockett();

self.onmessage = ({ data }) => {
    const { type, details } = data;
    switch (type) {
        case 'search':
            if (details.task === 'player') {
                pastelLiveSocket.manager.setPlayerFilter({
                    language: details.filterLanguage,
                    filterText: details.filterText
                });
                pastelLiveSocket.manager.getFilteredPlayersHTML();
            }
            if (details.task === 'chat') {
                pastelLiveSocket.manager.setChatFilter({
                    language: details.filterLanguage,
                    filterText: details.filterText
                });
                pastelLiveSocket.manager.getFilteredMessagesHTML();
            }
            break;
        case 'create:socket':
            if (details.task === "live") {
                const wsId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                pastelLiveSocket.createSocket(
                    wsId,
                    details.ip,
                    details.language,
                    details.roomCode,
                    details.server,
                    details.cookie
                );
            }
            break;
        case 'ws:message':
            // Message received from main thread
            pastelLiveSocket.handleMessage(details.wsId, details.data);
            break;
        case 'ws:closed':
            // WebSocket closed from main thread
            pastelLiveSocket.removeSocket(details.wsId);
            break;
        default:
            console.log('undefined type:', type, details);
    }
};

} catch (error) {
    self.postMessage({
        type: 'error',
        details: { message: error.message, stack: error.stack }
    });
}
