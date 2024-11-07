// src/components/sala27/Cremer.tsx

import React, { useState, useEffect } from 'react';
import { Gauge, Circle, Timer } from 'lucide-react';

interface CremerProps {
  nombre?: string;
}

interface GPIOStates {
  Verde: boolean;    // Pin 21
  Amarillo: boolean; // Pin 4
  Rojo: boolean;     // Pin 27
  Contador: boolean; // Pin 13
}

interface WSMessage {
  timestamp: string;
  estados: GPIOStates;
  manufacturing?: {
    type: string;
    action: string;
    order: any;
  };
}

interface Timers {
  active: number;
  stopped: number;
}

interface ManufacturingOrder {
  id: string;
  name: string;
  startTime: string;
  status: 'ACTIVE' | 'PAUSED' | 'FINISHED';
  pauseReason?: string;
}

const Cremer: React.FC<CremerProps> = ({ nombre = "Cremer" }) => {
  const [gpioStates, setGpioStates] = useState<GPIOStates>({
    Verde: false,
    Amarillo: false,
    Rojo: false,
    Contador: false
  });
  
  const [wsStatus, setWsStatus] = useState('Desconectado');
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timers, setTimers] = useState<Timers>({ active: 0, stopped: 0 });
  const [manufacturingActive, setManufacturingActive] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<ManufacturingOrder | null>(null);

  // Función para formatear el tiempo
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Efecto para los cronómetros
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (manufacturingActive) {
      interval = setInterval(() => {
        if (gpioStates.Verde || (gpioStates.Verde && gpioStates.Amarillo)) {
          setTimers(prev => ({ ...prev, active: prev.active + 1 }));
        } else if (gpioStates.Rojo || gpioStates.Amarillo || (gpioStates.Rojo && gpioStates.Amarillo && gpioStates.Verde)) {
          setTimers(prev => ({ ...prev, stopped: prev.stopped + 1 }));
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gpioStates, manufacturingActive]);

  // Conexión WebSocket
  useEffect(() => {
    const RASPBERRY_IP = '192.168.20.10';
    const WS_PORT = 8765;
    let ws: WebSocket;

    const connectWebSocket = () => {
      ws = new WebSocket(`ws://${RASPBERRY_IP}:${WS_PORT}`);

      ws.onopen = () => {
        setWsStatus('Conectado');
        setError(null);
        console.log('WebSocket conectado');
      };

      ws.onclose = () => {
        setWsStatus('Desconectado');
        console.log('WebSocket desconectado');
        setTimeout(connectWebSocket, 5000);
      };

      ws.onerror = () => {
        setError('Error en conexión WebSocket');
      };

      ws.onmessage = (event) => {
        try {
          const data: WSMessage = JSON.parse(event.data);
          
          // Actualizar estados GPIO
          if (data.estados) {
            setGpioStates(data.estados);
            setLastUpdate(data.timestamp);
          }

          // Manejar eventos de fabricación
          if (data.manufacturing) {
            handleManufacturingUpdate(data.manufacturing);
          }
        } catch (e) {
          console.error('Error procesando mensaje:', e);
        }
      };
    };

    connectWebSocket();

    return () => {
      if (ws) ws.close();
    };
  }, []);

  const handleManufacturingUpdate = (update: any) => {
    switch (update.action) {
      case 'start':
        setManufacturingActive(true);
        setCurrentOrder(update.order);
        setTimers({ active: 0, stopped: 0 });
        break;

      case 'pause':
        setCurrentOrder(update.order);
        break;

      case 'resume':
        setCurrentOrder(update.order);
        break;

      case 'stop':
        setManufacturingActive(false);
        setCurrentOrder(null);
        setTimers({ active: 0, stopped: 0 });
        break;
    }
  };

  const getMachineState = () => {
    if (gpioStates.Rojo) return 'stopped';
    if (gpioStates.Verde) return 'active';
    return 'waiting';
  };

  return (
    <div className="maquina-card">
      <div className={`estado-indicador ${getMachineState()}`} />
      
      <div className="maquina-header">
        <div className="maquina-icon">
          <Gauge size={40} />
        </div>
        <h3>{nombre}</h3>
      </div>

      <div className="semaforo-container">
        <div className="semaforo">
          <div className={`luz roja ${gpioStates.Rojo ? 'activa' : ''}`}>
            <div className="luz-interior" />
          </div>
          <div className={`luz amarilla ${gpioStates.Amarillo ? 'activa' : ''}`}>
            <div className="luz-interior" />
          </div>
          <div className={`luz verde ${gpioStates.Verde ? 'activa' : ''}`}>
            <div className="luz-interior" />
          </div>
        </div>
      </div>

      {currentOrder && (
        <>
          <div className="order-info">
            <h3>Orden Actual: {currentOrder.name}</h3>
            <p>Inicio: {new Date(currentOrder.startTime).toLocaleString()}</p>
            {currentOrder.status === 'PAUSED' && (
              <p className="pause-reason">
                Pausado por: {currentOrder.pauseReason}
              </p>
            )}
          </div>

          <div className="timers-container">
            <div className="timer active">
              <Timer size={16} className="timer-icon" />
              <span className="timer-label">Tiempo Activo:</span>
              <span className="timer-value">{formatTime(timers.active)}</span>
            </div>
            <div className="timer stopped">
              <Timer size={16} className="timer-icon" />
              <span className="timer-label">Tiempo Parado:</span>
              <span className="timer-value">{formatTime(timers.stopped)}</span>
            </div>
          </div>
        </>
      )}

      <div className="conexiones">
        <div className={`conexion ${wsStatus === 'Conectado' ? 'activa' : 'inactiva'}`}>
          <Circle size={8} className="dot" />
          <span className="label">WS: {wsStatus}</span>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {lastUpdate && (
        <div className="last-update">
          Última actualización: {new Date(lastUpdate).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default Cremer;