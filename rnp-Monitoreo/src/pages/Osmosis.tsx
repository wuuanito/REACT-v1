import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, Activity, Server, Droplet } from 'lucide-react';
import gonzaloImage from './gonzalo.jpg';

// Definimos los tipos para nuestros mensajes WebSocket y estados de señales
interface SignalStates {
  AlertaRoja: boolean;
  Demanda: boolean;
  FalloEquipo: boolean;
  DepositoBajo: boolean;
}

interface WSMessage {
  timestamp: string;
  estados: SignalStates;
  triggers: SignalStates;
}

// Configuración del sistema
const CONFIG = {
    ws: {
      url: 'ws://192.168.20.105:8765',
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      pingInterval: 30000,
    },
    api: {
      // Ajusta esta URL a tu endpoint de notificaciones
      notificationUrl: 'https://tu-api.com/api/notifications',
    },
    notifications: {
      email: {
        enabled: true,
        recipients: ['supervisor@empresa.com', 'tecnico@empresa.com'],
      },
      whatsapp: {
        enabled: true,
        recipients: ['+34600000000', '+34600000001'],
      }
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
    ],
  };

// Estilos base para el componente
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
    padding: '2rem',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '2rem',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    maxWidth: '800px',
    width: '100%',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#2563eb',
    textAlign: 'center',
    marginBottom: '2rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '2rem',
  },
  alertContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  statusPanel: {
    backgroundColor: '#f8fafc',
    padding: '1.5rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  statusTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1e40af',
    marginBottom: '1rem',
  },
  statusText: {
    fontSize: '14px',
    color: '#64748b',
    marginBottom: '0.5rem',
  },
  imageContainer: {
    marginTop: '1rem',
    width: '100%',
    height: '200px',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
} as const;

const OsmosisMonitor = () => {
  // Estado del componente
  const [signals, setSignals] = useState<SignalStates>({
    AlertaRoja: false,
    Demanda: false,
    FalloEquipo: false,
    DepositoBajo: false,
  });
  const [connectionStatus, setConnectionStatus] = useState('Iniciando conexión...');
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Referencias para gestión de WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef<number>();
  const reconnectTimeoutRef = useRef<number>();

  // Manejador de mensajes WebSocket
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      if (event.data === 'pong') {
        return;
      }

      const message: WSMessage = JSON.parse(event.data);
      if (!message.estados) {
        throw new Error('Mensaje sin datos de estados');
      }

      setSignals(message.estados);
      setLastUpdate(message.timestamp);
      reconnectAttemptsRef.current = 0;
    } catch (error) {
      console.error('Error en mensaje:', error);
    }
  }, []);

  // Gestión de conexión WebSocket
  const setupWebSocket = useCallback(() => {
    const cleanup = () => {
      if (pingIntervalRef.current) window.clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) window.clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };

    cleanup();

    if (reconnectAttemptsRef.current >= CONFIG.ws.maxReconnectAttempts) {
      setConnectionStatus('Error de conexión - Recargar página');
      return;
    }

    try {
      const ws = new WebSocket(CONFIG.ws.url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('Conectado');
        pingIntervalRef.current = window.setInterval(() => {
          ws.send('ping');
        }, CONFIG.ws.pingInterval);
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
        setConnectionStatus('Error - Reintentando');
      };

      ws.onclose = () => {
        setConnectionStatus('Desconectado - Reintentando...');
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = window.setTimeout(setupWebSocket, CONFIG.ws.reconnectInterval);
      };

    } catch (error) {
      setConnectionStatus('Error crítico');
      reconnectAttemptsRef.current += 1;
      reconnectTimeoutRef.current = window.setTimeout(setupWebSocket, CONFIG.ws.reconnectInterval);
    }

    return cleanup;
  }, [handleMessage]);

  useEffect(() => {
    return setupWebSocket();
  }, [setupWebSocket]);

  // Componente indicador de estado
  const StatusIndicator = ({ active }: { active: boolean }) => (
    <div style={{
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      backgroundColor: active ? '#ffffff' : '#9ca3af',
      animation: active ? 'pulse 2s infinite' : 'none',
    }} />
  );

  // Componente panel de alerta
  const AlertPanel = ({ config, active }: { config: typeof CONFIG.alerts[number]; active: boolean }) => {
    const Icon = config.icon;
    
    return (
      <div style={{
        padding: '1rem',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        backgroundColor: active ? config.activeColor : config.bgColor,
        color: active ? 'white' : 'black',
        transition: 'all 0.3s ease',
        boxShadow: active ? '0 4px 6px rgba(0, 0, 0, 0.1)' : 'none',
      }}>
        <StatusIndicator active={active} />
        <Icon size={24} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '16px' }}>{config.label}</div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>{config.description}</div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Sistema de Monitorización Osmosis</h2>

        <div style={styles.grid}>
          <div style={styles.alertContainer}>
            {CONFIG.alerts.map((config) => (
              <AlertPanel
                key={config.key}
                config={config}
                active={signals[config.key as keyof SignalStates]}
              />
            ))}
          </div>

          <div style={styles.statusPanel}>
            <h3 style={styles.statusTitle}>Estado del Sistema</h3>
            
            <div>
              <div style={{
                ...styles.statusText,
                color: connectionStatus.includes('Error') ? '#dc2626' : '#64748b',
                fontWeight: connectionStatus.includes('Error') ? 600 : 400,
              }}>
                Estado: {connectionStatus}
              </div>
              <div style={styles.statusText}>
                Última actualización: {
                  lastUpdate ? new Date(lastUpdate).toLocaleString() : 'Sin actualizaciones'
                }
              </div>
              <div style={styles.statusText}>
                Intentos de reconexión: {reconnectAttemptsRef.current}/{CONFIG.ws.maxReconnectAttempts}
              </div>

              <div style={styles.imageContainer}>
                <img 
                  src={gonzaloImage} 
                  alt="Gonzalo"
                  style={styles.image}
                />
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
};

export default OsmosisMonitor;