// AuraVoice WebSocket Client

type EventHandler = (data: any) => void;

class AuraSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private token: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private messageBuffer: string[] = [];
  private reconnectAttempts: number = 0;

  constructor() {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.token) {
          if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
            this.reconnectAttempts = 0;
            this.connect(this.token);
          }
        }
      });
      window.addEventListener('online', () => {
        if (this.token) {
          this.reconnectAttempts = 0;
          this.connect(this.token);
        }
      });
    }
  }

  public connect(token: string) {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      return;
    }

    // Always remember the latest token: reconnect, visibility and online handlers rely on it
    this.token = token;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    let wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsUrl) {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8080' : window.location.origin) : 'http://localhost:8080');
      wsUrl = apiBase.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
      if (!wsUrl.includes('/ws')) {
        wsUrl = wsUrl.replace(/\/+$/, '') + '/ws';
      }
    } else {
      // Auto-correct http/https prefixes to ws/wss
      wsUrl = wsUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
      if (!wsUrl.includes('/ws')) {
        wsUrl = wsUrl.replace(/\/+$/, '') + '/ws';
      }
    }

    // Auto-promote ws:// to wss:// if frontend is loaded over HTTPS (prevents Mixed Content blocks)
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && wsUrl.startsWith('ws://')) {
      wsUrl = wsUrl.replace(/^ws:\/\//, 'wss://');
    }

    const separator = wsUrl.includes('?') ? '&' : '?';
    const authenticatedWsUrl = `${wsUrl}${separator}token=${encodeURIComponent(token)}`;

    try {
      const socket = new WebSocket(authenticatedWsUrl);
      this.ws = socket;

      this.ws.onopen = () => {
        if (this.ws !== socket) return;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emitInternal('open', {});

        // Flush any messages buffered while the connection was being established
        while (this.messageBuffer.length > 0) {
          const msg = this.messageBuffer.shift();
          if (msg && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(msg);
          }
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : '';
          const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.type) {
                this.emitInternal(parsed.type, parsed.payload || {});
              }
            } catch (jsonErr) {
              console.warn('Skipping unparsable line in WS frame', jsonErr);
            }
          }
        } catch (err) {
          console.error('Error processing WS message frame', err);
        }
      };

      this.ws.onclose = () => {
        // Ignore close events from sockets that were replaced or intentionally disconnected
        if (this.ws !== socket) return;
        this.ws = null;
        this.isConnecting = false;
        this.emitInternal('close', {});
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.warn('WS Error encountered', error);
      };
    } catch (err) {
      console.error('Failed to initialize WebSocket', err);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.token) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000) + Math.random() * 500;
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  public on(event: string, handler: EventHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  private emitInternal(event: string, data: any) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((h) => h(data));
    }
  }

  public send(type: string, payload: any) {
    const serialized = JSON.stringify({ type, payload });
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(serialized);
    } else {
      // Buffer message to send as soon as connected
      this.messageBuffer.push(serialized);
    }
  }

  public joinQueue(mode: 'voice' | 'text' | 'mystery', preferences: any) {
    this.send('queue:join', { mode, preferences });
  }

  public leaveQueue() {
    this.send('queue:leave', {});
  }

  public nextMatch(mode: 'voice' | 'text' | 'mystery', preferences: any) {
    this.send('match:next', { mode, preferences });
  }

  public sendChat(content: string, sourceLang?: string, targetLang?: string, enableTranslation?: boolean, id?: string) {
    this.send('chat:send', { id, content, sourceLang, targetLang, enableTranslation });
  }

  public sendTyping() {
    this.send('chat:typing', {});
  }

  public requestReveal() {
    this.send('mystery:reveal_request', {});
  }

  public sendGameAction(actionType: string, gameType?: string, data?: any) {
    this.send('game:action', { actionType, gameType, data });
  }

  public sendFriendRequest(friendId: string) {
    this.send('friend:request', { friendId });
  }

  public blockUser(blockedUserId: string) {
    this.send('safety:block', { blockedUserId });
  }

  public directCall(targetUserId: string) {
    this.send('direct:call', { targetUserId });
  }

  public acceptDirectCall(callId: string, callerId: string, roomName: string) {
    this.send('direct:call_accept', { callId, callerId, roomName });
  }

  public rejectDirectCall(callerId: string, callId?: string) {
    this.send('direct:call_reject', { callId, callerId });
  }

  public blockDirectCall(callerId: string, callId?: string) {
    this.send('direct:call_block', { callId, callerId });
  }

  public cancelDirectCall(targetUserId: string, callId?: string) {
    this.send('direct:call_cancel', { callId, targetUserId });
  }

  public reportUser(reportedUserId: string, reason: string, description: string) {
    this.send('safety:report', { reportedUserId, reason, description });
  }

  public disconnect() {
    // Intentional disconnect: forget the token so onclose does not auto-reconnect
    this.token = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      socket.close();
    }
    this.messageBuffer = [];
  }
}

export const socketClient = new AuraSocketClient();
