import sharp from "sharp";
export async function sanitiseImage(file:File){
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size===0||file.size>5*1024*1024)throw new Error("Choose a JPG, PNG or WebP image no larger than 5 MB.");
 const bytes=Buffer.from(await file.arrayBuffer());
 try{const metadata=await sharp(bytes,{limitInputPixels:20000000,animated:false}).metadata();if(!["jpeg","png","webp"].includes(metadata.format??"")||(metadata.pages??1)>1)throw new Error();return await sharp(bytes,{limitInputPixels:20000000,animated:false}).rotate().resize({width:1800,height:1800,fit:"inside",withoutEnlargement:true}).webp({quality:85}).toBuffer();}catch{throw new Error("This image could not be read. Use a standard, non-animated JPG, PNG or WebP image.");}
}
