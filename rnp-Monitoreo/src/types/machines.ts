export interface BaseMachineData {
    id: string;
    nombre: string;
    tipo: MachineType;
    estados: {
      Verde: boolean;
      Amarillo: boolean;
      Rojo: boolean;
      Contador: boolean;
    };
    timers: {
      total: number;
      activa: number;
      parada: number;
    };
    lastUpdate: string | null;
    wsStatus: string;
  }
  
  export interface CremerData extends BaseMachineData {
    tipo: 'cremer';
    velocidad?: number;
    produccionHora?: number;
    temperaturaActual?: number;
    presionAire?: number;
    // Otros datos específicos de Cremer
  }
  
  export interface EncelofanadoraData extends BaseMachineData {
    tipo: 'encelofanadora';
    temperatura?: {
      superior: number;
      inferior: number;
    };
    velocidadCinta?: number;
    // Datos específicos de Encelofanadora
  }
  
  export type MachineType = 'cremer' | 'encelofanadora' | 'estuchadora';
  export type MachineData = CremerData | EncelofanadoraData;