/** Remove only near-white pixels connected to the image border, keeping white packaging inside. */
export function removeProductBackdrop(pixels:Uint8ClampedArray,width:number,height:number){
 const result=new Uint8ClampedArray(pixels),size=width*height;
 if(width<1||height<1||pixels.length!==size*4)return result;
 const visited=new Uint8Array(size),queue=new Int32Array(size);let head=0,tail=0;
 const enqueue=(index:number)=>{
  if(visited[index])return;
  visited[index]=1;
  const offset=index*4,r=result[offset],g=result[offset+1],b=result[offset+2];
  if(result[offset+3]!==0&&(Math.min(r,g,b)<235||Math.max(r,g,b)-Math.min(r,g,b)>18))return;
  queue[tail++]=index;
 };
 for(let x=0;x<width;x++){enqueue(x);enqueue((height-1)*width+x);}
 for(let y=0;y<height;y++){enqueue(y*width);enqueue(y*width+width-1);}
 while(head<tail){const index=queue[head++],x=index%width,y=Math.floor(index/width);result[index*4+3]=0;if(x)enqueue(index-1);if(x<width-1)enqueue(index+1);if(y)enqueue(index-width);if(y<height-1)enqueue(index+width);}
 return result;
}
