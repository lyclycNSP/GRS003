import { sanitizeInternalNext } from "@/lib/login-redirect";

export type PendingOAuthState = { state:string; next:string; issuedAt:number };
const MAX_PENDING=4;const MAX_AGE_MS=10*60*1000;
export function parsePendingOAuthStates(value:string|undefined,now=Date.now()):PendingOAuthState[]{
 if(!value)return[];try{const parsed=JSON.parse(Buffer.from(value,"base64url").toString("utf8"));if(!Array.isArray(parsed))return[];return parsed.filter((item):item is PendingOAuthState=>Boolean(item&&typeof item.state==="string"&&typeof item.next==="string"&&typeof item.issuedAt==="number"&&now-item.issuedAt>=0&&now-item.issuedAt<=MAX_AGE_MS)).slice(-MAX_PENDING)}catch{return[]}
}
export function encodePendingOAuthStates(states:PendingOAuthState[]){return Buffer.from(JSON.stringify(states.slice(-MAX_PENDING)),"utf8").toString("base64url")}
export function appendPendingOAuthState(states:PendingOAuthState[],state:string,next:string,now=Date.now()){return[...states.filter(item=>item.state!==state),{state,next:sanitizeInternalNext(next),issuedAt:now}].slice(-MAX_PENDING)}
export function consumePendingOAuthState(states:PendingOAuthState[],state:string|undefined){if(!state)return{matched:null,remaining:states};const matched=states.find(item=>item.state===state)??null;return{matched,remaining:matched?states.filter(item=>item.state!==state):states}}
