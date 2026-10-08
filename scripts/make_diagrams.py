from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math

root=Path(__file__).resolve().parents[1]
out=root/'docs/images'
out.mkdir(parents=True,exist_ok=True)
font_path=r'C:\Windows\Fonts\msyh.ttc'
font=lambda size:ImageFont.truetype(font_path,size)
ink='#223037';teal='#167b72';muted='#687f7b'

def canvas(title,subtitle):
    im=Image.new('RGB',(2400,1500),'#f6f8f6');d=ImageDraw.Draw(im)
    d.rounded_rectangle((70,60,140,130),18,fill=teal)
    d.text((90,75),'拾',font=font(35),fill='white')
    d.text((165,62),title,font=font(52),fill=ink)
    d.text((165,137),subtitle,font=font(28),fill=muted)
    return im,d
def box(d,x,y,text,width=320,height=145,fill='white'):
    d.rounded_rectangle((x,y,x+width,y+height),20,fill=fill,outline='#cee1db',width=3)
    lines=text.split('\n');line_h=42
    size=29
    while size>18 and max(d.textbbox((0,0),line,font=font(size))[2] for line in lines)>width-32:
        size-=1
    for i,line in enumerate(lines):
        d.text((x+width/2,y+height/2+(i-(len(lines)-1)/2)*line_h),line,font=font(size),fill=ink,anchor='mm')
def arrow(d,points,label=None):
    d.line(points,fill=teal,width=5,joint='curve')
    (x0,y0),(x1,y1)=points[-2:];angle=math.atan2(y1-y0,x1-x0)
    tip=[(x1,y1),(x1-20*math.cos(angle-.5),y1-20*math.sin(angle-.5)),(x1-20*math.cos(angle+.5),y1-20*math.sin(angle+.5))]
    d.polygon(tip,fill=teal)
    if label:
        segments=list(zip(points[:-1],points[1:]))
        a,b=max(segments,key=lambda segment:math.dist(*segment))
        midpoint=((a[0]+b[0])/2,(a[1]+b[1])/2)
        size=25
        if a[1]==b[1]:
            while size>15 and d.textbbox((0,0),label,font=font(size))[2]>abs(a[0]-b[0])-20:size-=1
        vertical_offset=(-160 if b[1]>a[1] else 160) if a[0]==b[0] else 0
        d.text((midpoint[0]+vertical_offset,midpoint[1]-27),label,font=font(size),fill=muted,anchor='mm')

im,d=canvas('从发布到完成，状态保持一致','核心流程：校验与保存成功后反馈；只有发布者能确认找回或归还')
xs=[70,460,850,1240,1630,2020]
row=['填写寻物 / 招领\n物品、时间、地点、联系','校验并携带凭证\n时间转换为 ISO','服务再次校验\n生成编号、核对身份','共享 SQLite 写入\n请求号去重','服务确认发布成功\n打开详情 / 返回首页','其他设备同步列表\n浏览与组合搜索']
for x,t in zip(xs,row):box(d,x,310,t)
for i in range(5):arrow(d,[(xs[i]+320,382),(xs[i+1],382)])
box(d,460,580,'校验失败\n指出具体字段',fill='#fff0e8')
arrow(d,[(620,455),(620,580)],'无效输入')
arrow(d,[(460,650),(230,650),(230,455)],'回到填写')
box(d,1240,580,'写入失败\n保留输入，提示重试',fill='#fff0e8')
arrow(d,[(1400,455),(1400,580)],'未保存')
arrow(d,[(1240,650),(1010,650),(1010,455)],'不显示成功')
d.text((70,830),'找回 / 归还之后',font=font(34),fill=teal)
row=['详情查看联系方式\n复制后在应用外联系','发布者进入\n“我的发布”','服务核验 Bearer\n他人 403 拒绝','确认更新状态\n可取消，不改记录','SQLite 更新单条\n找到 / 归还 / 恢复','其他设备自动同步\n缓存和凭证保留']
for x,t in zip(xs,row):box(d,x,950,t,fill='#e8f6f1' if x in [1240,2020] else 'white')
for i in range(5):arrow(d,[(xs[i]+320,1022),(xs[i+1],1022)])
d.text((70,1250),'共享范围：连接同一个服务的不同设备；断网只能读缓存，发布和状态修改不显示假成功。',font=font(29),fill=muted)
d.text((70,1330),'寻物 open → 寻找中；resolved → 已找到。招领 open → 待认领；resolved → 已归还。',font=font(29),fill=muted)
im.save(out/'flowchart.png')

im,d=canvas('不同设备与共享服务的数据流','正式信息集中保存；服务核验发布者凭证，设备只缓存数据与自己的身份')
box(d,80,360,'设备甲\n发布 / 搜索 / 更新',width=420,height=180,fill='#e8f6f1')
box(d,710,360,'app.js + network.js\n页面与原生后台请求',width=460,height=180)
box(d,1460,360,'共享 Node HTTP 服务\n字段校验、Bearer 授权、去重',width=600,height=180)
arrow(d,[(500,420),(710,420)],'操作与输入')
arrow(d,[(1170,420),(1460,420)],'API + 凭证')
arrow(d,[(1460,505),(1170,505)],'JSON / 错误')
box(d,710,850,'设备私有存储\n凭证、缓存、草稿',width=460,height=180)
box(d,1460,850,'共享 SQLite 数据库\n发布者摘要、正式信息',width=600,height=180,fill='#e8f6f1')
arrow(d,[(850,540),(850,850)],'写入缓存')
arrow(d,[(1010,850),(1010,540)],'重开恢复')
arrow(d,[(1660,540),(1660,850)],'独立行写入')
arrow(d,[(1900,850),(1900,540)],'读取与权限核验')
box(d,80,850,'设备乙\n查看甲信息与最新状态',width=420,height=180)
arrow(d,[(290,850),(290,720),(1330,720),(1330,610),(1550,610),(1550,540)],'连接同一个服务')
d.text((80,1200),'自动测试：纯业务校验 + 实际 HTTP / SQLite + 两套独立客户端。',font=font(30),fill=muted)
d.text((80,1280),'安装验证：Android 12 APK 网络线程、原生复制、返回键、强制停止重开。',font=font(30),fill=muted)
d.text((80,1360),'范围：局域网服务可运行；公网参考尚未部署；测试不是官方评分或实体手机试玩。',font=font(30),fill=muted)
im.save(out/'dataflow.png')
print('Created flowchart.png and dataflow.png')
