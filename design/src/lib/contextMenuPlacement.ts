/** Right-click root now stays near pointer, even at the right edge.
 * The one-level Hover Shelf opens on the side with more space. Retaining
 * the old 3-level width reservation would shove menus far from the click.
 */
export const ROOT_MENU_WIDTH=270;
export const HOVER_SHELF_WIDTH=292;
export const CONTEXT_MENU_MARGIN=12;

/** Third parameter retained for existing Viewport callers. Context-specific
 * shelf visibility is chosen by HoverShelf after actual viewport measurement.
 */
export function contextMenuX(clickX:number,viewportWidth:number,_hasConnector:boolean):number{
 const maxX=Math.max(6,viewportWidth-ROOT_MENU_WIDTH-CONTEXT_MENU_MARGIN);
 return Math.max(6,Math.min(clickX,maxX));
}
