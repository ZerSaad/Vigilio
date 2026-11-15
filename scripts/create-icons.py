"""Generate the app's own eye mark, including Android launcher assets."""
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parent.parent
def icon(size):
    scale=4
    s=size*scale
    im=Image.new('RGBA',(s,s),(24,62,57,255))
    d=ImageDraw.Draw(im)
    pts=[]
    for i in range(101):
        t=i/100
        pts.append(((.17+.66*t)*s,(.5-.30*4*t*(1-t))*s))
    for i in range(101):
        t=i/100
        pts.append(((.83-.66*t)*s,(.5+.30*4*t*(1-t))*s))
    d.line(pts+[pts[0]],fill='#e2eea9',width=max(1,int(s*.045)),joint='curve')
    d.ellipse((s*.38,s*.38,s*.62,s*.62),fill='#e2eea9')
    d.ellipse((s*.50,s*.415,s*.57,s*.485),fill='#183e39')
    return im.resize((size,size),Image.Resampling.LANCZOS)
for size in (192,512):
    icon(size).save(ROOT/'public'/f'icon-{size}.png')
res=ROOT/'android/app/src/main/res'
for density,size in {'mdpi':48,'hdpi':72,'xhdpi':96,'xxhdpi':144,'xxxhdpi':192}.items():
    folder=res/f'mipmap-{density}'
    folder.mkdir(parents=True,exist_ok=True)
    for name in ('ic_launcher.png','ic_launcher_round.png'):
        icon(size).save(folder/name)
    # Adaptive icon foregrounds keep the mark inside the Android safe area.
    fg=Image.new('RGBA',(round(size*2.25),round(size*2.25)),(24,62,57,255))
    mark=icon(size)
    fg.paste(mark,((fg.width-size)//2,(fg.height-size)//2))
    fg.save(folder/'ic_launcher_foreground.png')
print('Icônes Vigilio générées.')
