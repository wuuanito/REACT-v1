import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
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
  useTheme,
  TextField,
  Button,
  Alert,
  Snackbar,
  Chip,
  TableContainer,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Table
} from '@mui/material';

import { 
  AlertCircle,
  CheckCircle2,
  X as CloseIcon,
  FileSpreadsheet,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';

import * as XLSX from 'xlsx';

// Configuración de la API
const BASE_URL = 'http://localhost:3000/api';
const WS_URL = 'ws://localhost:3000';

// Definición de tipos
type NotificationType = 'success' | 'error';
type OrderStatus = 'active' | 'completed' | 'paused';

interface PauseEvent {
  id: string;
  startTime: string;
  endTime: string | null;
  duration: string;
  cause: string;
  description: string;
  action: string;
  manufacturingOrderId: string;
}

interface ManufacturingOrder {
  id: string;
  productName: string;
  startTime: string;
  endTime: string | null;
  status: OrderStatus;
  totalBottles: number;
  activeTime: string;
  pausedTime: string;
  totalActiveTime: string;
  totalPausedTime: string;
  pauseHistory: PauseEvent[];
}

interface DateTimeFilter {
  startDate: string;
  endDate: string;
  startHour: string;
  endHour: string;
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

interface CremerDetailsProps {
  visible: boolean;
  onClose: () => void;
}

interface StatusChipProps {
  status: OrderStatus;
  className?: string;
}

interface StatusCardProps {
  title: string;
  state: LightState;
  color: string;
}

interface OrderHistoryTableProps {
  orders: ManufacturingOrder[];
  onGenerateReport: (order: ManufacturingOrder) => void;
}

interface OrderDetailsCardProps {
  order: ManufacturingOrder;
  onGenerateReport: (order: ManufacturingOrder) => void;
}

type NotificationState = {
  open: boolean;
  message: string;
  type: NotificationType;
};

// Estados por defecto
const defaultLightState: LightState = {
  state: false,
  activeTime: 0,
  formattedTime: { 
    hours: 0, 
    minutes: 0, 
    seconds: 0, 
    formatted: '00:00:00' 
  },
  isActive: false
};

const defaultTrafficState: TrafficState = {
  lights: {
    Verde: { ...defaultLightState },
    Amarillo: { ...defaultLightState },
    Rojo: { ...defaultLightState }
  },
  counter: {
    total: 0,
    lastUpdate: new Date()
  },
  timestamp: new Date()
};// Servicio de API
const apiService = {
  async createOrder(data: { productName: string }) {
    try {
      const response = await axios.post(`${BASE_URL}/orders`, data);
      return response.data;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  },

  async pauseOrder(orderId: string, pauseData: {
    cause: string;
    description?: string;
    action: string;
  }) {
    try {
      const response = await axios.post(`${BASE_URL}/orders/${orderId}/pause`, pauseData);
      return response.data;
    } catch (error) {
      console.error('Error pausing order:', error);
      throw error;
    }
  },

  async resumeOrder(orderId: string, pauseEventId: string, action: string) {
    try {
      const response = await axios.post(
        `${BASE_URL}/orders/${orderId}/pause/${pauseEventId}/resume`,
        { action }
      );
      return response.data;
    } catch (error) {
      console.error('Error resuming order:', error);
      throw error;
    }
  },

  async completeOrder(orderId: string) {
    try {
      const response = await axios.post(`${BASE_URL}/orders/${orderId}/complete`);
      return response.data;
    } catch (error) {
      console.error('Error completing order:', error);
      throw error;
    }
  },

  async getOrderHistory(startDate: string, endDate: string) {
    try {
      const response = await axios.get(`${BASE_URL}/orders/history`, {
        params: { startDate, endDate }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching order history:', error);
      throw error;
    }
  },

  async getProductionStats(startDate: string, endDate: string) {
    try {
      const response = await axios.get(`${BASE_URL}/stats`, {
        params: { startDate, endDate }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching production stats:', error);
      throw error;
    }
  }
};

// Hook personalizado para WebSocket
// Hook personalizado para WebSocket con validaciones adicionales
const useWebSocket = (url: string) => {
  const ws = useRef<WebSocket | null>(null);
  const [wsData, setWsData] = useState<TrafficState>(() => ({
    ...defaultTrafficState,
    lights: {
      Verde: { ...defaultLightState },
      Amarillo: { ...defaultLightState },
      Rojo: { ...defaultLightState }
    },
    counter: {
      total: 0,
      lastUpdate: new Date()
    },
    timestamp: new Date()
  }));
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const maxReconnectAttempts = 5;
  const reconnectDelay = 5000;
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    console.log('Intentando conectar al WebSocket:', url);
    const websocket = new WebSocket(url);
    
    websocket.onopen = () => {
      console.log('Conexión WebSocket establecida');
      setIsConnected(true);
      setReconnectAttempts(0);
      websocket.send(JSON.stringify({ 
        type: 'subscribe', 
        channel: 'machine-status' 
      }));
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'update' && message.data) {
          setWsData(prevData => {
            // Asegurar que los datos previos existan
            const currentData = prevData || defaultTrafficState;
            
            // Validar y fusionar los datos de las luces
            const newLights = {
              Verde: {
                ...defaultLightState,
                ...currentData.lights.Verde,
                ...message.data?.lights?.Verde
              },
              Amarillo: {
                ...defaultLightState,
                ...currentData.lights.Amarillo,
                ...message.data?.lights?.Amarillo
              },
              Rojo: {
                ...defaultLightState,
                ...currentData.lights.Rojo,
                ...message.data?.lights?.Rojo
              }
            };

            // Validar y fusionar el contador
            const newCounter = {
              total: message.data?.counter?.total ?? currentData.counter.total,
              lastUpdate: message.data?.counter?.lastUpdate ? 
                new Date(message.data.counter.lastUpdate) : 
                currentData.counter.lastUpdate
            };

            return {
              ...currentData,
              lights: newLights,
              counter: newCounter,
              timestamp: new Date()
            };
          });
        }
      } catch (error) {
        console.error('Error procesando mensaje WebSocket:', error);
        // No dejar que el estado se corrompa en caso de error
        setWsData(prevData => ({ ...prevData }));
      }
    };

    websocket.onclose = () => {
      console.log('Conexión WebSocket cerrada');
      setIsConnected(false);
      
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          connect();
        }, reconnectDelay);
      }
    };

    websocket.onerror = (error) => {
      console.error('Error en WebSocket:', error);
    };

    ws.current = websocket;
  }, [url, reconnectAttempts]);

  useEffect(() => {
    connect();
    
    const pingInterval = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  return { 
    data: wsData || defaultTrafficState,  // Asegurar que siempre devolvemos datos válidos
    isConnected, 
    reconnectAttempts 
  };
};

// Función auxiliar para formatear fechas
const formatDateTime = (date: Date): string => {
  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};// Componente StatusChip
const StatusChip: React.FC<StatusChipProps> = React.memo(({ status, className }) => {
  const getStatusColor = (status: OrderStatus): "default" | "success" | "warning" | "error" => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'success';
      case 'paused': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: OrderStatus) => {
    const iconProps = { size: 16 };
    
    return (
      <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
        {status === 'active' && <PlayCircle {...iconProps} />}
        {status === 'completed' && <CheckCircle2 {...iconProps} />}
        {status === 'paused' && <PauseCircle {...iconProps} />}
        {!['active', 'completed', 'paused'].includes(status) && <AlertCircle {...iconProps} />}
      </Box>
    );
  };

  return (
    <Chip
      size="small"
      label={status.toUpperCase()}
      color={getStatusColor(status)}
      icon={getStatusIcon(status)}
      className={className}
    />
  );
});

// Componente StatusCard
const StatusCard: React.FC<StatusCardProps> = React.memo(({ title, state, color }) => (
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
));

// Componente ManufacturingOrderCard
const ManufacturingOrderCard: React.FC<OrderDetailsCardProps> = React.memo(({ order, onGenerateReport }) => {
  if (!order) return null;

  const pauseHistory = order.pauseHistory || [];
    return (
      <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h6" color="primary">{order.productName || 'Sin nombre'}</Typography>
            <Typography variant="body2" color="text.secondary">
              ID: {order.id || 'N/A'}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={2}>
            <StatusChip status={order.status || 'active'} />
            <Button
              variant="outlined"
              size="small"
              startIcon={<FileSpreadsheet size={16} />}
              onClick={() => onGenerateReport(order)}
            >
              Generar Reporte
            </Button>
          </Box>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">Producción</Typography>
            <Typography variant="body2">
              Total Botes: {(order.totalBottles || 0).toLocaleString()}
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">Tiempos</Typography>
            <Typography variant="body2">
              Activo: {order.activeTime || '00:00:00'}
            </Typography>
            <Typography variant="body2">
              Parado: {order.pausedTime || '00:00:00'}
            </Typography>
          </Grid>

          {pauseHistory.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                Últimas Paradas
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Inicio</TableCell>
                      <TableCell>Fin</TableCell>
                      <TableCell>Duración</TableCell>
                      <TableCell>Causa</TableCell>
                      <TableCell>Acción</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pauseHistory.slice(0, 3).map((pause, index) => (
                      <TableRow key={index}>
                        <TableCell>{pause?.startTime ? formatDateTime(new Date(pause.startTime)) : 'N/A'}</TableCell>
                        <TableCell>
                          {pause?.endTime ? formatDateTime(new Date(pause.endTime)) : 'En curso'}
                        </TableCell>
                        <TableCell>{pause?.duration || 'N/A'}</TableCell>
                        <TableCell>{pause?.cause || 'N/A'}</TableCell>
                        <TableCell>{pause?.action || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
});

// Componente OrderHistory
const OrderHistory: React.FC<OrderHistoryTableProps> = React.memo(({ orders, onGenerateReport }) => {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const getFilteredOrders = useCallback((orderList: ManufacturingOrder[], date: string) => {
    if (!Array.isArray(orderList)) return [];
    
    return orderList.filter(order => {
      if (!order?.startTime) return false;
      
      const selectedDateTime = new Date(date);
      selectedDateTime.setHours(0, 0, 0, 0);

      const nextDay = new Date(selectedDateTime);
      nextDay.setDate(nextDay.getDate() + 1);

      const orderStartTime = new Date(order.startTime);

      return orderStartTime >= selectedDateTime && orderStartTime < nextDay;
    });
  }, []);


  const filteredOrders = useMemo(() => 
    getFilteredOrders(orders, selectedDate),
    [orders, selectedDate, getFilteredOrders]
  );

  return (
    <Box>
    <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="h6">Historial de Órdenes</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <TextField
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          size="small"
          InputLabelProps={{ shrink: true }}
          label="Seleccionar fecha"
        />
      </Box>
    </Box>

    {Array.isArray(filteredOrders) && filteredOrders.length > 0 ? (
      filteredOrders.map((order) => (
        <Box key={order.id} sx={{ mb: 3 }}>
          <ManufacturingOrderCard
            order={order}
            onGenerateReport={onGenerateReport}
          />
        </Box>
      ))
    ) : (
      <Alert severity="info" sx={{ mt: 2 }}>
        No hay órdenes registradas para el día {new Date(selectedDate).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}
      </Alert>
    )}
  </Box>
);
});
// Componente Principal CremerDetails
const CremerDetails: React.FC<CremerDetailsProps> = React.memo(({ visible, onClose }) => {
  const theme = useTheme();
  
  // Estados
  const [, setHistoricalData] = useState<Array<{
    time: string;
    Verde: number;
    Amarillo: number;
    Rojo: number;
  }>>([]);
  
  const [notification, setNotification] = useState<NotificationState>({ 
    open: false, 
    message: '', 
    type: 'success' 
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [activeOrder, setActiveOrder] = useState<ManufacturingOrder | null>(null);
  const [orderHistory, setOrderHistory] = useState<ManufacturingOrder[]>([]);

  // Referencias
  const lastUpdateRef = useRef<string>('');
  const safeOrderHistory = Array.isArray(orderHistory) ? orderHistory : [];

  // Filtros
  const [filters] = useState<DateTimeFilter>(() => {
    const today = new Date().toISOString().split('T')[0];
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return {
      startDate: lastWeek,
      endDate: today,
      startHour: '00:00',
      endHour: '23:59'
    };
  });

  // WebSocket
  const { data: wsData = defaultTrafficState, isConnected } = useWebSocket(WS_URL);
  const lights = useMemo(() => ({
    Verde: { ...defaultLightState, ...wsData?.lights?.Verde },
    Amarillo: { ...defaultLightState, ...wsData?.lights?.Amarillo },
    Rojo: { ...defaultLightState, ...wsData?.lights?.Rojo }
  }), [wsData?.lights]);

  const counter = useMemo(() => ({
    total: wsData?.counter?.total ?? 0,
    lastUpdate: wsData?.counter?.lastUpdate ?? new Date()
  }), [wsData?.counter]);

  // Manejadores
  const updateHistoricalData = useCallback(() => {
    if (!wsData?.lights) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    if (timeStr === lastUpdateRef.current) return;
    lastUpdateRef.current = timeStr;

    setHistoricalData(prev => {
      if (!Array.isArray(prev)) return [];
      
      const lastEntry = prev[prev.length - 1];
      const newState = {
        Verde: wsData.lights.Verde?.isActive ? 1 : 0,
        Amarillo: wsData.lights.Amarillo?.isActive ? 1 : 0,
        Rojo: wsData.lights.Rojo?.isActive ? 1 : 0
      };

      if (lastEntry && 
          lastEntry.Verde === newState.Verde &&
          lastEntry.Amarillo === newState.Amarillo &&
          lastEntry.Rojo === newState.Rojo) {
        return prev;
      }

      const newData = [...prev, { time: timeStr, ...newState }];
      return newData.length > 24 ? newData.slice(-24) : newData;
    });
  }, [wsData]);

  const handleGenerateOrderReport = useCallback((order: ManufacturingOrder) => {
    try {
      const wb = XLSX.utils.book_new();
      
      const generalInfo = [
        ['REPORTE DE ORDEN DE FABRICACIÓN'],
        [''],
        ['ID:', order.id],
        ['Producto:', order.productName],
        ['Estado:', order.status],
        [''],
        ['PERIODO'],
        ['Inicio:', formatDateTime(new Date(order.startTime))],
        ['Fin:', order.endTime ? formatDateTime(new Date(order.endTime)) : 'En proceso'],
        [''],
        ['MÉTRICAS DE PRODUCCIÓN'],
        ['Total Botes:', order.totalBottles],
        [''],
        ['ANÁLISIS DE TIEMPOS'],
        ['Tiempo Activo:', order.totalActiveTime],
        ['Tiempo Parado:', order.totalPausedTime],
        ['Tiempo Total:', order.activeTime],
        ['Total Paradas:', order.pauseHistory.length],
      ];

      const wsInfo = XLSX.utils.aoa_to_sheet(generalInfo);
      XLSX.utils.book_append_sheet(wb, wsInfo, 'Información General');

      if (order.pauseHistory?.length > 0) {
        const pauseData = order.pauseHistory.map(pause => ({
          Inicio: formatDateTime(new Date(pause.startTime)),
          Fin: pause.endTime ? formatDateTime(new Date(pause.endTime)) : 'En curso',
          Duración: pause.duration,
          Causa: pause.cause,
          Descripción: pause.description,
          Acción: pause.action
        }));
        
        const wsPauses = XLSX.utils.json_to_sheet(pauseData);
        XLSX.utils.book_append_sheet(wb, wsPauses, 'Historial de Paradas');
      }

      const fileName = `reporte-orden_${order.id}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      setNotification({
        open: true,
        message: `Reporte generado para orden ${order.id}`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error generating order report:', error);
      setNotification({
        open: true,
        message: 'Error al generar reporte de orden',
        type: 'error'
      });
    }
  }, []);

  const handleCreateOrder = useCallback(async (productName: string) => {
    try {
      setIsLoading(true);
      const response = await apiService.createOrder({ productName });
      
      if (response.success) {
        setActiveOrder(response.data);
        setNotification({
          open: true,
          message: 'Orden creada exitosamente',
          type: 'success'
        });
      }
    } catch (error) {
      console.error('Error creating order:', error);
      setNotification({
        open: true,
        message: 'Error al crear la orden',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Efectos
  useEffect(() => {
    const fetchManufacturingOrders = async () => {
      try {
        setIsLoading(true);
        const response = await apiService.getOrderHistory(filters.startDate, filters.endDate);
        
        if (response.success) {
          const orders = response.data;
          const active = orders.find((order: ManufacturingOrder) => order.status === 'active');
          const history = orders.filter((order: ManufacturingOrder) => order.status !== 'active');
          
          setActiveOrder(active || null);
          setOrderHistory(history);
        }
      } catch (error) {
        console.error('Error fetching manufacturing orders:', error);
        setNotification({
          open: true,
          message: 'Error al cargar órdenes de fabricación',
          type: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (visible) {
      fetchManufacturingOrders();
    }
  }, [filters, visible]);

  useEffect(() => {
    const intervalId = setInterval(updateHistoricalData, 1000);
    return () => clearInterval(intervalId);
  }, [updateHistoricalData]);

  // Render
  return (
    <>
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
        <DialogTitle 
          sx={{ 
            m: 0, 
            p: 2, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            borderBottom: `1px solid ${theme.palette.divider}`
          }}
        >
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
            <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
              <CloseIcon size={20} />
            </Box>
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3 }}>
        <Grid container spacing={3}>
            {Object.entries(lights).map(([color, state]) => (
              <Grid item xs={12} md={4} key={color}>
                <StatusCard
                  title={color}
                  state={state || defaultLightState}
                  color={
                    color === 'Verde' ? '#4CAF50' :
                    color === 'Amarillo' ? '#FFC107' : '#F44336'
                  }
                />
              </Grid>
            ))}
            {/* Contador */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">
                      Contador Total: {counter.total.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Última actualización: {formatDateTime(counter.lastUpdate)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Orden activa */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Orden de Fabricación Activa
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<PlayCircle size={16} />}
                  onClick={() => handleCreateOrder('Nueva Orden')}
                  disabled={!!activeOrder || isLoading}
                >
                  Nueva Orden
                </Button>
              </Box>
              {isLoading ? (
                <Box display="flex" justifyContent="center" p={3}>
                  <CircularProgress />
                </Box>
              ) : activeOrder ? (
                <ManufacturingOrderCard 
                  order={activeOrder}
                  onGenerateReport={handleGenerateOrderReport}
                />
              ) : (
                <Alert severity="info">No hay órdenes activas en este momento</Alert>
              )}
            </Grid>

            {/* Historial de órdenes */}
            <Grid item xs={12}>
              <OrderHistory 
                orders={safeOrderHistory}
                onGenerateReport={handleGenerateOrderReport}
              />
            </Grid>
          </Grid>
        </DialogContent>
      </Dialog>

      {/* Notificaciones */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setNotification(prev => ({ ...prev, open: false }))} 
          severity={notification.type}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </>
  );
});

export default CremerDetails;