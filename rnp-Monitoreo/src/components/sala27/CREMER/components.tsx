import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { MachineState } from '../../../types/cremer';

// Indicador de estado
export const StatusIndicator: React.FC<{ active: boolean; color: string }> = ({ 
  active, 
  color 
}) => (
  <Box
    sx={{
      width: 20,
      height: 20,
      borderRadius: '50%',
      bgcolor: active ? color : 'grey.300',
      transition: 'background-color 0.3s ease'
    }}
  />
);

// Loader con mensaje
export const LoadingIndicator: React.FC<{ message: string }> = ({ message }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
    <CircularProgress />
    <Typography variant="body2" color="text.secondary">
      {message}
    </Typography>
  </Box>
);

// Utilidad para obtener el color según el estado
export const getStatusColor = (status: MachineState): "success" | "warning" | "error" | "default" => {
  const statusColors = {
    RUNNING: 'success',
    WARNING: 'warning',
    ERROR: 'error',
    STOPPED: 'default'
  } as const;
  return statusColors[status];
};

// Utilidad para formatear tiempo
export const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};