import { useEffect, useState } from 'react';
import { formatEther } from 'viem';
import { useAccount, useConnect, useDisconnect, useEnsName, useReadContracts, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { PAGES } from './lib.js';
import Ornate from './Ornate.jsx';
import { ABI, chain, contract } from './wallet.js';

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
  return <span className="wallets">{connectors.map((c) => <button type="button" key={c.uid} onClick={() => connect({ connector: c, chainId: chain.id })}>{c.name}</button>)}</span>;
}

// one character going round beside anything that is waiting on something, so it never looks stuck
export function Turning() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % 4), 130); return () => clearInterval(t); }, []);
  return <span className="turning" aria-hidden="true">{'|/-\\'[i]}</span>;
}

// what went wrong, said plainly
const why = (e) => {
  const m = `${e.name} ${e.shortMessage || e.message}`;
  if (/rejected|denied/i.test(m)) return 'Not signed. Nothing was sent.';
  if (/insufficient funds/i.test(m)) return 'Not enough ETH in this wallet for that, and the gas.';
  if (/SoldOut/.test(m)) return 'There are not that many left of this memory.';
  if (/Paused/.test(m)) return 'Minting is paused right now. Nothing was sent.';
  if (/WrongPrice/.test(m)) return 'The contract wants a different price. Nothing was sent.';
  if (/ChainMismatch/.test(m)) return 'Your wallet stayed on another network. Nothing was sent.';
  if (/HttpRequest|Timeout|Failed to fetch|NetworkError|fetch failed/i.test(m)) return 'Couldn’t reach the chain. Try again.';
  return e.shortMessage || e.message;
};

// mint the page being read. the button is a sentence on three lines: mint [how many] edition(s) / of this memory / for [what it comes to]. under it, one line that says where things stand
export function Mint({ id }) {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, data: hash, isPending, error, reset } = useWriteContract();
  const { data: receipt, isLoading, isSuccess, error: failed } = useWaitForTransactionReceipt({ hash });
  // mined is not minted: a mint cancelled or replaced in the wallet is followed to the transaction that took its place, which succeeds and mints nothing. only one that left a transfer from the contract counts
  const minted = isSuccess && receipt.logs.some((l) => l.address.toLowerCase() === contract.toLowerCase());
  // the price, how many are left and whether minting is paused, from the contract itself: what it was deployed with is what it charges
  const ask = (functionName, args) => ({ address: contract, abi: ABI, functionName, args, chainId: chain.id });
  const { data: got, refetch, isError: unread } = useReadContracts({ contracts: [ask('price'), ask('cap'), ask('totalSupply', [BigInt(id)]), ask('paused')], allowFailure: false, query: { enabled: !!contract } });
  const [price, cap, made, paused] = got || [], left = cap ? Number(cap - made) : 99;
  const [n, setN] = useState(1), [sent, setSent] = useState(1), [oops, setOops] = useState(null), busy = isPending || isLoading;
  useEffect(() => { if (isSuccess) refetch(); }, [isSuccess, refetch]);
  useEffect(() => { if (left > 0) setN((x) => Math.min(x, left)); }, [left]);
  if (!contract) return <div className="mint"><p className="note">mintable very soon!</p></div>;
  if (unread) return <div className="mint"><p className="note">The contract would not answer. <button type="button" onClick={() => refetch()}>ask again</button></p></div>;
  if (price === undefined) return <div className="mint"><p className="note">Asking the contract <Turning /></p></div>;
  if (paused && !minted) return <div className="mint"><p className="note">Minting is paused for now.</p></div>;
  if (!address) return <div className="mint"><p className="note">Connect a wallet to mint this memory · {formatEther(price)} ETH on {chain.name}</p></div>;
  if (left < 1 && !minted) return <div className="mint"><p className="note">Every edition of this memory has been minted.</p></div>;
  const step = (d) => { reset(); setOops(null); setN((x) => Math.min(Math.min(99, left), Math.max(1, x + d))); };
  const mint = async () => {
    try {
      setSent(n); setOops(null); reset();
      if (chainId !== chain.id) {
        try { await switchChainAsync({ chainId: chain.id }); }
        catch (e) { return setOops(/rejected|denied/i.test(`${e.name} ${e.shortMessage || e.message}`) ? 'Your wallet stayed on another network. Nothing was sent.' : `Your wallet can’t add ${chain.name}.`); }
      }
      await writeContractAsync({ address: contract, abi: ABI, functionName: 'mint', args: [BigInt(id), BigInt(n)], value: price * BigInt(n), chainId: chain.id });
    } catch { /* said in the line below */ }
  };
  const says = oops || (error ? why(error)
    : failed ? (/HttpRequest|Timeout|fetch/i.test(`${failed.name} ${failed.message}`) ? why(failed) : 'It was sent and it did not go through. Nothing was minted.')
    : isPending ? <>Waiting on your wallet <Turning /></>
    : isLoading ? <><span className="line">Sent. <Turning /></span>Somewhere, it is being written down.</>
    : minted ? <><span className="won">Remembered.</span><a href={`#editions/${Object.keys(PAGES)[id - 1]}`}>{sent === 1 ? 'One edition of this memory is' : `${sent} editions of this memory are`} yours.</a></>   // the line goes straight to it on the editions page
    : isSuccess ? 'It was cancelled in your wallet. Nothing was minted.' : '');
  return (
    <div className="mint">
      <Ornate className={busy ? 'mintbox busy' : 'mintbox'} role="button" tabIndex={0} onClick={mint} onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && mint()}>
        <span>mint<span className="qty" onClick={(e) => e.stopPropagation()}><button type="button" onClick={() => step(-1)} disabled={n < 2} aria-label="one fewer">▼</button><b>{n}</b><button type="button" onClick={() => step(1)} disabled={n >= Math.min(99, left)} aria-label="one more">▲</button></span>{n === 1 ? 'edition' : 'editions'}</span>
        <span>of this memory</span>
        <span>for <b className="eth">{formatEther(price * BigInt(n))}</b> ETH</span>
      </Ornate>
      <p className="note" aria-live="polite">{says}</p>
    </div>
  );
}
