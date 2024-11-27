export interface MachineStatus {
  status: MachineState;
  lights: {
    green: boolean;
    yellow: boolean;
    red: boolean;
  };
  counter: boolean;
  timestamp: string;
}

export type MachineState = 'RUNNING' | 'WARNING' | 'ERROR' | 'STOPPED';

export interface WebSocketData {
  estados: {
    Verde: boolean;
    Amarillo: boolean;
    Rojo: boolean;
    Contador: boolean;
  };
  timestamp: string;
}

export interface HistoryRecord {
  id: number;
  timestamp: string;
  machineState: MachineState;
  verde: boolean;
  amarillo: boolean;
  rojo: boolean;
  contador: boolean;
  duration?: number;
  orderId?: number;
}

export interface MachineStats {
  totalTime: number;
  runningTime: number;
  stoppedTime: number;
  errorTime: number;
  efficiency: number;
  totalCycles: number;
}

export interface ProductionData {
  time: string;
  value: number;
}

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface ActiveOrder {
  id: number;
  orderNumber: string;
  productName: string;
  targetQuantity: number;
  currentQuantity: number;
  status: OrderStatus;
  startTime: string;
  endTime?: string;
}

export type OrderStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}