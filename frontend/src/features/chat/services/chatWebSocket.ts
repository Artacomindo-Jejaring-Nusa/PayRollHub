type MessageCallback = (data: any) => void;
type StatusCallback = (status: 'connected' | 'connecting' | 'disconnected') => void;

class ChatWebSocketClient {
  private ws: WebSocket | null = null;
  private subscribedChannels: Set<string> = new Set();
  private listeners: Map<string, Set<MessageCallback>> = new Map();
  private statusListeners: Set<StatusCallback> = new Set();
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private currentStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';

  constructor() {
    // Lazy connect on first subscription or explicit connect
  }

  public getStatus() {
    return this.currentStatus;
  }

  private setStatus(status: 'connected' | 'connecting' | 'disconnected') {
    this.currentStatus = status;
    this.statusListeners.forEach((cb) => cb(status));
  }

  public onStatusChange(cb: StatusCallback) {
    this.statusListeners.add(cb);
    cb(this.currentStatus);
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('connecting');

    try {
      const isHttps = window.location.protocol === 'https:';
      const host = window.location.host;
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      
      // If localhost port 5173, connect to backend WS on 6001 or nginx /ws
      let wsUrl = `${wsProtocol}//${host}/ws`;
      if (window.location.port === '5173') {
        wsUrl = `ws://${window.location.hostname}:6001`;
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.setStatus('connected');
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

        // Re-subscribe all active channels
        this.subscribedChannels.forEach((ch) => {
          this.sendRaw({ action: 'subscribe', channel: ch });
        });

        // Start heartbeat ping
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          this.sendRaw({ action: 'ping' });
        }, 20000);
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const eventName = payload.event;
          const channel = payload.channel;

          // Dispatch to event-specific listeners
          if (eventName && this.listeners.has(eventName)) {
            this.listeners.get(eventName)!.forEach((cb) => cb(payload.data || payload));
          }

          // Dispatch to channel:event listeners
          if (channel && eventName) {
            const key = `${channel}:${eventName}`;
            if (this.listeners.has(key)) {
              this.listeners.get(key)!.forEach((cb) => cb(payload.data || payload));
            }
          }

          // Dispatch to wildcard channel listeners
          if (channel) {
            const key = `${channel}:*`;
            if (this.listeners.has(key)) {
              this.listeners.get(key)!.forEach((cb) => cb(payload));
            }
          }
        } catch (err) {
          // ignore invalid json
        }
      };

      this.ws.onclose = () => {
        this.setStatus('disconnected');
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.setStatus('disconnected');
        if (this.ws) this.ws.close();
      };
    } catch (err) {
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 3000);
  }

  private sendRaw(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public subscribe(channel: string) {
    this.subscribedChannels.add(channel);
    this.connect();
    this.sendRaw({ action: 'subscribe', channel });
  }

  public unsubscribe(channel: string) {
    this.subscribedChannels.delete(channel);
    this.sendRaw({ action: 'unsubscribe', channel });
  }

  public on(eventOrChannelEvent: string, callback: MessageCallback) {
    if (!this.listeners.has(eventOrChannelEvent)) {
      this.listeners.set(eventOrChannelEvent, new Set());
    }
    this.listeners.get(eventOrChannelEvent)!.add(callback);

    return () => {
      const set = this.listeners.get(eventOrChannelEvent);
      if (set) {
        set.delete(callback);
        if (set.size === 0) this.listeners.delete(eventOrChannelEvent);
      }
    };
  }
}

export const chatWs = new ChatWebSocketClient();
