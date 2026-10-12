import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import App from './App.jsx';
import { config } from './wallet.js';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <WagmiProvider config={config}>
    <QueryClientProvider client={new QueryClient()}>
      <App />
    </QueryClientProvider>
  </WagmiProvider>,
);
