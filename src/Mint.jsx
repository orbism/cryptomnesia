import { useState } from 'react';
import { useAccount, useConnect, useDisconnect, useEnsName, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { ABI, chain, contract, PRICE } from './wallet.js';

export function Wallet() {
  const { address } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: ens } = useEnsName({ address, chainId: 1 });      // names live on mainnet, whatever chain the edition is on
  const [open, setOpen] = useState(false);
  if (address) return <button type="button" onClick={() => disconnect()}>{ens || `0x...${address.slice(-4)}`} · disconnect</button>;
  if (!open) return <button type="button" onClick={() => setOpen(true)}>connect wallet</button>;
  return <span className="wallets">{connectors.map((c) => <button type="button" key={c.uid} onClick={() => connect({ connector: c })}>{c.name}</button>)}</span>;
}

// mint the page being read as one edition of its token
export function Mint({ id }) {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });
  if (!contract) return <p className="note">Minting opens when the edition contract is deployed.</p>;
  if (!address) return <p className="note">Connect a wallet to mint this page · 0.003 ETH on {chain.name}</p>;
  const mint = async () => {
    try {
      if (chainId !== chain.id) await switchChainAsync({ chainId: chain.id });
      await writeContractAsync({ address: contract, abi: ABI, functionName: 'mint', args: [BigInt(id), 1n], value: PRICE, chainId: chain.id });
    } catch { /* shown through `error` below */ }
  };
  return (
    <p className="note">
      <button type="button" onClick={mint} disabled={isPending || isLoading}>{isPending ? 'confirm in your wallet' : isLoading ? 'minting' : isSuccess ? 'minted · mint another' : 'mint this page · 0.003 ETH'}</button>
      {error && <span> {error.shortMessage || error.message}</span>}
    </p>
  );
}
