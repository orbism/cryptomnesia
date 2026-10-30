import { parseAbi, parseAbiItem } from 'viem';
import { createConfig, http } from 'wagmi';
import { foundry, mainnet, sepolia } from 'wagmi/chains';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';

const env = import.meta.env;
export const chain = { localhost: foundry, sepolia, mainnet }[env.VITE_CHAIN] || sepolia;
export const contract = env.VITE_CONTRACT || null;
// what the site asks of contracts/src/Cryptomnesia.sol: the calls it makes, and the events every copy leaves behind as it moves (from nobody = minted, to nobody = burned)
export const MOVED = [parseAbiItem('event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)'), parseAbiItem('event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)')];   // every mint, sale and gift leaves one of these
// where one token is on OpenSea, on the chains OpenSea knows
const SEA = { [mainnet.id]: 'https://opensea.io/assets/ethereum', [sepolia.id]: 'https://testnets.opensea.io/assets/sepolia' }[chain.id];
export const txUrl = (hash) => (chain.blockExplorers ? `${chain.blockExplorers.default.url}/tx/${hash}` : null);
export const scanToken = (id) => (contract && chain.blockExplorers ? `${chain.blockExplorers.default.url}/nft/${contract}/${id}` : null);
export const seaToken = (id) => (SEA && contract ? `${SEA}/${contract}/${id}` : null);
export const START = BigInt(env.VITE_DEPLOY_BLOCK || 0);   // the block the contract went in at, so the minted list need not search from the beginning
export const ABI = parseAbi(['function mint(uint256 id, uint256 amount) payable', 'function price() view returns (uint256)', 'function cap() view returns (uint256)', 'function paused() view returns (bool)', 'function totalSupply(uint256 id) view returns (uint256)', 'function minted() view returns (uint256[])', 'function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])']);

// the nodes the site reads through: VITE_RPC if set, else public ones that answer for 100,000 blocks of history at a time (the chains' defaults allow 1,000, and rate-limit)
const READ = { [mainnet.id]: 'https://mainnet.gateway.tenderly.co', [sepolia.id]: 'https://sepolia.gateway.tenderly.co' };
// browser wallets and Coinbase Wallet need no key. WalletConnect joins only if a project id is supplied
export const config = createConfig({
  chains: chain === mainnet ? [chain] : [chain, mainnet],   // mainnet is always there to read ENS names from
  connectors: [injected(), coinbaseWallet({ appName: 'Cryptomnesia' }), ...(env.VITE_WC_PROJECT_ID ? [walletConnect({ projectId: env.VITE_WC_PROJECT_ID })] : [])],
  transports: { [chain.id]: http(env.VITE_RPC || READ[chain.id]), [mainnet.id]: http(READ[mainnet.id]) },
});
