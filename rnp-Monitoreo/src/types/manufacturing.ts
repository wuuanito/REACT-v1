export interface ManufacturingOrder {
    id: string;
    name: string;
    status: ManufacturingStatus;
    startTime: string;
    endTime?: string;
    currentPauseReason?: PauseReason;
    pauseHistory: PauseRecord[];
    activeTime: number;
    stoppedTime: number;
  }
  
  export enum ManufacturingStatus {
    NOT_STARTED = 'NOT_STARTED',
    RUNNING = 'RUNNING',
    PAUSED = 'PAUSED',
    FINISHED = 'FINISHED'
  }
  
  export interface PauseRecord {
    reason: PauseReason;
    startTime: string;
    endTime?: string;
    duration?: number;
  }
  
  export interface PauseReason {
    id: string;
    label: string;
    category: PauseCategory;
  }
  
  export enum PauseCategory {
    MAINTENANCE = 'MAINTENANCE',
    MATERIAL = 'MATERIAL',
    QUALITY = 'QUALITY',
    SETUP = 'SETUP',
    OTHER = 'OTHER'
  }
  
  export const PAUSE_REASONS: PauseReason[] = [
    { id: 'maintenance-preventive', label: 'Mantenimiento Preventivo', category: PauseCategory.MAINTENANCE },
    { id: 'maintenance-corrective', label: 'Mantenimiento Correctivo', category: PauseCategory.MAINTENANCE },
    { id: 'material-missing', label: 'Falta de Material', category: PauseCategory.MATERIAL },
    { id: 'material-quality', label: 'Calidad de Material', category: PauseCategory.MATERIAL },
    { id: 'quality-inspection', label: 'Inspección de Calidad', category: PauseCategory.QUALITY },
    { id: 'quality-adjustment', label: 'Ajuste de Calidad', category: PauseCategory.QUALITY },
    { id: 'setup-change', label: 'Cambio de Formato', category: PauseCategory.SETUP },
    { id: 'setup-adjustment', label: 'Ajuste de Máquina', category: PauseCategory.SETUP },
    { id: 'break-scheduled', label: 'Pausa Programada', category: PauseCategory.OTHER },
    { id: 'other', label: 'Otra Razón', category: PauseCategory.OTHER },
  ];