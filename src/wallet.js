import { parseEther } from 'viem';
import { createConfig, http } from 'wagmi';
import { foundry, mainnet, sepolia } from 'wagmi/chains';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';

const env = import.meta.env;
export const chain = { localhost: foundry, sepolia, mainnet }[env.VITE_CHAIN] || sepolia;
export const contract = env.VITE_CONTRACT || null;
export const PRICE = parseEther('0.003');
// the one call the site makes on contracts/src/Cryptomnesia.sol
export const ABI = [{ type: 'function', name: 'mint', stateMutability: 'payable', inputs: [{ name: 'id', type: 'uint256' }, { name: 'amount', type: 'uint256' }], outputs: [] }];

// browser wallets and Coinbase Wallet need no key. WalletConnect joins only if a project id is supplied
export const config = createConfig({
  chains: chain === mainnet ? [chain] : [chain, mainnet],   // mainnet is always there to read ENS names from
  connectors: [injected(), coinbaseWallet({ appName: 'Cryptomnesia' }), ...(env.VITE_WC_PROJECT_ID ? [walletConnect({ projectId: env.VITE_WC_PROJECT_ID })] : [])],
  transports: { [chain.id]: http(), [mainnet.id]: http() },
});
