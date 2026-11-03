// Measured on the 1536 × 1024 source illustration, at the glass/bezel boundary.
// The lower-right corner continues behind the laptop; the foreground mask restores that occlusion.
export const monitorCorners = [[841,207],[1421,194],[1407,622],[825,581]];
export const visibleGlass = [[841,207],[1421,194],[1411,496],[1394,495],[1365,619],[825,581]];
export const laptopOutline = [[1394,495],[1536,505],[1536,1024],[1170,1024],[1170,755],[1340,730]];
export function imageGeometry(img,stage){
 const r=img.getBoundingClientRect(),s=stage.getBoundingClientRect(),css=getComputedStyle(img);
 const iw=img.naturalWidth,ih=img.naturalHeight;if(!iw||!ih)throw Error('Studio illustration unavailable');
 const scale=css.objectFit==='contain'?Math.min(r.width/iw,r.height/ih):Math.max(r.width/iw,r.height/ih);
 const position=css.objectPosition.split(/\s+/).map((v,i)=>v.endsWith('%')?parseFloat(v)/100:i===0?.5:.5);
 const x=r.left-s.left+(r.width-iw*scale)*position[0],y=r.top-s.top+(r.height-ih*scale)*(position[1]??.5);
 return {point:([px,py])=>[x+px*scale,y+py*scale],scale,x,y};
}
export const polygon = points=>`polygon(${points.map(([x,y])=>`${x}px ${y}px`).join(',')})`;
