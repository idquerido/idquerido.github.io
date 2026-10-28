#!/usr/bin/env python3
"""Querido Personal: recolor original approved icon with gradient V5.
Does not redraw the people. Source assets are read-only and pinned by SHA256.
"""
import argparse
import hashlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

TOP=np.array([0xD9,0xEE,0xEA],dtype=np.float32)
BOTTOM=np.array([0xA7,0xD1,0xC9],dtype=np.float32)


def _subject_and_holes(image):
    a=np.asarray(image.convert("RGB"),dtype=np.float32)
    r,g,b=np.moveaxis(a,-1,0)
    chrom=np.maximum(np.maximum(b-r-5,0),np.maximum(r-g-6,0))
    sub=np.clip(chrom/16.0,0,1)*np.clip((246-a.mean(axis=2))/64.0,0,1)
    ink=sub>.5
    raw=ndi.binary_fill_holes(ink)&~ink
    labels,n=ndi.label(raw)
    counts=np.bincount(labels.ravel())
    cutoff=max(8,int(image.width*image.height*.000025))
    holes=(labels>0)&(counts[labels]>=cutoff)
    return sub,ink,holes


def _protected(image,reference512):
    w,h=image.size
    sub,ink,holes=_subject_and_holes(image)
    # Restore original cream facial areas in the full-resolution artwork by
    # reference to the unchanged original 512x512 logo, not by painting new faces.
    skin=np.zeros((h,w),dtype=np.float32)
    if reference512 is not None:
        if reference512.size!=(512,512):
            raise ValueError("Approved reference icon must be 512x512")
        _,refink,_=_subject_and_holes(reference512)
        reflabels,_=ndi.label(ndi.binary_fill_holes(refink)&~refink)
        face=np.zeros((512,512),dtype=np.uint8)
        for x,y in [(184,112),(320,192)]:
            num=int(reflabels[y,x])
            if not num:
                raise ValueError("Facial mask not detected in original source")
            face[reflabels==num]=255
        skin=np.asarray(Image.fromarray(face,"L").resize((w,h),Image.Resampling.BILINEAR),dtype=np.float32)/255
    seams=ndi.binary_closing(ink,iterations=max(1,round(w/512*4)))&~ink
    keep=np.maximum(holes.astype(np.float32),seams.astype(np.float32)*.94)
    keep=ndi.gaussian_filter(keep,sigma=max(.4,w/512*.65))
    return np.maximum(sub,np.maximum(keep,skin))


def _gradient(w,h):
    yy,xx=np.mgrid[:h,:w]
    t=np.clip(.16*(xx/max(1,w-1))+.84*(yy/max(1,h-1)),0,1)[...,None]
    return TOP[None,None,:]*(1-t)+BOTTOM[None,None,:]*t


def recolor(original,reference512=None,return_mask=False):
    src=original.convert("RGB")
    a=np.asarray(src,dtype=np.float32)
    h,w=a.shape[:2]
    protect=_protected(src,reference512)
    scale=4
    tile=Image.new("L",(w*scale,h*scale),0)
    ImageDraw.Draw(tile).rounded_rectangle(
        (int(w*.06*scale),int(h*.058*scale),
         int(w*.94*scale),int(h*.94*scale)),
        radius=int(w*.224*scale),fill=255)
    tile=tile.resize((w,h),Image.Resampling.LANCZOS)
    tile=tile.filter(ImageFilter.GaussianBlur(max(.35,w/512*.6)))
    bgmask=np.asarray(tile,dtype=np.float32)/255
    alpha=(bgmask*(1-protect))[...,None]
    output=a*(1-alpha)+_gradient(w,h)*alpha
    image=Image.fromarray(np.uint8(np.clip(output+.5,0,255)),"RGB")
    return (image,protect) if return_mask else image


def make_maskable(original,reference512):
    src=original.convert("RGB")
    _,fg=recolor(src,reference512,return_mask=True)
    yy,xx=np.where(fg>.6)
    if len(xx)<100:
        raise ValueError("No original illustration located")
    box=(int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1))
    figure=src.convert("RGBA")
    figure.putalpha(Image.fromarray(np.uint8(np.clip(fg*255,0,255)),"L"))
    figure=figure.crop(box)
    scale=328.0/figure.height
    figure=figure.resize((round(figure.width*scale),round(figure.height*scale)),
                         Image.Resampling.LANCZOS)
    base=np.zeros((512,512,3),dtype=np.uint8)
    for row in range(512):
        t=row/511
        base[row,:,:]=np.round(TOP*(1-t)+BOTTOM*t).astype(np.uint8)
    result=Image.fromarray(base,"RGB").convert("RGBA")
    result.alpha_composite(figure,((512-figure.width)//2,(512-figure.height)//2))
    return result.convert("RGB")


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--source",required=True)
    parser.add_argument("--reference",required=True)
    parser.add_argument("--out",required=True)
    parser.add_argument("--mode",required=True,choices=["icons","official"])
    parser.add_argument("--expected-sha256",required=True)
    args=parser.parse_args()
    source=Path(args.source)
    raw=source.read_bytes()
    digest=hashlib.sha256(raw).hexdigest()
    if digest!=args.expected_sha256:
        raise RuntimeError("Original approved source checksum differs: "+digest)
    original=Image.open(source).convert("RGB")
    reference=Image.open(args.reference).convert("RGB")
    out=Path(args.out)
    out.mkdir(parents=True,exist_ok=True)
    if args.mode=="official":
        if original.size!=(1254,1254):
            raise RuntimeError("Official original logo dimensions differ")
        destination=out/"LOGO_QUERIDO_PERSONAL_OFICIAL.png"
        recolor(original,reference).save(destination,optimize=True)
        print("LOGO_OFICIAL_V5",destination,destination.stat().st_size)
    else:
        if original.size!=(512,512):
            raise RuntimeError("Original app icon dimensions differ")
        rendered=recolor(original,reference)
        for size in (180,192,512):
            image=rendered.resize((size,size),Image.Resampling.LANCZOS)
            destination=out/("querido-personal-%d.png"%size)
            image.save(destination,optimize=True)
            print("ICON_V5",size,destination.stat().st_size)
        destination=out/"querido-personal-maskable-512.png"
        make_maskable(original,reference).save(destination,optimize=True)
        print("MASKABLE_V5",destination.stat().st_size)

if __name__=="__main__":
    main()
