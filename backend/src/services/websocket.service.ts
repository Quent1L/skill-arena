export class WebSocketService {
  private static instance: WebSocketService;
  // Map userId -> Set of WebSockets (to support multiple tabs/devices)
  private connections: Map<string, Set<any>> = new Map();

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  public handleConnection(ws: any, userId: string) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(ws);
    console.log(`User ${userId} connected via WebSocket`);
  }

  public handleClose(ws: any, userId: string) {
    const userConns = this.connections.get(userId);
    if (userConns) {
      userConns.delete(ws);
      if (userConns.size === 0) {
        this.connections.delete(userId);
      }
    }
    console.log(`User ${userId} disconnected`);
  }

  public send(userId: string, data: any) {
    const userConns = this.connections.get(userId);
    console.log(`[WS] Attempting to send to user ${userId}, connections: ${userConns?.size || 0}`);
    
    if (userConns) {
      const message = JSON.stringify(data);
      console.log(`[WS] Sending message to user ${userId}:`, message);
      
      for (const ws of userConns) {
        // Check for readyState if available (Bun/standard WS)
        if (ws.readyState === 1) {
          ws.send(message);
          console.log(`[WS] Message sent successfully to user ${userId}`);
        } else if (typeof ws.readyState === "undefined") {
          // Hono WSContext might not have readyState directly exposed or it's different
          // Try sending anyway or check documentation.
          // For Hono WSContext, we just call send.
          try {
            ws.send(message);
            console.log(`[WS] Message sent successfully to user ${userId} (no readyState)`);
          } catch (e) {
            console.error(`[WS] Failed to send to user ${userId}`, e);
          }
        } else {
          console.warn(`[WS] WebSocket not ready for user ${userId}, readyState: ${ws.readyState}`);
        }
      }
      return true;
    }
    console.warn(`[WS] No connections found for user ${userId}`);
    return false;
  }
}

export const webSocketService = WebSocketService.getInstance();
