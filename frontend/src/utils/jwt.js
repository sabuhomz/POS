import { jwtDecode } from 'jwt-decode'
export function decodeToken(token){try{return jwtDecode(token)}catch{return null}}
export function isTokenExpired(token){const p=decodeToken(token); return !p?.exp || p.exp*1000<Date.now()}
