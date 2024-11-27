import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Box,
  Paper,
  Grid,
  Typography,
  Alert,
  AlertTitle,
  Chip,
  Tabs,
  Tab,
  Card,
  CardContent,
  Button,
  CircularProgress,
  useTheme,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Timer as TimerIcon,
  CloudDownload as CloudDownloadIcon,
} from '@mui/icons-material';

// Interfaces
interface CremerDetailsProps {
  visible: boolean;
  onClose: () => void;
}

interface MachineStatus {
  status: 'RUNNING' | 'STOPPED' | 'WARNING' | 'ERROR';
  verde: boolean;
  amarillo: boolean;
  rojo: boolean;
  contador: boolean;
  timestamp: string;
  machineState: string;
}

interface ManufacturingOrder {
  id: number;
  orderNumber: string;
  date: string;
  shift: string;
  team: string;
  operator: string;
  productName: string;
  theoreticalTarget: number;
  realTarget: number;
  currentQuantity: number;
  startTime: string;
  endTime: string | null;
  efficiency: number;
  timeStats: TimeStats;
  status: OrderStatus;
}

interface TimeStats {
  stops: number;
  failures: number;
  running: number;
  cleaning: number;
  formatChange: number;
}

type OrderStatus = 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

interface OrderStats {
  activeTime: number;
  stoppedTime: number;
  efficiency: number;
  cyclesPerHour: number;
  estimatedCompletion: string;
}

interface ProductionData {
  time: string;
  value: number;
}

interface HistoryRecord {
  id: string;
  timestamp: string;
  machineState: MachineStatus['status'];
  verde: boolean;
  amarillo: boolean;
  rojo: boolean;
  contador: boolean;
  duration?: number;
}

interface MachineStats {
  totalTime: number;
  runningTime: number;
  stoppedTime: number;
  errorTime: number;
  efficiency: number;
  totalCycles: number;
}

interface DateRange {
  startDate: dayjs.Dayjs | null;
  endDate: dayjs.Dayjs | null;
}

interface ActiveOrder extends Omit<ManufacturingOrder, 'timeStats' | 'date'> {
  targetQuantity: number;
  totalStoppages: number;
  totalStoppageTime: number;
}


interface OrderDetailsDialogProps {
  order?: ManufacturingOrder; // Se permite undefined para prevenir errores iniciales
  open: boolean;
  onClose: () => void;
}

// Constants
const WS_URL = 'ws://192.168.20.10:8765';
const RECONNECT_DELAY = 5000;
const API_BASE_URL = 'http://localhost:3000/api/cremer';

// Helper Components
const StatusIndicator: React.FC<{ active: boolean; color: string }> = React.memo(({ active, color }) => (
  <Box
    sx={{
      width: 12,
      height: 12,
      borderRadius: '50%',
      backgroundColor: active ? color : '#e0e0e0',
      transition: 'background-color 0.3s'
    }}
  />
));

const LoadingOverlay: React.FC<{ message: string }> = React.memo(({ message }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      p: 3
    }}
  >
    <CircularProgress />
    <Typography variant="body2" color="text.secondary">
      {message}
    </Typography>
  </Box>
));
const parseTime = (ms: number) => {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  return { days, hours, minutes, seconds };
};

// Utility Functions
const formatDuration = (ms: number): string => {
  const { hours, minutes, seconds } = parseTime(ms);

  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0'),
  ].join(':');
};

const formatTimeDuration = (ms: number): string => {
  const { days, hours, minutes, seconds } = parseTime(ms);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
};

