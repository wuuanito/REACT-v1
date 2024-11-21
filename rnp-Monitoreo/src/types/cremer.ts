export interface MachineStatus {
    isProducing: boolean;
    isStopped: boolean;
    hasStandby: boolean;
    isStandby?: boolean;
  }
  
  export interface ProductionStats {
    goodUnits: number;
    badUnits: number;
    currentProductionPercentage: number;
  }
  
  export interface ProductionTimes {
    activityTime: number;      // en segundos
    stopTime: number;          // en segundos
    accumulatedTimes: {
      production: number;      // en segundos
      stoppage: number;        // en segundos
      standby?: number;        // en segundos
    };
  }
  
  export interface ProductionOrder {
    orderNumber: string;
    description: string;
    startTime: string;        // ISO string
    endTime: string;          // ISO string
    pauseTime?: string;       // ISO string
  }
  
  export interface MachineDetails {
    machineId: string;
    status: MachineStatus;
    stats: ProductionStats;
    times: ProductionTimes;
    order: ProductionOrder;
    lastUpdate: string;        // ISO string
  }
  
  