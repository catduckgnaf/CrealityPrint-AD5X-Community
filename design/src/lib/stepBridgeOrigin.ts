/** Keep production's verified STEP service on 18651.
 * The separate native acceptance clone (18387) uses its private test service.
 */
export function stepBridgePort(originPort:string):number{
 return originPort==="18387"?18652:18651;
}
