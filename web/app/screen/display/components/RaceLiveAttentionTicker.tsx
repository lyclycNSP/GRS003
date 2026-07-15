import type { RaceLiveAttentionSnapshot } from "@/lib/race-live/contracts";

export function RaceLiveAttentionTicker({ items }: { items: RaceLiveAttentionSnapshot[] }) {
  return <section className="race-live-attention" data-testid="race-live-attention">
    <div><b>风险与违规</b><small>{items.length} 项待处理</small></div>
    {(items.length ? items.slice(0, 4) : [null]).map((item, index) => item ? <article key={item.itemId}><time>{new Date(item.updatedAt).toLocaleTimeString("zh-CN", { hour12: false })}</time><b>{item.category}</b><span>{item.factualSummary}</span><em>{item.severity}</em></article> : <article key={index}><span>当前组暂无风险、违规或阻塞事件</span></article>)}
  </section>;
}
