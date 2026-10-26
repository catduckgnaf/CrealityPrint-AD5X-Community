import { Boxes, Drill, LayoutGrid, Layers3, Ruler, Wrench } from "lucide-react";
import {openWorkshopRoute} from "../lib/workshopRouting";
export function WorkshopNavigation(){
 return <nav aria-label="AD5X Design workshop shortcuts" className="ad5x-workspace-nav">
  <div className="ad5x-workspace-brand"><strong>AD5X Design</strong><span>3D-print workshop</span></div>
  <div className="ad5x-workspace-actions">
   <button type="button" onClick={()=>openWorkshopRoute({tab:"Organizer"})}><LayoutGrid size={18}/> Organizers &amp; bins</button>
   <button type="button" onClick={()=>openWorkshopRoute({tab:"Jigs",jigKind:"banana"})} title="Put banana plug holes directly into the selected hollow box">Banana plugs</button>
   <button type="button" onClick={()=>openWorkshopRoute({tab:"Jigs",jigKind:"drill"})}><Drill size={18}/> Drilling &amp; jigs</button>
   <button type="button" onClick={()=>openWorkshopRoute({tab:"Jigs",jigKind:"pcb"})} title="Select PCB holder, connector panel, pogo guide, wire comb, cradle or indexed clamp"><Wrench size={18}/> PCB &amp; connectors</button>
   <button type="button" onClick={()=>openWorkshopRoute({tab:"Tray"})}><Layers3 size={18}/> Trays &amp; dividers</button>
   <button type="button" onClick={()=>openWorkshopRoute({tab:"Enclosure"})}><Boxes size={18}/> Enclosures &amp; lids</button>
  </div>
  <span className="ad5x-workspace-hint"><Ruler size={14}/> Units: mm</span>
 </nav>;
}
