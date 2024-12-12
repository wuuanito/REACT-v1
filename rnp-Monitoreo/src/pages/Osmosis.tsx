import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { AlertTriangle, Activity, Server, Droplet, Mail } from 'lucide-react';

// Types
type SignalKey = 'AlertaRoja' | 'Demanda' | 'FalloEquipo' | 'DepositoBajo';

interface SignalStates {
  AlertaRoja: boolean;
  Demanda: boolean;
  FalloEquipo: boolean;
  DepositoBajo: boolean;
}

interface WSMessage {
  timestamp: string;
  estados: SignalStates;
}

interface AlertConfig {
  key: SignalKey;
  label: string;
  icon: React.ElementType;
  description: string;
  bgColor: string;
  activeColor: string;
}

interface NotificationMessage {
  id: string;
  type: 'error' | 'warning' | 'success' | 'alert';
  message: string;
  timestamp: number;
}

interface EmailNotification {
  subject: string;
  message: string;
}

// Configuration
const CONFIG = {
  ws: {
    url: 'ws://192.168.20.105:8765',
    initialReconnectDelay: 1000,
    maxReconnectDelay: 30000,
    reconnectBackoffMultiplier: 1.5,
    maxReconnectAttempts: 10,
    pingInterval: 30000,
    pongTimeout: 5000,
  },
  email: {
    url: 'http://localhost:4000/notify',
    retryAttempts: 3,
    retryDelay: 1000,
  },
  notifications: {
    maxNotifications: 5,
    displayDuration: 5000,
  },
  alerts: [
    {
      key: 'DepositoBajo',
      label: 'Depósito Bajo',
      icon: Droplet,
      description: 'Nivel de depósito por debajo del límite',
      bgColor: '#fef2f2',
      activeColor: '#ef4444',
    },
    {
      key: 'AlertaRoja',
      label: 'Alerta Roja',
      icon: AlertTriangle,
      description: 'Situación crítica detectada',
      bgColor: '#fef2f2',
      activeColor: '#dc2626',
    },
    {
      key: 'Demanda',
      label: 'Demanda',
      icon: Activity,
      description: 'Sistema en demanda activa',
      bgColor: '#fffbeb',
      activeColor: '#f59e0b',
    },
    {
      key: 'FalloEquipo',
      label: 'Fallo Equipo',
      icon: Server,
      description: 'Detectado fallo en el equipamiento',
      bgColor: '#faf5ff',
      activeColor: '#7c3aed',
    },
  ] as AlertConfig[],
} as const;

// Email Service
class EmailService {
  private static async sendNotification({ subject, message }: EmailNotification, retryCount = 0): Promise<boolean> {
    try {
      const response = await fetch(CONFIG.email.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message }),
      });

      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      return true;

    } catch (error) {
      console.error('Error enviando email:', error);
      
      if (retryCount < CONFIG.email.retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.email.retryDelay));
        return EmailService.sendNotification({ subject, message }, retryCount + 1);
      }
      
      return false;
    }
  }

  public static async notify(alertConfig: AlertConfig): Promise<boolean> {
    const notification: EmailNotification = {
      subject: `Sistema Osmosis - ${alertConfig.label}`,
      message: `${alertConfig.label}: ${alertConfig.description}`,
    };
    
    return await this.sendNotification(notification);
  }
}

