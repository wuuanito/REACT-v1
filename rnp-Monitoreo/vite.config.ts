import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.png', '**/*.jpg', '**/*.jpeg'],
  resolve: {
    alias: {
      '@emotion/styled': '@emotion/styled/base',
    },
  },
 
});
