import React, { useState, useEffect } from 'react';
import { 
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  useTheme
} from '@mui/material';
import { X as CloseIcon } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Tipos
interface CremerDetailsProps {
  visible: boolean;
  onClose: () => void;
}

interface LightState {
  state: boolean;
  activeTime: number;
  formattedTime: {
    hours: number;
    minutes: number;
    seconds: number;
    formatted: string;
  };
  isActive: boolean;
}

interface TrafficState {
  lights: {
    Verde: LightState;
    Amarillo: LightState;
    Rojo: LightState;
  };
  counter: {
    total: number;
    lastUpdate: Date;
  };
  timestamp: Date;
}

// Hook personalizado para WebSocket
const useWebSocket = (url: string) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [data, setData] = useState<TrafficState | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const websocket = new WebSocket(url);
    
    websocket.onopen = () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
    };

    websocket.onclose = () => {
      console.log('WebSocket Disconnected');
      setIsConnected(false);
      // Intento de reconexión después de 5 segundos
      setTimeout(() => {
        if (ws) ws.close();
        setWs(new WebSocket(url));
      }, 5000);
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'update') {
          setData(message.data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    setWs(websocket);

    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, [url]);

  return { data, isConnected };
};

// Componente para las tarjetas de estado
const StatusCard: React.FC<{
  title: string;
  state: LightState;
  color: string;
}> = ({ title, state, color }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6" component="div" sx={{ color }}>
          {title}
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <CircularProgress
            variant="determinate"
            value={state.isActive ? 100 : 0}
            size={24}
            sx={{ color }}
          />
          <Typography variant="body2" sx={{ color }}>
            {state.isActive ? 'Activo' : 'Inactivo'}
          </Typography>
        </Box>
      </Box>
      <Typography variant="body1" mt={2}>
        Tiempo activo: {state.formattedTime.formatted}
      </Typography>
      <Typography variant="body2" color="text.secondary" mt={1}>
        Tiempo total: {Math.round(state.activeTime)} segundos
      </Typography>
    </CardContent>
  </Card>
);

// Componente principal CremerDetails
const CremerDetails: React.FC<CremerDetailsProps> = ({ visible, onClose }) => {
  const theme = useTheme();
  const { data, isConnected } = useWebSocket('ws://localhost:3000'); // Ajusta la URL según tu configuración

  // Estado local para datos históricos
  const [historicalData, setHistoricalData] = useState([
    { time: '00:00', Verde: 0, Amarillo: 0, Rojo: 0 }
  ]);

  // Actualizar datos históricos cuando cambie el estado
  useEffect(() => {
    if (data) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      setHistoricalData(prev => {
        const newData = [...prev, {
          time: timeStr,
          Verde: data.lights.Verde.isActive ? 1 : 0,
          Amarillo: data.lights.Amarillo.isActive ? 1 : 0,
          Rojo: data.lights.Rojo.isActive ? 1 : 0
        }];

        // Mantener solo las últimas 24 lecturas
        if (newData.length > 24) {
          return newData.slice(-24);
        }
        return newData;
      });
    }
  }, [data]);

  // Estados iniciales para las luces
  const defaultLightState: LightState = {
    state: false,
    activeTime: 0,
    formattedTime: { hours: 0, minutes: 0, seconds: 0, formatted: '00:00:00' },
    isActive: false
  };

  return (
    <Dialog 
      open={visible}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '80vh',
          bgcolor: theme.palette.background.default
        }
      }}
    >
      <DialogTitle sx={{ 
        m: 0, 
        p: 2, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: `1px solid ${theme.palette.divider}`
      }}>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h6">
            Detalles Cremer
          </Typography>
          <Box 
            sx={{ 
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 0.5,
              borderRadius: 1,
              bgcolor: isConnected ? 'success.light' : 'error.light',
              color: isConnected ? 'success.dark' : 'error.dark'
            }}
          >
            <Box 
              sx={{ 
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: isConnected ? 'success.main' : 'error.main'
              }} 
            />
            <Typography variant="caption">
              {isConnected ? 'Conectado' : 'Desconectado'}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} aria-label="cerrar">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* Estados de las luces */}
          <Grid item xs={12} md={4}>
            <StatusCard
              title="Verde"
              state={data?.lights.Verde || defaultLightState}
              color="#4CAF50"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <StatusCard
              title="Amarillo"
              state={data?.lights.Amarillo || defaultLightState}
              color="#FFC107"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <StatusCard
              title="Rojo"
              state={data?.lights.Rojo || defaultLightState}
              color="#F44336"
            />
          </Grid>

          {/* Contador y última actualización */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">
                    Contador Total: {data?.counter.total.toLocaleString() || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Última actualización: {data?.counter.lastUpdate 
                      ? new Date(data.counter.lastUpdate).toLocaleString()
                      : 'N/A'
                    }
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Gráfico histórico */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Histórico de Estados (últimas 24 lecturas)
                </Typography>
                <Box sx={{ height: 400, mt: 2 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historicalData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="time"
                        tick={{ fontSize: 12 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="Verde" 
                        stroke="#4CAF50"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Amarillo" 
                        stroke="#FFC107"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Rojo" 
                        stroke="#F44336"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  );
};

export default CremerDetails;