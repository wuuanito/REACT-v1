// src/hooks/useMachineData.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { DatosMaquina } from '../types/types';

interface MachineDataHook {
  machines: DatosMaquina[];
  loading: boolean;
  error: string | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

// URLs actualizadas para coincidir con el servidor
const WS_URL = 'ws://localhost:5000/ws';
const API_URL = 'http://localhost:4000/api';

export const useMachineData = (): MachineDataHook => {
  const [machines, setMachines] = useState<DatosMaquina[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<MachineDataHook['connectionStatus']>('connecting');
  
  const wsRef = useRef<WebSocket | null>(null);

  const connectWebSocket = useCallback(() => {
    try {
      console.log('Conectando al WebSocket...');
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket conectado');
        setConnectionStatus('connected');
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Datos recibidos:', data);

          if (data.type === 'initialData' || data.type === 'machineUpdate') {
            setMachines(data.data);
            setLoading(false);
          }
        } catch (error) {
          console.error('Error al procesar mensaje:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket desconectado');
        setConnectionStatus('disconnected');
        // Intentar reconectar después de 3 segundos
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error('Error WebSocket:', error);
        setError('Error de conexión WebSocket');
        setConnectionStatus('error');
      };

    } catch (error) {
      console.error('Error al crear WebSocket:', error);
      setError('Error al crear conexión WebSocket');
      setConnectionStatus('error');
    }
  }, []);

  const fetchInitialData = async () => {
    try {
      const response = await fetch(`${API_URL}/machines`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Datos iniciales recibidos:', data);
      setMachines(data);
      setLoading(false);
    } catch (error) {
      console.error('Error al obtener datos iniciales:', error);
      setError('Error al cargar datos iniciales');
      setLoading(false);
    }
  };

  useEffect(() => {
    // Intentar obtener datos iniciales primero
    fetchInitialData();
    
    // Luego conectar WebSocket
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  return { machines, loading, error, connectionStatus };
};