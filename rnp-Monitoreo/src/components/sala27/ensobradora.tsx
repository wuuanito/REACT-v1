import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Gauge } from 'lucide-react';

// Configuration object with readonly type
const CONFIG = {
  WS: {
    URL: 'ws://192.168.11.16:5000',
    PING_INTERVAL: 30000,
    RECONNECT_DELAY: 3000,
    MAX_RECONNECT_ATTEMPTS: 5,
    NORMAL_CLOSURE_CODE: 1000,
    BACKOFF_MULTIPLIER: 1.5
  },
  MONITOR: {
    DEBOUNCE_DELAY: 100,
    STATE_UPDATE_THRESHOLD: 50,
    TIME_UPDATE_INTERVAL: 1000 // Update every second
  }
} as const;

// Types
interface CremerProps {
  nombre?: string;
  onStatusChange?: (status: ConnectionStatus) => void;
  onError?: (error: Error) => void;
}

interface GPIOStates {
  Verde: boolean;
  Amarillo: boolean;
  Rojo: boolean;
  Contador: boolean;
}

interface WSMessage {
  timestamp: string;
  estados: GPIOStates;
}

type ConnectionStatus = 'Conectado' | 'Desconectado' | 'Reconectando' | 'Error';

// Utility functions
const formatCurrentTime = (): string => {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

// WebSocket Manager Class
class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private backoffDelay = CONFIG.WS.RECONNECT_DELAY;
  private isIntentionalClosure = false;

  constructor(
    private url: string,
    private onMessage: (data: WSMessage) => void,
    private onStatusChange: (status: ConnectionStatus) => void,
    private onError: (error: Error) => void
  ) {}

  connect(): void {
    if (this.ws?.readyState === WebSocket.CONNECTING) return;

    try {
      this.isIntentionalClosure = false;
      this.ws = new WebSocket(this.url);
      this.setupEventListeners();
      this.startPingInterval();
    } catch (error) {
      this.handleError(new Error(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = this.handleOpen.bind(this);
    this.ws.onclose = this.handleClose.bind(this);
    this.ws.onerror = (event: Event) => {
      const wsError = event instanceof ErrorEvent ? event.error : new Error('WebSocket error');
      this.handleError(wsError);
    };
    this.ws.onmessage = this.handleMessage.bind(this);
  }

  private handleOpen(): void {
    this.reconnectAttempts = 0;
    this.backoffDelay = CONFIG.WS.RECONNECT_DELAY;
    this.onStatusChange('Conectado');
  }

  private handleClose(event: CloseEvent): void {
    this.cleanup();
    if (!this.isIntentionalClosure && event.code !== CONFIG.WS.NORMAL_CLOSURE_CODE) {
      this.scheduleReconnect();
    } else {
      this.onStatusChange('Desconectado');
    }
  }

  private handleError(error: Error): void {
    console.error('[WebSocketManager] Error:', error);
    this.onError(error);
    this.onStatusChange('Error');
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data) as WSMessage;
      this.onMessage(data);
    } catch (error) {
      this.handleError(
        new Error(`Message processing error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      );
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= CONFIG.WS.MAX_RECONNECT_ATTEMPTS) {
      this.handleError(new Error(`Maximum reconnection attempts (${CONFIG.WS.MAX_RECONNECT_ATTEMPTS}) reached`));
      return;
    }

    this.onStatusChange('Reconectando');
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = this.backoffDelay * Math.pow(CONFIG.WS.BACKOFF_MULTIPLIER, this.reconnectAttempts);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`[WebSocketManager] Reconnection attempt ${this.reconnectAttempts} after ${delay}ms`);
      this.connect();
    }, delay);
  }

  private startPingInterval(): void {
    this.cleanup();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
        } catch (error) {
          this.handleError(new Error('Ping error'));
        }
      }
    }, CONFIG.WS.PING_INTERVAL);
  }

  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  disconnect(): void {
    this.isIntentionalClosure = true;
    this.cleanup();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.close(CONFIG.WS.NORMAL_CLOSURE_CODE, 'Normal disconnection');
      } catch (error) {
        console.error('[WebSocketManager] Disconnection error:', error);
      }
      this.ws = null;
    }
  }
}

// Subcomponents
const StatusLight: React.FC<{ active: boolean; color: string }> = memo(({ active, color }) => (
  <div className={`luz ${color} ${active ? 'activa' : ''}`} />
));

StatusLight.displayName = 'StatusLight';

const ConnectionStatus: React.FC<{ status: ConnectionStatus }> = memo(({ status }) => (
  <div className={`conexion ${status === 'Conectado' ? 'activa' : 'inactiva'}`}>
    <div className="dot" />
    <span>WS: {status}</span>
  </div>
));

ConnectionStatus.displayName = 'ConnectionStatus';

// Main Component
const Ensobradora: React.FC<CremerProps> = memo(({ 
  nombre = "Ensobradora",
  onStatusChange,
  onError 
}) => {
  const [gpioStates, setGpioStates] = useState<GPIOStates>({
    Verde: false,
    Amarillo: false,
    Rojo: false,
    Contador: false
  });
  const [status, setStatus] = useState<ConnectionStatus>('Desconectado');
  const [currentTime, setCurrentTime] = useState<string>(formatCurrentTime());
  
  const wsManager = useRef<WebSocketManager | null>(null);
  const lastStateUpdate = useRef<number>(Date.now());

  // Handlers
  const handleMessage = useCallback((data: WSMessage) => {
    const now = Date.now();
    if (now - lastStateUpdate.current > CONFIG.MONITOR.STATE_UPDATE_THRESHOLD) {
      setGpioStates(data.estados);
      lastStateUpdate.current = now;
    }
  }, []);

  const handleStatusChange = useCallback((newStatus: ConnectionStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  const handleError = useCallback((error: Error) => {
    console.error('[Cremer] Error:', error);
    onError?.(error);
  }, [onError]);

  // WebSocket Effect
  useEffect(() => {
    wsManager.current = new WebSocketManager(
      CONFIG.WS.URL,
      handleMessage,
      handleStatusChange,
      handleError
    );
    wsManager.current.connect();

    const handleOnline = () => wsManager.current?.connect();
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      wsManager.current?.disconnect();
    };
  }, [handleMessage, handleStatusChange, handleError]);

  // Current Time Update Effect
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(formatCurrentTime());
    }, CONFIG.MONITOR.TIME_UPDATE_INTERVAL);

    return () => clearInterval(intervalId);
  }, []);

  // Memoized components
  const renderHeader = React.useMemo(() => (
    <div className="maquina-header">
      <div className="header-left">
        <Gauge className="maquina-icon" size={20} />
        <h2>{nombre}</h2>
      </div>
      <div className="semaforo">
        <StatusLight active={gpioStates.Rojo} color="roja" />
        <StatusLight active={gpioStates.Amarillo} color="amarilla" />
        <StatusLight active={gpioStates.Verde} color="verde" />
      </div>
    </div>
  ), [nombre, gpioStates]);

  const renderContent = React.useMemo(() => (
    <div className="timers-container">
      <div className={`timer ${status === 'Conectado' ? 'active' : status === 'Error' ? 'stopped' : ''}`}>
        <div className="timer-left">
          <Gauge className="timer-icon" />
          <span className="timer-label">Estado</span>
        </div>
        <div className="timer-value">{status}</div>
      </div>
    </div>
  ), [status]);

  const renderFooter = React.useMemo(() => (
    <div className="footer">
      <ConnectionStatus status={status} />
      <span className="current-time">
        {currentTime}
      </span>
    </div>
  ), [status, currentTime]);

  return (
    <div 
      className="maquina-card"
      role="button"
      tabIndex={0}
      aria-label={`Máquina ${nombre}`}
    >
      {renderHeader}
      {renderContent}
      {renderFooter}
    </div>
  );
});

Ensobradora.displayName = 'Ensobradora';

export default Ensobradora;