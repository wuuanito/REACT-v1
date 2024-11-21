// src/types/index.ts

export interface GPIOStates {
    Verde: boolean;    // Pin 21
    Amarillo: boolean; // Pin 4
    Rojo: boolean;     // Pin 27
    Contador: boolean; // Pin 13
  }
  
  export interface WSMessage {
    timestamp: string;
    estados: GPIOStates;
  }
  
  export interface Timers {
    active: number;
    stopped: number;
  }
  
  export interface ProductionStats {
    totalUnits: number;
    ratePerMinute: number;
    ratePerHour: number;
    efficiency: number;
    quality: number;
  }
  
  export interface BatchInfo {
    id: string;
    startTime: Date;
    endTime?: Date;
    totalUnits: number;
    targetUnits?: number;
  }
  
  export interface CremerProps {
    nombre?: string;
  }
  
  export interface BackendData {
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
  
  // Tipos adicionales que podrías necesitar
  export interface AlertInfo {
    type: 'error' | 'warning' | 'info';
    message: string;
    timestamp: Date;
  }
  
  export interface MachineConfig {
    id: number;
    name: string;
    ipAddress: string;
    wsPort: number;
  }
  
  export interface MaintenanceLog {
    id: string;
    timestamp: Date;
    type: 'preventive' | 'corrective';
    description: string;
    duration: number;
  }
  

  // types.ts
export type ModoOperacion = 'Produciendo' | 'Parada' | 'Standby';
export type EstadoMaquina = 'Funcionando' | 'Detenida' | 'Mantenimiento' | 'Error';

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

export interface Alerta {
  id: string;
  tipo: 'advertencia' | 'error' | 'info';
  mensaje: string;
  fecha: string;
}