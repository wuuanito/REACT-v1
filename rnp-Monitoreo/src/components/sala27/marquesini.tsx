// src/components/sala27/Cremer.tsx
import React, { useState, useEffect } from 'react';
import { Gauge, Circle } from 'lucide-react';

// Configuración
const RASPBERRY_IP = '192.168.20.11';
const WS_PORT = 8765;

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
}

const Marquesini: React.FC<CremerProps> = ({ nombre = "Marquesini" }) => {
  const [gpioStates, setGpioStates] = useState<GPIOStates>({
    Verde: false,
    Amarillo: false,
    Rojo: false,
    Contador: false
  });
  
  const [wsStatus, setWsStatus] = useState('Desconectado');
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
        // Intentar reconectar después de 5 segundos
        setTimeout(connectWebSocket, 5000);
      };

      ws.onerror = (error) => {
        setError('Error en conexión WebSocket');
        console.error('Error WebSocket:', error);
      };

      ws.onmessage = (event) => {
        try {
          const data: WSMessage = JSON.parse(event.data);
          setGpioStates(data.estados);
          setLastUpdate(data.timestamp);

          // Incrementar contador cuando se detecta un pulso
          

        } catch (e) {
          console.error('Error procesando mensaje:', e);
        }
      };
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // Determinar el estado de la máquina basado en las luces
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

export default Marquesini;