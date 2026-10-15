import { useState } from 'react';
import { formatEther } from 'viem';
import { useAccount, useConnect, useDisconnect, useEnsName, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { PAGES } from './lib.js';
import Ornate from './Ornate.jsx';
import { ABI, chain, contract, PRICE } from './wallet.js';

// a name if the address has one (names live on mainnet, whatever chain the edition is on), else its last four
export function Who({ address }) {
  const { data: ens } = useEnsName({ address, chainId: 1 });
  return ens || `0x...${address.slice(-4)}`;
}

export function Wallet() {
  const { address } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  if (address) return <button type="button" onClick={() => disconnect()}><span className="me"><Who address={address} /></span> · disconnect</button>;
  if (!open) return <button type="button" onClick={() => setOpen(true)}>connect wallet</button>;
  return <span className="wallets">{connectors.map((c) => <button type="button" key={c.uid} onClick={() => connect({ connector: c })}>{c.name}</button>)}</span>;
}

// what went wrong, said plainly
const why = (e) => {
  const m = `${e.name} ${e.shortMessage || e.message}`;
  if (/rejected|denied/i.test(m)) return 'Not signed. Nothing was sent.';
  if (/insufficient funds/i.test(m)) return 'Not enough ETH in this wallet for that, and the gas.';
  if (/SoldOut/.test(m)) return 'There are not that many left of this memory.';
  if (/WrongPrice/.test(m)) return 'The contract wants a different price. Nothing was sent.';
  return e.shortMessage || e.message;
};

// mint the page being read. the button is a sentence on three lines: mint [how many] edition(s) / of this memory / for [what it comes to]. under it, one line that says where things stand
export function Mint({ id }) {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading, isSuccess, error: failed } = useWaitForTransactionReceipt({ hash });
  const [n, setN] = useState(1), [sent, setSent] = useState(1), busy = isPending || isLoading;
  if (!contract) return <div className="mint"><p className="note">mintable very soon!</p></div>;
  if (!address) return <div className="mint"><p className="note">Connect a wallet to mint this memory · {formatEther(PRICE)} ETH on {chain.name}</p></div>;
  const step = (d) => { reset(); setN((x) => Math.min(99, Math.max(1, x + d))); };
  const mint = async () => {
    try {
      setSent(n);
      if (chainId !== chain.id) await switchChainAsync({ chainId: chain.id });
      await writeContractAsync({ address: contract, abi: ABI, functionName: 'mint', args: [BigInt(id), BigInt(n)], value: PRICE * BigInt(n), chainId: chain.id });
    } catch { /* said in the line below */ }
  };
  const says = error ? why(error) : failed ? 'It was sent and it did not go through. Nothing was minted.' : isPending ? 'Waiting on your wallet.' : isLoading ? 'Sent. Waiting for it to be mined.' : isSuccess ? <>Minted. <a href={`#editions/${Object.keys(PAGES)[id - 1]}`}>{sent === 1 ? 'One edition of this memory is' : `${sent} editions of this memory are`} yours.</a></> : '';   // the line goes straight to it on the editions page
  return (
    <div className="mint">
      <Ornate className={busy ? 'mintbox busy' : 'mintbox'} role="button" tabIndex={0} onClick={mint} onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && mint()}>
        <span>mint<span className="qty" onClick={(e) => e.stopPropagation()}><button type="button" onClick={() => step(-1)} disabled={n < 2} aria-label="one fewer">▼</button><b>{n}</b><button type="button" onClick={() => step(1)} disabled={n > 98} aria-label="one more">▲</button></span>{n === 1 ? 'edition' : 'editions'}</span>
        <span>of this memory</span>
        <span>for <b className="eth">{formatEther(PRICE * BigInt(n))}</b> ETH</span>
      </Ornate>
      <p className="note" aria-live="polite">{says}</p>
    </div>
  );
}
