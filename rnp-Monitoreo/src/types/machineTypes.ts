// src/types/machineTypes.ts
export type ModoOperacion = 'Produciendo' | 'Parada' | 'Standby';
export type EstadoMaquina = 'Funcionando' | 'Detenida' | 'Mantenimiento' | 'Error';
export type TipoAlerta = 'advertencia' | 'error' | 'info';
export type ConnectionStatusType = 'connecting' | 'connected' | 'disconnected' | 'error';

// Tipos base para mensajes WebSocket
interface BaseWSMessage {
  type: string;
  timestamp: string;
  message?: string;
}

// Interfaces específicas para cada tipo de mensaje
export interface InitialDataMessage extends BaseWSMessage {
  type: 'initialData';
  data: DatosMaquina[];
}

export interface MachineUpdateMessage extends BaseWSMessage {
  type: 'machineUpdate';
  data: DatosMaquina[];
}

export interface ErrorMessage extends BaseWSMessage {
  type: 'error';
  message: string;
  data: null;
}

export interface ConnectionMessage extends BaseWSMessage {
  type: 'connection';
  status: ConnectionStatusType;
  data: null;
}

// Unión de todos los tipos de mensajes posibles
export type WebSocketMessage = 
  | InitialDataMessage 
  | MachineUpdateMessage 
  | ErrorMessage 
  | ConnectionMessage;

// Interfaces para los datos de la máquina
export interface OrdenFabricacion {
  numero: string;
  descripcion: string;
  inicio: string;
  fin: string | null;
  pausaActual: string | null;
  tiempoTotal: number;
  unidadesBuenas: number;
  unidadesMalas: number;
  porcentajeCompletado: number;
}

export interface TiemposProduccion {
  produciendo: number;
  parada: number;
  standby: number;
  total: number;
}

export interface EstadisticasMaquina {
  temperatura: number;
  presion: number;
  velocidad: number;
  eficiencia: number;
  estado: EstadoMaquina;
  ultimoMantenimiento: string;
  proximoMantenimiento: string;
  horasProduccionTotal: number;
  tasaProduccion: number;
}

export interface Alerta {
  id: string;
  tipo: TipoAlerta;
  mensaje: string;
  fecha: string;
}

export interface DatosMaquina {
  id: string;
  nombre: string;
  modelo: string;
  numeroSerie: string;
  fechaInstalacion: string;
  estadisticas: EstadisticasMaquina;
  alertas: Alerta[];
  ordenActual: OrdenFabricacion;
  tiempos: TiemposProduccion;
  modoOperacion: ModoOperacion;
}