// WebSocket Service
class StableWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectDelay: number = CONFIG.ws.initialReconnectDelay;
  private reconnectTimeoutId: number | null = null;
  private pingIntervalId: number | null = null;
  private pongTimeoutId: number | null = null;
  private forceClosed = false;
  private isComponentMounted = true;

  constructor(
    private url: string,
    private onMessage: (event: MessageEvent) => void,
    private onStatusChange: (status: string) => void,
    private onReconnectAttempt: (attempts: number) => void
  ) {}

  public connect(): void {
    if (this.ws?.readyState === WebSocket.CONNECTING) return;

    try {
      this.ws = new WebSocket(this.url);
      this.setupEventListeners();
      this.onStatusChange('Conectando...');
    } catch (error) {
      this.handleError(error);
    }
  }

  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      if (!this.isComponentMounted) return;
      
      this.onStatusChange('Conectado');
      this.reconnectAttempts = 0;
      this.reconnectDelay = CONFIG.ws.initialReconnectDelay;
      this.startPingInterval();
    };

    this.ws.onmessage = (event) => {
      if (event.data === 'pong') {
        this.handlePong();
      } else {
        this.onMessage(event);
      }
    };

    this.ws.onerror = () => {
      this.handleError(new Error('Error de conexión WebSocket'));
    };

    this.ws.onclose = () => {
      this.cleanup();
      if (!this.forceClosed) {
        this.scheduleReconnect();
      }
    };
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingIntervalId = window.setInterval(() => {
      this.sendPing();
    }, CONFIG.ws.pingInterval);
  }

  private stopPingInterval(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  private sendPing(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send('ping');
      this.pongTimeoutId = window.setTimeout(() => {
        this.handlePongTimeout();
      }, CONFIG.ws.pongTimeout);
    }
  }

  private handlePong(): void {
    if (this.pongTimeoutId) {
      clearTimeout(this.pongTimeoutId);
      this.pongTimeoutId = null;
    }
  }

  private handlePongTimeout(): void {
    this.onStatusChange('Timeout - Reconectando...');
    this.reconnect();
  }

  private handleError(error: any): void {
    console.error('Error WebSocket:', error);
    this.onStatusChange('Error - Reconectando...');
    this.reconnect();
  }

  private scheduleReconnect(): void {
    if (!this.isComponentMounted) return;
    
    if (this.reconnectAttempts >= CONFIG.ws.maxReconnectAttempts) {
      this.onStatusChange('Error de conexión - Recargar página');
      return;
    }

    this.reconnectTimeoutId = window.setTimeout(() => {
      this.reconnect();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(
      this.reconnectDelay * CONFIG.ws.reconnectBackoffMultiplier,
      CONFIG.ws.maxReconnectDelay
    );
  }

  private reconnect(): void {
    if (!this.isComponentMounted) return;
    
    this.cleanup();
    this.reconnectAttempts++;
    this.onReconnectAttempt(this.reconnectAttempts);
    this.connect();
  }

  private cleanup(): void {
    this.stopPingInterval();
    
    if (this.pongTimeoutId) {
      clearTimeout(this.pongTimeoutId);
      this.pongTimeoutId = null;
    }
    
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  public disconnect(): void {
    this.isComponentMounted = false;
    this.forceClosed = true;
    this.cleanup();
  }
}

// Memoized Components
const StatusIndicator = memo<{ active: boolean }>(({ active }) => (
  <div className={`status-indicator ${active ? 'active' : ''}`} />
));
StatusIndicator.displayName = 'StatusIndicator';

const AlertPanel = memo<{ config: AlertConfig; active: boolean }>(({ config, active }) => {
  const Icon = config.icon;
  
  return (
    <div className={`alert-panel ${active ? 'active' : ''}`}
         style={{
           backgroundColor: active ? config.activeColor : config.bgColor,
           color: active ? '#ffffff' : '#000000',
         }}>
      <StatusIndicator active={active} />
      <Icon size={24} />
      <div className="alert-content">
        <div className="alert-title">{config.label}</div>
        <div className="alert-description">{config.description}</div>
      </div>
    </div>
  );
});
AlertPanel.displayName = 'AlertPanel';

const NotificationPanel = memo<{ notifications: NotificationMessage[] }>(({ notifications }) => (
  <div className="notification-panel">
    {notifications.map((notification) => (
      <div
        key={notification.id}
        className={`notification-item ${notification.type}`}
      >
        <div className="notification-message">{notification.message}</div>
      </div>
    ))}
  </div>
));
NotificationPanel.displayName = 'NotificationPanel';

const OsmosisMonitor: React.FC = () => {
  const [signals, setSignals] = useState<SignalStates>({
    AlertaRoja: false,
    Demanda: false,
    FalloEquipo: false,
    DepositoBajo: false,
  });
  const [connectionStatus, setConnectionStatus] = useState<string>('Iniciando...');
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  
  const wsRef = useRef<StableWebSocket | null>(null);
  const isComponentMounted = useRef(true);

  const addNotification = useCallback((type: NotificationMessage['type'], message: string) => {
    if (!isComponentMounted.current) return;

    const notification: NotificationMessage = {
      id: Math.random().toString(36).substring(2),
      type,
      message,
      timestamp: Date.now(),
    };

    setNotifications(prev => {
      const newNotifications = [notification, ...prev].slice(0, CONFIG.notifications.maxNotifications);
      return newNotifications.sort((a, b) => b.timestamp - a.timestamp);
    });

    setTimeout(() => {
      if (isComponentMounted.current) {
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
      }
    }, CONFIG.notifications.displayDuration);
  }, []);

  const handleSignalChange = useCallback(async (key: SignalKey, value: boolean) => {
    const alertConfig = CONFIG.alerts.find(alert => alert.key === key);
    if (!alertConfig || !value) return;

    addNotification('alert', `${alertConfig.label}: ${alertConfig.description}`);
    
    try {
      const emailSent = await EmailService.notify(alertConfig);
      if (emailSent) {
        addNotification('success', `Email enviado: ${alertConfig.label}`);
      } else {
        addNotification('error', `Error al enviar email: ${alertConfig.label}`);
      }
    } catch (error) {
      console.error('Error en notificación:', error);
      addNotification('error', 'Error al enviar notificación');
    }
  }, [addNotification]);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WSMessage = JSON.parse(event.data);
      if (!message.estados) {
        throw new Error('Mensaje sin datos de estados');
      }

      setSignals(prevSignals => {
        const newSignals = { ...message.estados };
        Object.entries(newSignals).forEach(([key, value]) => {
          if (value !== prevSignals[key as SignalKey]) {
            handleSignalChange(key as SignalKey, value);
          }
        });
        return newSignals;
      });

      setLastUpdate(message.timestamp);
    } catch (error) {
      console.error('Error en mensaje:', error);
      addNotification('error', 'Error al procesar mensaje del servidor');
    }
  }, [handleSignalChange, addNotification]);

  useEffect(() => {
    isComponentMounted.current = true;
    
    wsRef.current = new StableWebSocket(
      CONFIG.ws.url,
      handleMessage,
      setConnectionStatus,
      setReconnectAttempts
    );
    wsRef.current.connect();

    return () => {
      isComponentMounted.current = false;
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
    };
  }, [handleMessage]);

  return (
    <div className="osmosis-container">
      <style>
        {`
          .osmosis-container {
            min-height: 100vh;
            background-color: #f3f4f6;
            padding: 2rem;
            display: flex;
            justify-content: center;
            align-items: center;
          }

          .monitor-panel {
            background-color: white;
            border-radius: 0.75rem;
            padding: 2rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            max-width: 1024px;
            width: 100%;
          }

          .monitor-title {
            font-size: 1.5rem;
            font-weight: bold;
            color: #2563eb;
            text-align: center;
            margin-bottom: 2rem;
          }

          .monitor-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 2rem;
          }

          @media (min-width: 768px) {
            .monitor-grid {
              grid-template-columns: 1fr 1fr;
            }
              .alerts-container {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .status-panel {
            background-color: #f9fafb;
            padding: 1.5rem;
            border-radius: 0.5rem;
            border: 1px solid #e5e7eb;
          }

          .status-title {
            font-size: 1.125rem;
            font-weight: 600;
            color: #1e40af;
            margin-bottom: 1rem;
          }

          .status-item {
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
            color: #4b5563;
          }

          .status-error {
            color: #dc2626;
            font-weight: 600;
          }

          .status-content {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .status-indicator {
            width: 0.75rem;
            height: 0.75rem;
            border-radius: 50%;
            background-color: #9ca3af;
            transition: background-color 0.3s ease;
          }

          .status-indicator.active {
            background-color: white;
            animation: pulse 2s infinite;
          }

          .alert-panel {
            padding: 1rem;
            border-radius: 0.5rem;
            display: flex;
            align-items: center;
            gap: 1rem;
            transition: all 0.3s ease;
          }

          .alert-panel.active {
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }

          .alert-content {
            flex: 1;
          }

          .alert-title {
            font-weight: 600;
            font-size: 1rem;
            margin-bottom: 0.25rem;
          }

          .alert-description {
            font-size: 0.875rem;
            opacity: 0.9;
          }

          .notification-panel {
            position: fixed;
            top: 1rem;
            right: 1rem;
            z-index: 50;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .notification-item {
            padding: 1rem;
            border-radius: 0.5rem;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            max-width: 20rem;
            animation: slideIn 0.3s ease-out;
          }

          .notification-item.error {
            background-color: #fef2f2;
            border-left: 4px solid #ef4444;
          }

          .notification-item.warning {
            background-color: #fffbeb;
            border-left: 4px solid #f59e0b;
          }

          .notification-item.success {
            background-color: #f0fdf4;
            border-left: 4px solid #22c55e;
          }

          .notification-item.alert {
            background-color: #eff6ff;
            border-left: 4px solid #3b82f6;
          }

          .notification-message {
            font-size: 0.875rem;
            color: #374151;
          }

          .server-info {
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 1px solid #e5e7eb;
          }

          .server-info .status-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.75rem;
            color: #6b7280;
          }

          .server-info .icon {
            width: 1rem;
            height: 1rem;
          }

          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }

          @keyframes slideIn {
            from { 
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }

          /* Responsive adjustments */
          @media (max-width: 640px) {
            .osmosis-container {
              padding: 1rem;
            }

            .monitor-panel {
              padding: 1rem;
            }

            .status-panel {
              padding: 1rem;
            }

            .notification-panel {
              left: 1rem;
              right: 1rem;
            }

            .notification-item {
              max-width: none;
            }
          }
        `}
      </style>

      <div className="monitor-panel">
        <h2 className="monitor-title">
          Sistema de Monitorización Osmosis
        </h2>

        <NotificationPanel notifications={notifications} />

        <div className="monitor-grid">
          <div className="alerts-container">
            {CONFIG.alerts.map((config) => (
              <AlertPanel
                key={config.key}
                config={config}
                active={signals[config.key]}
              />
            ))}
          </div>

          <div className="status-panel">
            <h3 className="status-title">
              Estado del Sistema
            </h3>
            
            <div className="status-content">
              <div className={`status-item ${
                connectionStatus.includes('Error') ? 'status-error' : ''
              }`}>
                Estado: {connectionStatus}
              </div>
              
              <div className="status-item">
                Última actualización: {
                  lastUpdate 
                    ? new Date(lastUpdate).toLocaleString() 
                    : 'Sin actualizaciones'
                }
              </div>
              
              <div className="status-item">
                Intentos de reconexión: {reconnectAttempts}/{CONFIG.ws.maxReconnectAttempts}
              </div>

              <div className="server-info">
                <div className="status-item">
                  <Mail className="icon" />
                  Servicio de Email: {
                    connectionStatus === 'Conectado' 
                      ? 'Activo' 
                      : 'Desconectado'
                  }
                </div>
                <div className="status-item">
                  Servidor: {CONFIG.email.url}
                </div>
                <div className="status-item">
                  WebSocket: {CONFIG.ws.url}
                </div>
                <div className="status-item">
                  Email Service: {new URL(CONFIG.email.url).origin}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(OsmosisMonitor);