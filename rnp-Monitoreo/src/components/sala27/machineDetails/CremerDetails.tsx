import React, { useEffect, useState, useCallback, useRef } from 'react';
import { LineChart, XAxis, YAxis, Tooltip, Line, ResponsiveContainer } from 'recharts';
import { Download, Clock, Activity, Package, CheckCircle, AlertTriangle, History, Calendar, Timer } from 'lucide-react';
import { format, parseISO, differenceInSeconds, subDays, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

// Interfaces
interface CremerDetailsProps {
    visible: boolean;
    onClose: () => void;
}

interface MachineState {
    greenLight: boolean;
    yellowLight: boolean;
    redLight: boolean;
    bottleCount: number;
    timestamp: string;
}

interface ManufacturingOrder {
    id: number;
    orderNumber: string;
    productName: string;
    batchNumber: string;
    targetQuantity: number;
    startTime: string | null;
    endTime: string | null;
    status: 'pending' | 'in_progress' | 'completed' | 'paused' | 'cancelled';
    activeTime: number;
    currentBottleCount: number;
    efficiency: number;
    notes?: string;
}

interface ProductionTime {
    startTime: string;
    endTime: string | null;
    duration: number;
    type: 'production' | 'stopped';
    state: string;
}

interface DateRange {
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
}

interface OrderDetails {
    order: ManufacturingOrder;
    productionTimes: ProductionTime[];
    summary: {
        totalProductionTime: number;
        totalStoppedTime: number;
        efficiency: number;
    };
}

// Componente principal
const CremerDetails: React.FC<CremerDetailsProps> = ({ visible, onClose }) => {
    // Estados
    const [selectedTab, setSelectedTab] = useState<'monitor' | 'orders' | 'history'>('monitor');
    const [currentOrder, setCurrentOrder] = useState<ManufacturingOrder | null>(null);
    const [orderHistory, setOrderHistory] = useState<ManufacturingOrder[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<OrderDetails | null>(null);
    const [currentState, setCurrentState] = useState<MachineState | null>(null);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [dateRange, setDateRange] = useState<DateRange>({
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        startTime: '00:00',
        endTime: '23:59'
    });

    // Referencias
    const wsRef = useRef<WebSocket | null>(null);
    const bottleCountRef = useRef<number>(0);

    // Funciones de utilidad
    const formatDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    };

    // Fetch funciones
    const fetchCurrentOrder = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:3000/api/bottling/1/current-order');
            const result = await response.json();

            if (result.success) {
                setCurrentOrder(result.data);
                if (result.data) {
                    bottleCountRef.current = result.data.currentBottleCount;
                }
            }
        } catch (error) {
            console.error('Error fetching current order:', error);
        }
    }, []);


    const fetchOrderHistory = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:3000/api/bottling/1/orders');
            const result = await response.json();

            if (result.success) {
                setOrderHistory(result.data);
            }
        } catch (error) {
            console.error('Error fetching order history:', error);
        }
    }, []);

    const fetchOrderDetails = useCallback(async (orderId: number) => {
        try {
            const [orderResponse, timesResponse] = await Promise.all([
                fetch(`http://localhost:3000/api/bottling/orders/${orderId}`),
                fetch(`http://localhost:3000/api/bottling/1/production-times/order/${orderId}`)
            ]);
    
            if (!orderResponse.ok || !timesResponse.ok) {
                throw new Error('Error al obtener los detalles de la orden');
            }
    
            const orderResult = await orderResponse.json();
            const timesResult = await timesResponse.json();
    
            if (orderResult.success && timesResult.success) {
                setSelectedOrder({
                    order: orderResult.data,
                    productionTimes: timesResult.data.times,
                    summary: timesResult.data.summary
                });
            } else {
                throw new Error('Error en la respuesta del servidor');
            }
        } catch (error) {
            console.error('Error fetching order details:', error);
            // Opcional: mostrar un mensaje al usuario
            alert('Error al cargar los detalles de la orden');
        }
    }, []);

   
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // WebSocket conexión
    const connectWebSocket = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
        try {
            wsRef.current = new WebSocket('ws://192.168.20.10:8765');
    
            wsRef.current.onopen = () => {
                console.info('WebSocket connection established');
                setIsConnected(true);
            };
    
            wsRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.estados && currentOrder?.status === 'in_progress') {
                        if (data.estados.Contador) {
                            bottleCountRef.current += 1;
                        }
    
                        setCurrentState({
                            greenLight: Boolean(data.estados.Verde),
                            yellowLight: Boolean(data.estados.Amarillo),
                            redLight: Boolean(data.estados.Rojo),
                            bottleCount: bottleCountRef.current,
                            timestamp: data.timestamp,
                        });
    
                        // Actualizar la orden actual con el nuevo conteo
                        setCurrentOrder((prev) =>
                            prev
                                ? {
                                      ...prev,
                                      currentBottleCount: bottleCountRef.current,
                                  }
                                : null
                        );
                    }
                } catch (error) {
                    console.error('Error processing message:', error);
                }
            };
    
            wsRef.current.onerror = (error) => {
                console.error('WebSocket encountered an error:', error);
                setIsConnected(false);
            };
    
            wsRef.current.onclose = (event) => {
                console.info('WebSocket connection closed:', event.reason);
                setIsConnected(false);
    
                // Reconectar después de un tiempo
                setTimeout(connectWebSocket, 5000);
            };
        } catch (error) {
            console.error('Error establishing WebSocket connection:', error);
            setIsConnected(false);
    
            // Intentar reconectar después de un error
            setTimeout(connectWebSocket, 5000);
        }
    }, [currentOrder]);

    // Efectos
    useEffect(() => {
        if (visible) {
            connectWebSocket();

            fetchCurrentOrder();
            const orderInterval = setInterval(fetchCurrentOrder, 5000);

            return () => {
                clearInterval(orderInterval);
                if (wsRef.current) {
                    wsRef.current.close();
                }
                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                }
            };
        }
    }, [visible, connectWebSocket, fetchCurrentOrder]);
    useEffect(() => {
        if (selectedTab === 'history') {
            fetchOrderHistory();
        }
    }, [selectedTab, fetchOrderHistory]);

    // Componentes de renderizado
    const CurrentOrderDisplay = () => {
        if (!currentOrder) {
            return (
                <div className="no-order-message">
                    <AlertTriangle size={24} />
                    <span>No hay orden activa</span>
                </div>
            );
        }

        return (
            <div className="current-order-panel">
                <div className="order-header">
                    <h3>Orden en Progreso #{currentOrder.orderNumber}</h3>
                    <span className={`status-badge ${currentOrder.status}`}>
                        {currentOrder.status}
                    </span>
                </div>
                
                <div className="order-details">
                    <div className="detail-row">
                        <Package size={18} />
                        <div className="detail-group">
                            <span>Producto: {currentOrder.productName}</span>
                            <span>Lote: {currentOrder.batchNumber}</span>
                        </div>
                    </div>

                    <div className="production-metrics">
                        <div className="metric">
                            <Clock size={18} />
                            <span>Tiempo Activo: {formatDuration(currentOrder.activeTime)}</span>
                        </div>
                        <div className="metric">
                            <Activity size={18} />
                            <span>Eficiencia: {currentOrder.efficiency.toFixed(1)}%</span>
                        </div>
                    </div>

                    <div className="progress-bar">
                        <div 
                            className="progress"
                            style={{
                                width: `${Math.min((currentOrder.currentBottleCount / currentOrder.targetQuantity) * 100, 100)}%`
                            }}
                        />
                        <span>{currentOrder.currentBottleCount} / {currentOrder.targetQuantity}</span>
                    </div>
                </div>
            </div>
        );
    };

    // ... (continuará en la siguiente parte)// ... (continúa desde la parte anterior)

    const OrderHistoryDisplay = () => {
        return (
            <div className="order-history">
                <div className="history-filters">
                    <div className="date-range">
                        <div className="date-input">
                            <label>Desde:</label>
                            <input 
                                type="date"
                                value={dateRange.startDate}
                                onChange={(e) => setDateRange({
                                    ...dateRange,
                                    startDate: e.target.value
                                })}
                            />
                            <input 
                                type="time"
                                value={dateRange.startTime}
                                onChange={(e) => setDateRange({
                                    ...dateRange,
                                    startTime: e.target.value
                                })}
                            />
                        </div>
                        <div className="date-input">
                            <label>Hasta:</label>
                            <input 
                                type="date"
                                value={dateRange.endDate}
                                onChange={(e) => setDateRange({
                                    ...dateRange,
                                    endDate: e.target.value
                                })}
                            />
                            <input 
                                type="time"
                                value={dateRange.endTime}
                                onChange={(e) => setDateRange({
                                    ...dateRange,
                                    endTime: e.target.value
                                })}
                            />
                        </div>
                    </div>
                    <div className="quick-filters">
                        <button onClick={() => {
                            const today = format(new Date(), 'yyyy-MM-dd');
                            setDateRange({
                                startDate: today,
                                endDate: today,
                                startTime: '00:00',
                                endTime: '23:59'
                            });
                        }}>Hoy</button>
                        <button onClick={() => {
                            const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
                            setDateRange({
                                startDate: yesterday,
                                endDate: yesterday,
                                startTime: '00:00',
                                endTime: '23:59'
                            });
                        }}>Ayer</button>
                        <button onClick={() => {
                            const weekStart = format(startOfWeek(new Date(), { locale: es }), 'yyyy-MM-dd');
                            setDateRange({
                                startDate: weekStart,
                                endDate: format(new Date(), 'yyyy-MM-dd'),
                                startTime: '00:00',
                                endTime: '23:59'
                            });
                        }}>Esta Semana</button>
                    </div>
                </div>

                <div className="orders-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Orden #</th>
                                <th>Producto</th>
                                <th>Lote</th>
                                <th>Inicio</th>
                                <th>Fin</th>
                                <th>Estado</th>
                                <th>Producción</th>
                                <th>Eficiencia</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orderHistory.map(order => (
                                <tr key={order.id} className={order.status}>
                                    <td>{order.orderNumber}</td>
                                    <td>{order.productName}</td>
                                    <td>{order.batchNumber}</td>
                                    <td>{order.startTime ? format(new Date(order.startTime), 'dd/MM/yyyy HH:mm') : '-'}</td>
                                    <td>{order.endTime ? format(new Date(order.endTime), 'dd/MM/yyyy HH:mm') : '-'}</td>
                                    <td>
                                        <span className={`status-badge ${order.status}`}>
                                            {order.status === 'in_progress' ? 'En Proceso' : 
                                             order.status === 'completed' ? 'Completada' : 
                                             order.status === 'pending' ? 'Pendiente' : 
                                             order.status === 'paused' ? 'Pausada' : 'Cancelada'}
                                        </span>
                                    </td>
                                    <td>{order.currentBottleCount} / {order.targetQuantity}</td>
                                    <td>{order.efficiency.toFixed(1)}%</td>
                                    <td>
                                        <button 
                                            className="view-details-btn"
                                            onClick={() => fetchOrderDetails(order.id)}
                                        >
                                            Ver Detalles
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const OrderDetailsModal = () => {
        if (!selectedOrder) return null;

        return (
            <div className="modal-overlay">
                <div className="modal-content">
                    <div className="modal-header">
                        <h3>Detalles de Orden #{selectedOrder.order.orderNumber}</h3>
                        <button onClick={() => setSelectedOrder(null)}>×</button>
                    </div>
                    <div className="modal-body">
                        <div className="order-summary">
                            <div className="summary-section">
                                <h4>Información General</h4>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>Producto:</label>
                                        <span>{selectedOrder.order.productName}</span>
                                    </div>
                                    <div className="detail-item">
                                        <label>Lote:</label>
                                        <span>{selectedOrder.order.batchNumber}</span>
                                    </div>
                                    <div className="detail-item">
                                        <label>Estado:</label>
                                        <span className={`status-badge ${selectedOrder.order.status}`}>
                                            {selectedOrder.order.status}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="summary-section">
                                <h4>Métricas de Producción</h4>
                                <div className="metrics-grid">
                                    <div className="metric-card">
                                        <Timer size={20} />
                                        <div className="metric-content">
                                            <label>Tiempo Total Activo</label>
                                            <span>{formatDuration(selectedOrder.summary.totalProductionTime)}</span>
                                        </div>
                                    </div>
                                    <div className="metric-card">
                                        <AlertTriangle size={20} />
                                        <div className="metric-content">
                                            <label>Tiempo Total Parado</label>
                                            <span>{formatDuration(selectedOrder.summary.totalStoppedTime)}</span>
                                        </div>
                                    </div>
                                    <div className="metric-card">
                                        <Activity size={20} />
                                        <div className="metric-content">
                                            <label>Eficiencia</label>
                                            <span>{selectedOrder.summary.efficiency.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="production-times">
                                <h4>Registro de Tiempos</h4>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Inicio</th>
                                            <th>Fin</th>
                                            <th>Duración</th>
                                            <th>Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedOrder.productionTimes.map((time, index) => (
                                            <tr key={index} className={time.type}>
                                                <td>{format(new Date(time.startTime), 'HH:mm:ss')}</td>
                                                <td>{time.endTime ? format(new Date(time.endTime), 'HH:mm:ss') : 'En curso'}</td>
                                                <td>{formatDuration(time.duration)}</td>
                                                <td>{time.type === 'production' ? 'Producción' : 'Parado'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ... (continuará en la siguiente parte)// ... (continuación de las partes anteriores)

    const MachineStatus = () => {
        if (!currentState) return null;

        return (
            <div className="machine-status">
                <div className="status-lights">
                    <div className={`light red ${currentState.redLight ? 'active' : ''}`} />
                    <div className={`light yellow ${currentState.yellowLight ? 'active' : ''}`} />
                    <div className={`light green ${currentState.greenLight ? 'active' : ''}`} />
                </div>
                <div className="status-info">
                    <span className="status-label">Estado:</span>
                    <span className={`status-value ${currentState.greenLight && !currentState.redLight ? 'production' : 'stopped'}`}>
                        {currentState.greenLight && !currentState.redLight ? 'En Producción' : 'Detenido'}
                    </span>
                </div>
            </div>
        );
    };

    if (!visible) return null;

    return (
        <div className="cremer-details">
            <div className="modal-overlay">
                <div className="modal-content">
                    <div className="modal-header">
                        <h2>Monitor de Producción</h2>
                        <div className="connection-status">
                            <span className={isConnected ? 'connected' : 'disconnected'}>
                                {isConnected ? '• Conectado' : '• Desconectado'}
                            </span>
                        </div>
                        <button className="close-button" onClick={onClose}>×</button>
                    </div>

                    <div className="tabs">
                        <button 
                            className={`tab-button ${selectedTab === 'monitor' ? 'active' : ''}`}
                            onClick={() => setSelectedTab('monitor')}
                        >
                            Monitor Actual
                        </button>
                        <button 
                            className={`tab-button ${selectedTab === 'history' ? 'active' : ''}`}
                            onClick={() => setSelectedTab('history')}
                        >
                            Historial
                        </button>
                    </div>

                    <div className="tab-content">
                        {selectedTab === 'monitor' && (
                            <div className="monitor-tab">
                                <MachineStatus />
                                <CurrentOrderDisplay />
                            </div>
                        )}

                        {selectedTab === 'history' && (
                            <div className="history-tab">
                                <OrderHistoryDisplay />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {selectedOrder && <OrderDetailsModal />}
        </div>
    );
};

export default CremerDetails;