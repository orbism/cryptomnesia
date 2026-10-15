import { parseAbiItem, parseEther } from 'viem';
import { createConfig, http } from 'wagmi';
import { foundry, mainnet, sepolia } from 'wagmi/chains';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';

const env = import.meta.env;
export const chain = { localhost: foundry, sepolia, mainnet }[env.VITE_CHAIN] || sepolia;
export const contract = env.VITE_CONTRACT || null;
export const PRICE = parseEther('0.003');
// what the site asks of contracts/src/Cryptomnesia.sol: the one call it makes, and the events every copy leaves behind as it moves (from nobody = minted, to nobody = burned)
export const MOVED = [parseAbiItem('event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)'), parseAbiItem('event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)')];   // every mint, sale and gift leaves one of these
// where one token is on OpenSea, on the chains OpenSea knows
const SEA = { [mainnet.id]: 'https://opensea.io/assets/ethereum', [sepolia.id]: 'https://testnets.opensea.io/assets/sepolia' }[chain.id];
export const txUrl = (hash) => (chain.blockExplorers ? `${chain.blockExplorers.default.url}/tx/${hash}` : null);
export const scanToken = (id) => (contract && chain.blockExplorers ? `${chain.blockExplorers.default.url}/nft/${contract}/${id}` : null);
export const seaToken = (id) => (SEA && contract ? `${SEA}/${contract}/${id}` : null);
export const START = BigInt(env.VITE_DEPLOY_BLOCK || 0);   // the block the contract went in at, so the minted list need not search from the beginning
export const ABI = [{ type: 'function', name: 'mint', stateMutability: 'payable', inputs: [{ name: 'id', type: 'uint256' }, { name: 'amount', type: 'uint256' }], outputs: [] }];

// browser wallets and Coinbase Wallet need no key. WalletConnect joins only if a project id is supplied
export const config = createConfig({
  chains: chain === mainnet ? [chain] : [chain, mainnet],   // mainnet is always there to read ENS names from
  connectors: [injected(), coinbaseWallet({ appName: 'Cryptomnesia' }), ...(env.VITE_WC_PROJECT_ID ? [walletConnect({ projectId: env.VITE_WC_PROJECT_ID })] : [])],
  transports: { [chain.id]: http(), [mainnet.id]: http() },
});
