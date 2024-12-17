import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Activity, Droplet, Mail,ServerCrash, AlertCircle, Zap, Heater, Clock } from 'lucide-react';
import bwtLogo from './bwt.png';  // Importamos el logo

// Types
type SignalKey = 'AlertaRoja' | 'Demanda' | 'FalloEquipo' | 'DepositoBajo' |'Conductividad';

interface SignalStates {
  AlertaRoja: boolean;
  Demanda: boolean;
  FalloEquipo: boolean;
  DepositoBajo: boolean;
  Conductividad: boolean;

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
  inverse?: boolean; // Añadida la propiedad inverse como opcional

}
interface LogEntry {
  id: number;
  timestamp: string;
  event: string;
  status: string;
  type: 'error' | 'warning' | 'success' | 'info';
}
interface NotificationMessage {
  id: string;
  type: 'error' | 'warning' | 'success' | 'alert';
  message: string;
  timestamp: number;
}

// Configuration
const CONFIG = {
  ws: {
    url: 'ws://192.168.20.103:8765',
    logsUrl: 'http://192.168.11.19:8000/api/logs',
    initialReconnectDelay: 1000,
    maxReconnectDelay: 30000,
    reconnectBackoffMultiplier: 1.5,
    maxReconnectAttempts: 10,
    pingInterval: 30000,
    pongTimeout: 5000,
  },
  notifications: {
    maxNotifications: 5,
    displayDuration: 5000,
  },
  logs: {
    fetchInterval: 60000, // Fetch logs every minute
    maxEntries: 100,
    pageSize: 10,
  },
    alerts: [
      {
        key: 'DepositoBajo',
        label: 'Depósito Bajo',
        icon: AlertCircle,
        description: '',
        bgColor: '#fef2f2',
        activeColor: '#dc2626'
      },
      {
        key: 'AlertaRoja',
        label: 'Funcionamiento Dosificacion',
        icon: Droplet,
        description: '',
        bgColor: '#f0fdf4',
        activeColor: '#16a34a',
        inverse: true // Añadido para indicar lógica inversa
      },
      {
        key: 'Demanda',
        label: 'INHIBIT REGENERACION',
        icon: Activity,
        description: '',
        bgColor: '#fefce8',
        activeColor: '#d97706'
      },
      {
        key: 'FalloEquipo',
        label: 'ALARMA ph / fx',
        icon: ServerCrash,
        description: '',
        bgColor: '#faf5ff',
        activeColor: '#7c3aed'
      },
      {
        key: 'Conductividad',
        label: 'FALLO BWT',
        icon: Zap,
        description: '',
        bgColor: '#ecfeff',
        activeColor: '#0891b2'
      },
      {
        key: 'MotorBomba',
        label: 'Motor de Bomba',
        icon: Heater,
        description: '',
        bgColor: '#fef2f2',
        activeColor: '#dc2626',
        inverse: true // Añadido para indicar lógica inversa
      }
    ] as AlertConfig[],
  } as const;
  
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
const LogsPanel = memo<{ logs: LogEntry[], error?: string }>(({ logs, error }) => (
  <div className="logs-panel">
    <div className="logs-header">
      <h3 className="logs-title">
        Registros del Sistema
        <Clock className="icon" size={20} />
      </h3>
    </div>

    {error ? (
      <div className="error-message">
        {error}
      </div>
    ) : (
      <div className="logs-wrapper">
        <div className="logs-container">
          <table className="logs-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Evento</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className={`log-entry ${log.type}`}>
                    <td className="date-cell">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="event-cell">
                      <div className="event-content">
                        {log.event}
                      </div>
                    </td>
                    <td className="status-cell">
                      <span className={`status-badge ${log.type}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="empty-message">
                    No hay registros disponibles
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="scroll-indicator">
          <div className="scroll-progress"></div>
        </div>
      </div>
    )}

    <style>{`
      .logs-panel {
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        margin: 20px 0;
        overflow: hidden;
      }

      .logs-header {
        padding: 16px;
        border-bottom: 1px solid #e5e7eb;
      }

      .logs-title {
        color: #1e40af;
        font-size: 18px;
        font-weight: 600;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .logs-wrapper {
        position: relative;
        display: flex;
        flex-direction: column;
      }

      .logs-container {
        max-height: 500px;
        overflow: auto;
        position: relative;
      }

      .logs-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        min-width: 600px;
      }

      .logs-table thead {
        position: sticky;
        top: 0;
        z-index: 1;
        background: #f9fafb;
      }

      .logs-table th {
        padding: 12px 16px;
        text-align: left;
        font-weight: 600;
        color: #4b5563;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-bottom: 1px solid #e5e7eb;
      }

      .logs-table td {
        padding: 12px 16px;
        border-bottom: 1px solid #e5e7eb;
        font-size: 14px;
      }

      .date-cell {
        white-space: nowrap;
        width: 180px;
      }

      .event-cell {
        min-width: 200px;
      }

      .event-content {
        word-break: break-word;
        max-width: 400px;
      }

      .status-cell {
        white-space: nowrap;
        width: 120px;
      }

      .status-badge {
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
        display: inline-block;
      }

      .log-entry:hover {
        background-color: #f9fafb;
      }

      .log-entry.error {
        color: #dc2626;
      }

      .log-entry.warning {
        color: #d97706;
      }

      .log-entry.success {
        color: #16a34a;
      }

      .log-entry.info {
        color: #2563eb;
      }

      .status-badge.error {
        background-color: #fef2f2;
      }

      .status-badge.warning {
        background-color: #fffbeb;
      }

      .status-badge.success {
        background-color: #f0fdf4;
      }

      .status-badge.info {
        background-color: #eff6ff;
      }

      .empty-message {
        text-align: center;
        color: #6b7280;
        padding: 24px;
      }

      .error-message {
        padding: 16px;
        color: #dc2626;
        background-color: #fef2f2;
      }

      .scroll-indicator {
        height: 2px;
        background-color: #e5e7eb;
        position: relative;
      }

      .scroll-progress {
        height: 100%;
        background-color: #3b82f6;
        width: 0;
        transition: width 0.2s;
      }

      /* Estilos responsivos */
      @media screen and (max-width: 768px) {
        .logs-container {
          margin: 0 -16px;
        }

        .logs-table {
          font-size: 13px;
        }

        .logs-table td, 
        .logs-table th {
          padding: 10px 12px;
        }

        .date-cell {
          width: 140px;
        }

        .event-content {
          max-width: 200px;
        }

        .status-cell {
          width: 100px;
        }
      }

      @media screen and (max-width: 480px) {
        .logs-panel {
          margin: 10px 0;
          border-radius: 0;
        }

        .date-cell {
          width: 120px;
        }

        .event-content {
          max-width: 150px;
        }

        .status-badge {
          padding: 2px 6px;
          font-size: 11px;
        }
      }
    `}</style>
  </div>
));

LogsPanel.displayName = 'LogsPanel';

const OsmosisMonitor: React.FC = () => {
   // All useState hooks need to be called first and in the same order
   const [signals, setSignals] = useState<SignalStates>({
    AlertaRoja: false,
    Demanda: false,
    FalloEquipo: false,
    DepositoBajo: false,
    Conductividad: false,
  });
  const [connectionStatus, setConnectionStatus] = useState<string>('Iniciando...');
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [, setIsLoadingLogs] = useState<boolean>(true);
  
  // Refs after state
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


  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WSMessage = JSON.parse(event.data);
      
      if (message.estados && typeof message.estados === 'object') {
        setSignals(prevSignals => {
          const newSignals = { ...message.estados };
          
          // Invertir la lógica para las señales específicas
          newSignals.DepositoBajo = !newSignals.DepositoBajo;
          
          // Manejar señales inversas según la configuración
          CONFIG.alerts.forEach(alert => {
            if (alert.inverse && newSignals[alert.key] !== undefined) {
              newSignals[alert.key] = !newSignals[alert.key];
            }
          });
          
          Object.entries(newSignals).forEach(([key, value]) => {
            if (value !== prevSignals[key as SignalKey]) {
              const alertConfig = CONFIG.alerts.find(alert => alert.key === key);
              if (alertConfig && value) {
                addNotification('alert', `${alertConfig.label}: ${alertConfig.description}`);
              }
            }
          });
          
          return newSignals;
        });
  
        setLastUpdate(message.timestamp);
      }
    } catch (error) {
      console.error('Error en mensaje:', error);
      addNotification('error', 'Error al procesar mensaje del servidor');
    }
  }, [addNotification]);
  const fetchLogs = useCallback(async () => {
    if (!isComponentMounted.current) return;
  
    try {
      setIsLoadingLogs(true);
      const response = await fetch(CONFIG.ws.logsUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
      addNotification('error', 'Error al cargar los registros del sistema');
    } finally {
      setIsLoadingLogs(false);
    }
  }, [addNotification]);

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
  useEffect(() => {
    // Initial fetch
    fetchLogs();
    
    // Set up interval
    const interval = setInterval(fetchLogs, CONFIG.logs.fetchInterval);
    
    // Cleanup
    return () => {
      clearInterval(interval);
    };
  }, [fetchLogs]);
  return (
    <div className="osmosis-container">
      <style>{`
        .osmosis-container {
          min-height: 100vh;
          background-color: #f3f4f6;
          padding: 32px;
          display: flex;
          justify-content: center;
          align-items: center;
        }
           .monitor-title {
          font-size: 24px;
          font-weight: 700;
          color: #2563eb;
          text-align: center;
          margin-bottom: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
        }

        .title-logo {
          height: 40px;
          width: auto;
          object-fit: contain;
        }

        .monitor-panel {
          background-color: white;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          max-width: 1024px;
          width: 100%;
        }
          .logs-panel {
          background-color: white;
          border-radius: 8px;
          padding: 24px;
          margin-top: 32px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .logs-title {
          font-size: 18px;
          font-weight: 600;
          color: #1e40af;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
        }

        .logs-container {
          overflow-x: auto;
        }

        .logs-table {
          width: 100%;
          border-collapse: collapse;
        }

        .logs-table th,
        .logs-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }

        .logs-table th {
          background-color: #f9fafb;
          font-weight: 600;
          color: #4b5563;
        }

        .log-entry {
          font-size: 14px;
        }

        .log-entry.error { color: #dc2626; }
        .log-entry.warning { color: #d97706; }
        .log-entry.success { color: #16a34a; }
        .log-entry.info { color: #2563eb; }

        .monitor-title {
          font-size: 24px;
          font-weight: 700;
          color: #2563eb;
          text-align: center;
          margin-bottom: 32px;
        }

        .monitor-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 32px;
        }

        .alerts-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .status-panel {
          background-color: #f9fafb;
          padding: 24px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .status-title {
          font-size: 18px;
          font-weight: 600;
          color: #1e40af;
          margin-bottom: 16px;
        }

        .status-content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .status-item {
          font-size: 14px;
          color: #4b5563;
          margin-bottom: 8px;
        }

        .status-error {
          color: #dc2626;
          font-weight: 600;
        }

        .status-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background-color: #9ca3af;
          transition: background-color 0.3s ease;
        }

        .status-indicator.active {
          background-color: white;
          animation: pulse 2s infinite;
        }

        .alert-panel {
          padding: 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 16px;
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
          font-size: 16px;
          margin-bottom: 4px;
        }

        .alert-description {
          font-size: 14px;
          opacity: 0.9;
        }

      .notification-panel {
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 50;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .notification-item {
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            max-width: 320px;
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
            font-size: 14px;
            color: #374151;
          }

          .server-info {
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid #e5e7eb;
          }

          .server-info .status-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: #6b7280;
          }

          .server-info .icon {
            width: 16px;
            height: 16px;
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

          @media (min-width: 768px) {
            .monitor-grid {
              grid-template-columns: 1fr 1fr;
            }
          }

          @media (max-width: 640px) {
            .osmosis-container {
              padding: 16px;
            }

            .monitor-panel {
              padding: 16px;
            }

            .status-panel {
              padding: 16px;
            }

            .notification-panel {
              left: 16px;
              right: 16px;
            }

            .notification-item {
              max-width: none;
            }
          }
        `}</style>

        <div className="monitor-panel">
          <h2 className="monitor-title">
          <img 
            src={bwtLogo} 
            alt="BWT Logo" 
            className="title-logo"
          />
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
                    Estado de conexión: {
                      connectionStatus === 'Conectado' 
                        ? 'Activo' 
                        : 'Desconectado'
                    }
                  </div>
                  <div className="status-item">
                    WebSocket: {CONFIG.ws.url}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
        {/* New Logs Section */}
        <LogsPanel logs={logs} />
        </div>
      </div>
    );
};

export default memo(OsmosisMonitor);