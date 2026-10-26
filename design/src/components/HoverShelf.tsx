import {useEffect,useRef,useState,type ReactNode} from "react";
import {ChevronRight,type LucideIcon} from "lucide-react";

/** The selected #01 Hover Shelf: one root and ONE immediately adjacent shelf.
 * Side selection is based on the viewport at OPEN time, not a guessed global
 * cascade width. The main menu remains mouse- and keyboard-accessible.
 */
export type HoverShelfGroup = {
  id:string;
  label:string;
  icon:LucideIcon;
  contents:ReactNode;
};
export function hoverShelfSide(
  rootLeft:number,rootRight:number,viewLeft:number,viewRight:number,
  shelfWidth=292,
):"left"|"right" {
  const left=Math.max(0,rootLeft-viewLeft);
  const right=Math.max(0,viewRight-rootRight);
  return right<shelfWidth+8 && left>right ? "left":"right";
}

export function HoverShelf({
  title,hint,kind,groups,quick,footer,
}:{
  title:string;hint:string;kind:"shape"|"empty";
  groups:HoverShelfGroup[];quick?:ReactNode;footer?:ReactNode;
}){
  const [active,setActive]=useState<string|null>(null);
  const [side,setSide]=useState<"left"|"right">("right");
  const root=useRef<HTMLDivElement>(null);
  const idList=groups.map(g=>g.id).join("|");
  useEffect(()=>{
    if(active&&!groups.some(g=>g.id===active))setActive(null);
  },[active,idList]);
  const select=(id:string)=>{
    const host=root.current;
    const viewport=host?.closest(".design-viewport");
    if(host && viewport){
      const rootRect=host.getBoundingClientRect();
      const viewRect=viewport.getBoundingClientRect();
      setSide(hoverShelfSide(rootRect.left,rootRect.right,viewRect.left,viewRect.right));
    }
    setActive(id);
  };
  const current=groups.find(g=>g.id===active);
  return <div className={"design-context-host design-hover-shelf-host"+(side==="left"?" opens-left":"")}
    onPointerDown={e=>e.stopPropagation()}
    onPointerMove={e=>e.stopPropagation()}
    onPointerUp={e=>e.stopPropagation()}
    onPointerLeave={()=>setActive(null)}
    onContextMenu={e=>e.preventDefault()}
    onKeyDown={e=>{
      if(e.key==="Escape"&&active){e.stopPropagation();setActive(null);}
      if(e.key==="ArrowLeft"&&active){e.preventDefault();setActive(null);}
    }}>
    <div className="design-context-menu design-hover-shelf-root" ref={root} role="menu"
      aria-label={kind==="empty"?"Build plate actions":"Selected shape actions"}>
      <div className="design-hover-shelf-heading">
        <strong title={title}>{title}</strong>
        <span>{hint}</span>
      </div>
      {quick&&<div className="design-hover-shelf-quick">{quick}</div>}
      <div className="design-hover-shelf-categories" aria-label="Tool categories">
        {groups.map(g=>{
          const Icon=g.icon;
          const selected=g.id===active;
          return <button key={g.id} type="button" role="menuitem"
            data-shelf-group={g.id}
            className={"design-context-item design-hover-shelf-trigger"+(selected?" is-active":"")}
            aria-haspopup="menu" aria-expanded={selected}
            onPointerEnter={()=>select(g.id)}
            onFocus={()=>select(g.id)}
            onClick={()=>select(g.id)}
            onKeyDown={e=>{
              if(e.key==="ArrowRight"||e.key==="Enter"){e.preventDefault();select(g.id);}
            }}>
            <Icon aria-hidden="true" size={16} strokeWidth={1.7}/>
            <span>{g.label}</span>
            <ChevronRight size={15} aria-hidden="true" className="design-context-arrow"/>
          </button>;
        })}
      </div>
      {footer&&<div className="design-hover-shelf-footer">{footer}</div>}
    </div>
    {current&&<div className="design-hover-shelf-panel" role="menu"
      aria-label={current.label+" tools"} data-shelf-panel={current.id}
      onKeyDown={e=>{
        if(e.key==="Escape"||e.key==="ArrowLeft"){e.stopPropagation();setActive(null);}
      }}>
      <div className="design-hover-shelf-panel-heading">{current.label}</div>
      <div className="design-hover-shelf-panel-items">{current.contents}</div>
    </div>}
  </div>;
}