const CremerDetails: React.FC<CremerDetailsProps> = ({ visible }) => {
  const theme = useTheme();

  // Estado principal
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseTime = (ms: number) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  
    return { days, hours, minutes, seconds };
  };

  // Estados de la máquina
  const [machineStatus, setMachineStatus] = useState<MachineStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [productionData, setProductionData] = useState<ProductionData[]>([]);
  const [historyData, setHistoryData] = useState<HistoryRecord[]>([]);

  // Estados de órdenes
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ManufacturingOrder | null>(null);
  const [orders, setOrders] = useState<ManufacturingOrder[]>([]);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);

  // Estados de paginación y fechas
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null
  });
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [stats, setStats] = useState<MachineStats | null>(null);

  // Manejadores de estado
  const handleDateChange = useCallback((date: dayjs.Dayjs | null) => {
    if (date) {
      setSelectedDate(date);
      fetchOrders(date);
    }
  }, []);
  

  const handleOrderClick = useCallback((order: ManufacturingOrder) => {
    setSelectedOrder(order);
    setOrderDetailsOpen(true);
  }, []);

  const handlePageChange = useCallback((event: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handleRowsPerPageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  // Funciones de cálculo
  const calculateOrderStats = useCallback((order: ActiveOrder, machineStatus: MachineStatus | null): OrderStats => {
    if (!order) {
      console.error('La orden activa es nula o inválida');
      return {
        activeTime: 0,
        stoppedTime: 0,
        efficiency: 0,
        cyclesPerHour: 0,
        estimatedCompletion: '-',
      };
    }
  
    const now = new Date().getTime();
    const startTime = new Date(order.startTime).getTime();
    const totalTime = Math.max(0, now - startTime); // Evitamos tiempos negativos
  
    let activeTime = totalTime;
    let stoppedTime = 0;
  
    if (machineStatus) {
      const stoppageDuration = machineStatus.verde
        ? order.totalStoppageTime
        : order.totalStoppageTime + Math.max(0, now - new Date(machineStatus.timestamp).getTime());
  
      activeTime = Math.max(0, totalTime - stoppageDuration);
      stoppedTime = stoppageDuration;
    }
  
    const efficiency = totalTime > 0 ? (activeTime / totalTime) * 100 : 0;
    const cyclesPerHour = activeTime > 0 ? (order.currentQuantity / activeTime) * 3600000 : 0;
  
    const remainingQuantity = Math.max(0, order.targetQuantity - order.currentQuantity);
    const estimatedTimeMs = cyclesPerHour > 0 ? (remainingQuantity / cyclesPerHour) * 3600000 : 0;
    const estimatedCompletion = new Date(now + estimatedTimeMs).toLocaleString();
  
    return {
      activeTime,
      stoppedTime,
      efficiency,
      cyclesPerHour,
      estimatedCompletion,
    };
  }, []);
  
  const determineStatus = useCallback((estados: any): MachineStatus['status'] => {
    if (!estados) {
      console.warn('No se proporcionaron estados para determinar el status');
      return 'STOPPED';
    }
  
    if (estados.Rojo) return 'ERROR';
    if (estados.Verde) return 'RUNNING';
    if (estados.Amarillo) return 'WARNING';
  
    return 'STOPPED';
  }, []);

  const fetchActiveOrder = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/machine/1/active-order`);
      if (response.ok) {
        const data = await response.json();
        setActiveOrder((prev) => {
          // Evitamos actualizar si los datos no han cambiado
          if (JSON.stringify(prev) !== JSON.stringify(data)) {
            return data;
          }
          return prev;
        });
      } else if (response.status === 404) {
        setActiveOrder(null);
      } else {
        throw new Error('Error obteniendo la orden activa');
      }
    } catch (error) {
      setError('Error al cargar la orden activa');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL]);
  
  
  

  // Funciones de API
  const fetchOrders = useCallback(async (date: dayjs.Dayjs) => {
    try {
      setLoading(true);
      const startDate = date.startOf('day').toISOString();
      const endDate = date.endOf('day').toISOString();

      const response = await fetch(
        `${API_BASE_URL}/orders?startDate=${startDate}&endDate=${endDate}`
      );

      if (!response.ok) throw new Error('Error obteniendo órdenes');
      const data = await response.json();
      setOrders(data.data);
    } catch (error) {
      setError('Error cargando órdenes de fabricación');
    } finally {
      setLoading(false);
    }
  }, []);

  // WebSocket
  const handleWebSocketData = useCallback((data: any) => {
    if (!data || !data.estados || !data.timestamp) {
      console.warn('Datos incompletos recibidos por WebSocket');
      return;
    }
  
    setMachineStatus(prevStatus => {
      const newStatus: MachineStatus = {
        status: determineStatus(data.estados),
        verde: data.estados.Verde,
        amarillo: data.estados.Amarillo,
        rojo: data.estados.Rojo,
        contador: data.estados.Contador,
        timestamp: data.timestamp,
        machineState: determineStatus(data.estados),
      };
  
      // Evitar actualizar si el estado no cambió
      return JSON.stringify(prevStatus) === JSON.stringify(newStatus) ? prevStatus : newStatus;
    });
  
    setProductionData(prev => {
      const newData = {
        time: new Date(data.timestamp).toLocaleTimeString(),
        value: data.estados.Contador ? 1 : 0,
      };
  
      // Limitar los datos a los últimos 20 registros
      return [...prev.slice(-19), newData];
    });
  }, [determineStatus]);
  

  const connectWebSocket = useCallback(() => {
    const ws = new WebSocket(WS_URL);
  
    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      console.info('WebSocket conectado');
    };
  
    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketData(data);
      } catch (error) {
        console.error('Error procesando mensaje del WebSocket:', error);
      }
    };
  
    ws.onclose = () => {
      console.warn('WebSocket cerrado. Reintentando...');
      setIsConnected(false);
      setTimeout(connectWebSocket, RECONNECT_DELAY);
    };
  
    ws.onerror = (err) => {
      console.error('Error en WebSocket:', err);
      setError('Error en la conexión WebSocket');
    };
  
    return ws;
  }, [handleWebSocketData]);
  

  // Effects
  useEffect(() => {
    if (!visible) return;
    
    const ws = connectWebSocket();
    return () => ws.close();
  }, [connectWebSocket, visible]);

  const previousStats = useRef<OrderStats | null>(null);
  const downloadSummaryDocument = async (orderId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/download-summary`, {
        method: 'GET',
      });
  
      if (!response.ok) {
        throw new Error('Error descargando el resumen de la orden');
      }
  
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `order-summary-${orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error descargando documento:', error);
      alert('Hubo un problema al descargar el documento.');
    }
  };
  
  useEffect(() => {
    if (!activeOrder || activeOrder.status !== 'RUNNING') {
      setOrderStats(null);
      return;
    }
  
    const interval = setInterval(() => {
      const stats = calculateOrderStats(activeOrder, machineStatus);
  
      // Solo actualizamos si los datos cambian
      setOrderStats((prevStats) => {
        if (JSON.stringify(prevStats) !== JSON.stringify(stats)) {
          return stats;
        }
        return prevStats;
      });
    }, 3000); // Intervalo ajustado a 3 segundos para evitar carga excesiva
  
    return () => clearInterval(interval); // Limpieza del intervalo
  }, [activeOrder, machineStatus, calculateOrderStats]);
  
  useEffect(() => {
    if (visible) {
      fetchActiveOrder(); // Llamamos solo cuando el componente es visible
    }
  }, [visible, fetchActiveOrder]);
  
  const [timeElapsed, setTimeElapsed] = useState('');

// Función para calcular tiempo transcurrido
const calculateElapsedTime = useCallback((startTime: string | number | Date) => {
  const now = new Date();
  const start = new Date(startTime);
  const difference = now.getTime() - start.getTime(); // Diferencia en milisegundos

  const hours = Math.floor(difference / (1000 * 60 * 60));
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((difference % (1000 * 60)) / 1000);

  return `${hours}h ${minutes}m ${seconds}s`;
}, []);

// useEffect para actualizar el tiempo transcurrido
useEffect(() => {
  if (activeOrder && activeOrder.status === 'RUNNING') {
    const interval = setInterval(() => {
      const elapsed = calculateElapsedTime(activeOrder.startTime);
      setTimeElapsed(elapsed);
    }, 1000); // Actualizamos cada segundo

    return () => clearInterval(interval); // Limpiamos el intervalo
  }
}, [activeOrder, calculateElapsedTime]);

  // MonitoringTab Component
  const MonitoringTab = useMemo(() => {
    const StatusChip = React.memo(({ status }: { status: string }) => (
      <Chip
        label={status}
        color={
          status === 'RUNNING' ? 'success' :
          status === 'WARNING' ? 'warning' :
          status === 'ERROR' ? 'error' :
          'default'
        }
      />
    ));

    const StatusIcon = React.memo(({ state }: { state: string }) => {
      switch (state) {
        case 'RUNNING': return <CheckCircleIcon color="success" />;
        case 'WARNING': return <WarningIcon color="warning" />;
        case 'ERROR': return <ErrorIcon color="error" />;
        default: return <TimerIcon color="disabled" />;
      }
    });

    return () => (
      <Grid container spacing={3}>
        {/* Estado Actual */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Estado Actual
              </Typography>
              {machineStatus ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <StatusIcon state={machineStatus.machineState} />
                    <StatusChip status={machineStatus.machineState} />
                  </Box>

                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={4}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <StatusIndicator active={machineStatus.verde} color="#4caf50" />
                        <Typography variant="caption">Verde</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={4}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <StatusIndicator active={machineStatus.amarillo} color="#ff9800" />
                        <Typography variant="caption">Amarillo</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={4}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <StatusIndicator active={machineStatus.rojo} color="#f44336" />
                        <Typography variant="caption">Rojo</Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Última actualización:
                    </Typography>
                    <Typography>
                      {new Date(machineStatus.timestamp).toLocaleString()}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Contador:
                    </Typography>
                    <Typography color={machineStatus.contador ? 'success.main' : undefined}>
                      {machineStatus.contador ? 'Activo' : 'Inactivo'}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <LoadingOverlay message="Cargando estado..." />
              )}
            </CardContent>
          </Card>
        </Grid>

 {/* Orden Activa */}
<Grid item xs={12} md={4}>
  <Card>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        Orden Activa
      </Typography>
      {/* Verificamos si activeOrder tiene datos válidos */}
      {activeOrder && activeOrder.orderNumber ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Número de orden */}
          <Typography variant="h5" component="div">
            {activeOrder.orderNumber}
          </Typography>

          {/* Producto */}
          <Box>
            <Typography variant="body2" color="text.secondary">
              Producto:
            </Typography>
            <Typography>{activeOrder.productName}</Typography>
          </Box>

          {/* Estado */}
          <Box>
            <Typography variant="body2" color="text.secondary">
              Estado:
            </Typography>
            <StatusChip status={activeOrder.status} />
          </Box>

          {/* Hora de inicio */}
          <Box>
            <Typography variant="body2" color="text.secondary">
              Hora de Inicio:
            </Typography>
            <Typography>
              {new Date(activeOrder.startTime).toLocaleTimeString()}
            </Typography>
          </Box>

          {/* Tiempo transcurrido */}
          <Box>
            <Typography variant="body2" color="text.secondary">
              Tiempo Activo:
            </Typography>
            <Typography>{timeElapsed || 'Calculando...'}</Typography>
          </Box>

          {/* Información adicional de estadísticas */}
          {orderStats && <OrderStatsDisplay stats={orderStats} />}
        </Box>
      ) : (
        <Typography color="text.secondary">
          {/* Mostramos un mensaje de carga mientras `activeOrder` no esté disponible */}
          {activeOrder === null
            ? 'Cargando orden activa...'
            : 'No hay datos de la orden activa disponibles'}
        </Typography>
      )}
    </CardContent>
  </Card>
</Grid>


        {/* Gráfico en Tiempo Real */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Producción en Tiempo Real
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer>
                  <LineChart data={productionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fontSize: 12 }}
                      interval="preserveEnd"
                    />
                    <YAxis 
                      domain={[0, 1]}
                      ticks={[0, 1]}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip />
                    <Line
                      type="stepAfter"
                      dataKey="value"
                      stroke={theme.palette.primary.main}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  }, [machineStatus, activeOrder, orderStats, productionData, theme.palette.primary.main]);

  // Componente auxiliar para mostrar estadísticas de orden
  const OrderStatsDisplay = React.memo(({ stats }: { stats: OrderStats }) => (
    <>
      <Box>
        <Typography variant="body2" color="text.secondary">
          Tiempo Activo:
        </Typography>
        <Typography>
          {formatTimeDuration(stats.activeTime)}
        </Typography>
      </Box>

      <Box>
        <Typography variant="body2" color="text.secondary">
          Tiempo Parado:
        </Typography>
        <Typography>
          {formatTimeDuration(stats.stoppedTime)}
        </Typography>
      </Box>

      <Box>
        <Typography variant="body2" color="text.secondary">
          Eficiencia:
        </Typography>
        <Typography>
          {stats.efficiency.toFixed(1)}%
        </Typography>
      </Box>

      <Box>
        <Typography variant="body2" color="text.secondary">
          Ciclos por Hora:
        </Typography>
        <Typography>
          {Math.round(stats.cyclesPerHour)}
        </Typography>
      </Box>

      <Box>
        <Typography variant="body2" color="text.secondary">
          Finalización Estimada:
        </Typography>
        <Typography>
          {stats.estimatedCompletion}
        </Typography>
      </Box>
    </>
  ));
  // HistoryTab Component
  const HistoryTab = useMemo(() => {
    const StatusChip = React.memo(({ status }: { status: string }) => (
      <Chip
        label={status}
        color={
          status === 'RUNNING' ? 'success' :
          status === 'WARNING' ? 'warning' :
          status === 'ERROR' ? 'error' :
          'default'
        }
      />
    ));

    const formatTime = (minutes: number): string => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    };

    const OrderDetailsDialog: React.FC<OrderDetailsDialogProps> = React.memo(
      ({ order, open, onClose }) => {
        if (!order) {
          return (
            <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
              <DialogTitle>Detalles de Orden</DialogTitle>
              <DialogContent>
                <Typography>No hay datos disponibles para esta orden.</Typography>
              </DialogContent>
            </Dialog>
          );
        }
        const {
          orderNumber,
          shift,
          team,
          operator,
          productName,
          theoreticalTarget = 0,
          realTarget = 0,
          currentQuantity = 0,
          timeStats = {
            stops: 0,
            failures: 0,
            running: 0,
            cleaning: 0,
            formatChange: 0,
          },
        } = order;
    
        // Asegúrate de que los tiempos se calculen correctamente
        const formatTime = (minutes: number): string => {
          const hours = Math.floor(minutes / 60);
          const mins = minutes % 60;
          return `${hours}h ${mins}m`;
        };
    
        return (
          <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle>Detalles de Orden: {orderNumber}</DialogTitle>
            <DialogContent>
              <Grid container spacing={3}>
                {/* Información General */}
                <Grid item xs={12} md={6}>
                <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Información General
                  </Typography>
                  <Grid container spacing={2}>
                    {[ 
                      { label: "Turno", value: shift || "N/A" },
                      { label: "Equipo", value: team || "N/A" },
                      { label: "Operario", value: operator || "N/A" },
                      { label: "Producto", value: productName || "N/A" },
                    ].map(({ label, value }) => (
                      <Grid item xs={6} key={label}>
                        <Typography color="textSecondary">{label}</Typography>
                        <Typography>{value}</Typography>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
                </Grid>
    
                {/* Objetivos y Resultados */}
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Producción
                      </Typography>
                      <Grid container spacing={2}>
                        {[ 
                          { label: "Objetivo Teórico", value: theoreticalTarget },
                          { label: "Objetivo Real", value: realTarget },
                        ].map(({ label, value }) => (
                          <Grid item xs={6} key={label}>
                            <Typography color="textSecondary">{label}</Typography>
                            <Typography>{value}</Typography>
                          </Grid>
                        ))}
                        <Grid item xs={12}>
                          <Typography color="textSecondary">Progreso</Typography>
                          <Box sx={{ mt: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={(currentQuantity / realTarget) * 100 || 0}
                              sx={{ height: 10, borderRadius: 5 }}
                            />
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              {currentQuantity} / {realTarget} (
                              {((currentQuantity / realTarget) * 100 || 0).toFixed(1)}
                              %)
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
    
                {/* Tiempos */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Disponibilidad de Tiempo
                      </Typography>
                      <Grid container spacing={2}>
                        {[ 
                          { label: "Paradas", value: timeStats.stops },
                          { label: "Averías", value: timeStats.failures },
                          { label: "En Curso", value: timeStats.running },
                          { label: "Limpieza", value: timeStats.cleaning },
                          { label: "Cambio Formato", value: timeStats.formatChange },
                        ].map(({ label, value }) => (
                          <Grid item xs={6} md={2.4} key={label}>
                            <Typography color="textSecondary">{label}</Typography>
                            <Typography>{formatTime(value)}</Typography>
                          </Grid>
                        ))}
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </DialogContent>
          </Dialog>
        );
      }
    );
  

    return () => (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Selector de Fecha */}
        <Card>
          <CardContent>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="Seleccionar Fecha"
                value={selectedDate}
                onChange={(newValue) => {
                  if (newValue) {
                    setSelectedDate(newValue);
                    fetchOrders(newValue);
                  }
                }}
                slotProps={{
                  textField: { 
                    fullWidth: true,
                    size: 'small',
                    error: false 
                  }
                }}
              />
            </LocalizationProvider>
          </CardContent>
        </Card>

        {/* Lista de Órdenes */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Órdenes de Fabricación
            </Typography>
            {loading ? (
              <LoadingOverlay message="Cargando órdenes..." />
            ) : orders.length > 0 ? (
              <Table>
                <TableHead>
                  <TableRow>
                    {[
                      'Nº OF', 'Turno', 'Producto', 'Inicio', 'Fin', 'Estado', 'Acciones'
                    ].map(header => (
                      <TableCell key={header}>{header}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{order.orderNumber}</TableCell>
                      <TableCell>{order.shift}</TableCell>
                      <TableCell>{order.productName}</TableCell>
                      <TableCell>{new Date(order.startTime).toLocaleTimeString()}</TableCell>
                      <TableCell>
                        {order.endTime ? new Date(order.endTime).toLocaleTimeString() : '-'}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={order.status} />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleOrderClick(order)}
                        >
                          Ver Detalles
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Alert severity="info">
                No hay órdenes para la fecha seleccionada
              </Alert>
            )}
          </CardContent>
        </Card>

        {selectedOrder && (
          <OrderDetailsDialog
            order={selectedOrder}
            open={orderDetailsOpen}
            onClose={() => setOrderDetailsOpen(false)}
          />
        )}
      </Box>
    );
  }, [
    selectedDate,
    loading,
    orders,
    orderDetailsOpen,
    selectedOrder,
    handleOrderClick,
    fetchOrders
  ]);

  // Render Principal
  if (!visible) return null;

  return (
    <Box sx={{ p: 3 }}>
      <ConnectionAlert
        isConnected={isConnected}
        error={error}
        onReconnect={connectWebSocket}
      />

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Monitorización" />
          <Tab label="Historial" />
        </Tabs>
      </Paper>

      {loading && !historyData.length ? (
        <LoadingOverlay message="Cargando..." />
      ) : (
        <Box>
          {activeTab === 0 ? <MonitoringTab /> : <HistoryTab />}
        </Box>
      )}
    </Box>
  );
};

// Componente de alerta de conexión
const ConnectionAlert = React.memo(({ 
  isConnected, 
  error, 
  onReconnect 
}: {
  isConnected: boolean;
  error: string | null;
  onReconnect: () => void;
}) => (
  <>
    {error && (
      <Alert severity="error" sx={{ mb: 2 }}>
        <AlertTitle>Error</AlertTitle>
        {error}
      </Alert>
    )}
    <Alert 
      severity={isConnected ? "success" : "warning"}
      sx={{ mb: 2 }}
      action={
        !isConnected && (
          <Button 
            color="inherit" 
            size="small"
            startIcon={<RefreshIcon />}
            onClick={onReconnect}
          >
            Reconectar
          </Button>
        )
      }
    >
      {isConnected ? "Conectado a la máquina" : "Desconectado"}
    </Alert>
  </>
));

export default React.memo(CremerDetails);