import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Gauge, Circle, Timer, Package, Activity, AlertTriangle, Clock, BarChart2 } from 'lucide-react';


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
  
  interface Timers {
    active: number;
    stopped: number;
  }
  
  interface ProductionStats {
    totalUnits: number;
    ratePerMinute: number;
    ratePerHour: number;
    efficiency: number;
    quality: number;
  }
  
  interface BatchInfo {
    id: string;
    startTime: Date;
    endTime?: Date;
    totalUnits: number;
    targetUnits?: number;
  }
  
  interface CremerProps {
    nombre?: string;
  }
  
  interface BackendData {
    machine_id: number;
    estados: GPIOStates;
    timestamp: string;
    state: string;
    active_time: number;
    stopped_time: number;
    units_count: number;
    production_stats: {
      rate_per_minute: number;
      rate_per_hour: number;
      efficiency: number;
      quality: number;
    };
    batch_id?: string;
  }

// Configuración
const RASPBERRY_IP = '192.168.20.10';
const WS_PORT = 8765;
const BACKEND_URL = 'http://localhost:3000/api';  // Añadido /api al final
const SYNC_INTERVAL = 30000; // 30 segundos
const MACHINE_ID = 1;

const Cremer: React.FC<CremerProps> = ({ nombre = "Cremer" }) => {
  // Estados básicos
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
  const [lastStateChange, setLastStateChange] = useState<Date | null>(null);
  const [currentState, setCurrentState] = useState<'active' | 'stopped' | 'idle'>('idle');
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Estados de producción
  const [productionCount, setProductionCount] = useState(0);
  const [productionStats, setProductionStats] = useState<ProductionStats>({
    totalUnits: 0,
    ratePerMinute: 0,
    ratePerHour: 0,
    efficiency: 0,
    quality: 100
  });
  const [currentBatch, setCurrentBatch] = useState<BatchInfo | null>(null);
  const [lastCounterState, setLastCounterState] = useState(false);

  // Referencias
  const wsRef = useRef<WebSocket | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout>();
  const timerIntervalRef = useRef<NodeJS.Timeout>();

  // Utilidades
  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const isActive = useCallback((states: GPIOStates): boolean => {
    return states.Verde || (states.Verde && states.Amarillo);
  }, []);

  const isStopped = useCallback((states: GPIOStates): boolean => {
    return states.Rojo || states.Amarillo || (states.Rojo && states.Amarillo && states.Verde);
  }, []);

  const updateProductionStats = useCallback(() => {
    const timeRunning = timers.active / 60; // Tiempo en minutos
    const ratePerMinute = timeRunning > 0 ? productionCount / timeRunning : 0;
    const totalTime = timers.active + timers.stopped;
    const efficiency = totalTime > 0 ? (timers.active / totalTime) * 100 : 0;

    setProductionStats({
      totalUnits: productionCount,
      ratePerMinute,
      ratePerHour: ratePerMinute * 60,
      efficiency,
      quality: 100 // Puedes ajustar esto según tus necesidades
    });
  }, [timers, productionCount]);

  // Función para enviar datos al backend
  const sendToBackend = useCallback(async () => {
    try {
      const backendData: BackendData = {
        machine_id: MACHINE_ID,
        estados: gpioStates,
        timestamp: new Date().toISOString(),
        state: currentState,
        active_time: timers.active,
        stopped_time: timers.stopped,
        units_count: productionCount,
        production_stats: {
          rate_per_minute: productionStats.ratePerMinute,
          rate_per_hour: productionStats.ratePerHour,
          efficiency: productionStats.efficiency,
          quality: productionStats.quality
        }
      };
  
      if (currentBatch) {
        backendData.batch_id = currentBatch.id;
      }
  
      console.log('Enviando datos:', backendData);
  
      const response = await fetch(`${BACKEND_URL}/machine-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backendData)
      });
  
      if (!response.ok) {
        throw new Error(`Error enviando datos: ${response.status} ${response.statusText}`);
      }
  
      const responseData = await response.json();
      setLastSync(new Date());
      console.log('Datos enviados exitosamente:', responseData);
  
    } catch (error) {
      console.error('Error completo:', error);
      setError(`Error sincronizando: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }, [gpioStates, currentState, timers, productionCount, productionStats, currentBatch]);

  // Gestión de WebSocket
  const setupWebSocket = useCallback(() => {
    const ws = new WebSocket(`ws://${RASPBERRY_IP}:${WS_PORT}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('Conectado');
      setError(null);
      setLastStateChange(new Date());
      console.log('WebSocket conectado a Raspberry Pi');
    };

    ws.onclose = () => {
      setWsStatus('Desconectado');
      setError('Conexión perdida');
      setTimeout(setupWebSocket, 5000);
    };

    ws.onerror = () => {
      setError('Error en conexión WebSocket');
    };

    ws.onmessage = (event) => {
      try {
        const data: WSMessage = JSON.parse(event.data);
        setGpioStates(data.estados);
        setLastUpdate(data.timestamp);
      } catch (e) {
        console.error('Error procesando mensaje:', e);
      }
    };

    return ws;
  }, []);

  // Gestión de lotes
  const startNewBatch = async () => {
    try {
      const batchId = `BATCH-${Date.now()}`;
      const newBatch: BatchInfo = {
        id: batchId,
        startTime: new Date(),
        totalUnits: 0
      };

      const response = await fetch(`${BACKEND_URL}/api/production/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          machine_id: MACHINE_ID,
          batch_id: batchId,
          start_time: newBatch.startTime.toISOString()
        })
      });

      if (response.ok) {
        setCurrentBatch(newBatch);
        setProductionCount(0);
        updateProductionStats();
      } else {
        throw new Error('Error iniciando lote');
      }
    } catch (error) {
      console.error('Error iniciando nuevo lote:', error);
      setError('Error iniciando nuevo lote');
    }
  };

  const endCurrentBatch = async () => {
    if (!currentBatch) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/production/${currentBatch.id}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          units_produced: productionCount,
          end_time: new Date().toISOString(),
          stats: productionStats
        })
      });

      if (response.ok) {
        setCurrentBatch(null);
        setProductionCount(0);
        updateProductionStats();
      } else {
        throw new Error('Error finalizando lote');
      }
    } catch (error) {
      console.error('Error finalizando lote:', error);
      setError('Error finalizando lote');
    }
  };

  // Efectos
  useEffect(() => {
    const ws = setupWebSocket();
    return () => {
      ws.close();
    };
  }, [setupWebSocket]);

  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (wsStatus === 'Conectado') {
        console.log('Enviando datos al backend...', new Date().toLocaleTimeString());
        sendToBackend();
      }
    }, SYNC_INTERVAL);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
    return () => {
        clearInterval(syncInterval);
      };
  }, [wsStatus, sendToBackend]);

  useEffect(() => {
    if (gpioStates.Contador && !lastCounterState) {
      setProductionCount(prev => prev + 1);
      updateProductionStats();
    }
    setLastCounterState(gpioStates.Contador);
  }, [gpioStates.Contador, lastCounterState, updateProductionStats]);

  useEffect(() => {
    const newState = isActive(gpioStates) 
      ? 'active' 
      : isStopped(gpioStates) 
        ? 'stopped' 
        : 'idle';

    if (newState !== currentState) {
      setCurrentState(newState);
      setLastStateChange(new Date());
      sendToBackend();
    }
  }, [gpioStates, currentState, isActive, isStopped, sendToBackend]);

  useEffect(() => {
    timerIntervalRef.current = setInterval(() => {
      if (lastStateChange && currentState !== 'idle') {
        setTimers((prev: Timers) => {
          if (currentState === 'active') {
            return { ...prev, active: prev.active + 1 };
          } else if (currentState === 'stopped') {
            return { ...prev, stopped: prev.stopped + 1 };
          }
          return prev;
        });
      }
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [currentState, lastStateChange]);

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

      <div className="stats-grid">
        <div className="stat-card">
          <Package size={20} className="stat-icon" />
          <div className="stat-content">
            <span className="stat-label">Producción Total</span>
            <span className="stat-value">{productionCount}</span>
          </div>
        </div>

        <div className="stat-card">
          <Activity size={20} className="stat-icon" />
          <div className="stat-content">
            <span className="stat-label">Unidades/Hora</span>
            <span className="stat-value">{Math.round(productionStats.ratePerHour)}</span>
          </div>
        </div>

        <div className="stat-card">
          <BarChart2 size={20} className="stat-icon" />
          <div className="stat-content">
            <span className="stat-label">Eficiencia</span>
            <span className="stat-value">{Math.round(productionStats.efficiency)}%</span>
          </div>
        </div>

        <div className="stat-card">
          <Clock size={20} className="stat-icon" />
          <div className="stat-content">
            <span className="stat-label">Tiempo Operativo</span>
            <span className="stat-value">{formatTime(timers.active)}</span>
          </div>
        </div>
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

      {currentBatch && (
        <div className="batch-info">
          <div className="batch-header">
            <span className="batch-label">Lote Actual: {currentBatch.id}</span>
            <span className="batch-time">
              Inicio: {currentBatch.startTime.toLocaleTimeString()}
            </span>
          </div>
          <div className="batch-stats">
            <div className="batch-stat">
              <span className="stat-label">Unidades</span>
              <span className="stat-value">{productionCount}</span>
            </div>
            <div className="batch-stat">
              <span className="stat-label">Tiempo</span>
              <span className="stat-value">
                {formatTime(Math.floor((new Date().getTime() - currentBatch.startTime.getTime()) / 1000))}
              </span>
            </div>
            <div className="batch-stat">
              <span className="stat-label">Ritmo</span>
              <span className="stat-value">
                {Math.round(productionStats.ratePerHour)} u/h
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="batch-controls">
        <button 
          onClick={startNewBatch}
          disabled={!!currentBatch || wsStatus !== 'Conectado'}
          className="control-button start"
        >
          Iniciar Nuevo Lote
        </button>
        <button 
          onClick={endCurrentBatch}
          disabled={!currentBatch || wsStatus !== 'Conectado'}
          className="control-button end"
        >
          Finalizar Lote
        </button>
      </div>

      <div className="status-container">
        <div className="status-row">
          <div className={`status-indicator ${wsStatus === 'Conectado' ? 'active' : 'inactive'}`}>
            <Circle size={8} className="status-dot" />
            <span className="status-label">Conexión Raspberry Pi</span>
            <span className="status-value">{wsStatus}</span>
          </div>

          <div className={`status-indicator ${lastSync ? 'active' : 'inactive'}`}>
            <Circle size={8} className="status-dot" />
            <span className="status-label">Backend</span>
            <span className="status-value">
              {lastSync ? 'Sincronizado' : 'Sin sincronizar'}
            </span>
          </div>
        </div>

        {error && (
          <div className="error-message">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="timestamps">
          {lastUpdate && (
            <div className="timestamp">
              <span className="timestamp-label">Última actualización:</span>
              <span className="timestamp-value">
                {new Date(lastUpdate).toLocaleTimeString()}
              </span>
            </div>
          )}
          {lastSync && (
            <div className="timestamp">
              <span className="timestamp-label">Última sincronización:</span>
              <span className="timestamp-value">
                {lastSync.toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>

    
  );
};

export default Cremer;