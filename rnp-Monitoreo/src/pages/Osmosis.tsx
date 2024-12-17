import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Activity, Droplet, Mail,ServerCrash, AlertCircle, Zap, Heater, Clock, WifiIcon, RefreshCw, Globe2 } from 'lucide-react';
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
        activeColor: '#dc2626',
        inverse: true  // Añadimos inverse: true para indicar lógica inversa

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
          
          // Invertir la lógica para las señales con inverse: true
          CONFIG.alerts.forEach(alert => {
            if (alert.inverse && newSignals[alert.key] !== undefined) {
              newSignals[alert.key] = !newSignals[alert.key];
            }
          });
          
          // Manejar notificaciones
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
        /* Contenedor principal */

/* Base styles and container */
.osmosis-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  padding: 2rem;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

/* Main panel styling */
.monitor-panel {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  max-width: 1200px;
  width: 100%;
  margin: 2rem auto;
}

/* Header and title */
.monitor-title {
  font-size: 2rem;
  font-weight: 700;
  color: #0f172a;
  text-align: center;
  margin-bottom: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.title-logo {
  height: 48px;
  width: auto;
  object-fit: contain;
}

/* Grid layout */
.monitor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

/* Alerts container */
.alerts-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

/* Alert panels */
.alert-panel {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.25rem;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.alert-panel.active {
  transform: translateX(4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
}

/* Status indicator */
.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #e2e8f0;
  transition: all 0.3s ease;
}

.status-indicator.active {
  background: currentColor;
  box-shadow: 0 0 0 4px rgba(currentColor, 0.15);
  animation: pulse 2s infinite;
}

/* Alert content */
.alert-content {
  flex: 1;
}

.alert-title {
  font-size: 0.975rem;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 0.25rem;
}

.alert-description {
  font-size: 0.875rem;
  color: #64748b;
}

/* Status panel */
.status-panel {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.status-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f1f5f9;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* Status content grid */
.status-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}

/* Status items */
.status-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.status-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

/* Status variations */
.status-item.success {
  background: linear-gradient(145deg, #f0fdf4, #dcfce7);
  border-color: #86efac;
}

.status-item.error {
  background: linear-gradient(145deg, #fef2f2, #fee2e2);
  border-color: #fca5a5;
}

.status-item.warning {
  background: linear-gradient(145deg, #fffbeb, #fef3c7);
  border-color: #fcd34d;
}

/* Status icon */
.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  color: #0f172a;
}

/* Status details */
.status-details {
  flex: 1;
}

.status-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #64748b;
  margin-bottom: 0.25rem;
}

.status-value {
  font-size: 0.925rem;
  font-weight: 600;
  color: #0f172a;
}

/* Server info section */
.server-info {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e2e8f0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

/* Notification panel */
.notification-panel {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.notification-item {
  padding: 1rem;
  border-radius: 10px;
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-width: 320px;
  animation: slideIn 0.3s ease-out;
}

/* Notification variations */
.notification-item.error {
  border-left: 4px solid #ef4444;
}

.notification-item.warning {
  border-left: 4px solid #f59e0b;
}

.notification-item.success {
  border-left: 4px solid #10b981;
}

.notification-item.alert {
  border-left: 4px solid #3b82f6;
}

.notification-message {
  font-size: 0.875rem;
  color: #1e293b;
  line-height: 1.5;
}

/* Animations */
@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(currentColor, 0.4);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(currentColor, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(currentColor, 0);
  }
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

/* Responsive design */
@media (max-width: 768px) {
  .osmosis-container {
    padding: 1rem;
  }

  .monitor-panel {
    padding: 1.5rem;
    margin: 1rem;
  }

  .monitor-title {
    font-size: 1.5rem;
  }

  .title-logo {
    height: 36px;
  }

  .monitor-grid {
    gap: 1.5rem;
  }

  .status-content {
    grid-template-columns: 1fr;
  }

  .notification-panel {
    left: 1rem;
    right: 1rem;
  }

  .notification-item {
    max-width: none;
  }
}

/* Logs panel styling */
.logs-panel {
  background: white;
  border-radius: 12px;
  margin-top: 2rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.logs-header {
  padding: 1.25rem;
  border-bottom: 1px solid #e2e8f0;
}

.logs-title {
  color: #0f172a;
  font-size: 1.25rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logs-container {
  max-height: 500px;
  overflow: auto;
}

.logs-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.logs-table th {
  position: sticky;
  top: 0;
  background: #f8fafc;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #475569;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #e2e8f0;
}

.logs-table td {
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.875rem;
}

.log-entry:hover {
  background-color: #f8fafc;
}

/* Log entry status colors */
.log-entry.error { color: #ef4444; }
.log-entry.warning { color: #f59e0b; }
.log-entry.success { color: #10b981; }
.log-entry.info { color: #3b82f6; }

.empty-message {
  text-align: center;
  color: #64748b;
  padding: 2rem;
  font-style: italic;
}

.error-message {
  padding: 1rem;
  color: #ef4444;
  background-color: #fef2f2;
  border-radius: 8px;
  margin: 1rem;
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
            <Globe2 size={24} />
            Estado del Sistema
          </h3>
          
          <div className="status-content">
            <div className={`status-item ${connectionStatus.includes('Error') ? 'error' : connectionStatus === 'Conectado' ? 'success' : 'warning'}`}>
              <div className="status-icon">
                <WifiIcon size={20} />
              </div>
              <div className="status-details">
                <div className="status-label">Estado de Conexión</div>
                <div className="status-value">{connectionStatus}</div>
              </div>
            </div>
            
            <div className="status-item">
              <div className="status-icon">
                <Clock size={20} />
              </div>
              <div className="status-details">
                <div className="status-label">Última Actualización</div>
                <div className="status-value">
                  {lastUpdate ? new Date(lastUpdate).toLocaleString() : 'Sin actualizaciones'}
                </div>
              </div>
            </div>
            
            <div className={`status-item ${reconnectAttempts > 0 ? 'warning' : 'success'}`}>
              <div className="status-icon">
                <RefreshCw size={20} />
              </div>
              <div className="status-details">
                <div className="status-label">Intentos de Reconexión</div>
                <div className="status-value">{reconnectAttempts}/{CONFIG.ws.maxReconnectAttempts}</div>
              </div>
            </div>

            <div className="server-info">
              <div className={`status-item ${connectionStatus === 'Conectado' ? 'success' : 'warning'}`}>
                <div className="status-icon">
                  <Mail size={20} />
                </div>
                <div className="status-details">
                  <div className="status-label">Estado de Servicio</div>
                  <div className="status-value">
                    {connectionStatus === 'Conectado' ? 'Activo' : 'Desconectado'}
                  </div>
                </div>
              </div>
              
              <div className="status-item">
                <div className="status-icon">
                  <Globe2 size={20} />
                </div>
                <div className="status-details">
                  <div className="status-label">WebSocket URL</div>
                  <div className="status-value">{CONFIG.ws.url}</div>
                </div>
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