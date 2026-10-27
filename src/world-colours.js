import {corncobEgaPalette as palette} from './model-engine.js';

// Tile header byte 10 is storage state; bytes 11–15 pack six six-bit channels.
// UNPACKBITS leaves the default colours alone when all five colour bytes are zero.
export function worldColours(world, positionCm) {
 const tileAt=value=>Math.max(0,Math.min(7,Math.floor((value-world.origin_cm)/world.tile_size_cm)));
 const x=tileAt(positionCm[0]),y=tileAt(positionCm[1]);
 const tile=world.tiles?.find(t=>t.x===x&&t.y===y);
 const packed=Number.parseInt(tile?.opaque_header_tail?.slice(2)||'0',16);
 if(!packed)return {ground:palette[2],sky:palette[11]};
 // JavaScript bitwise shifts truncate to 32 bits; this field is 40 bits wide.
 const component=shift=>{const value=Math.floor(packed/2**shift)&63;return (value<<2)|(value>>4);};
 return {ground:[14,8,2].map(component),sky:[32,26,20].map(component)};
}
