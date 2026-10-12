import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// relative base so the built site can be served from any path, including an IPFS gateway
export default defineConfig({ base: './', plugins: [react()] });
