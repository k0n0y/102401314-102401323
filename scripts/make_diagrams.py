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
        midpoint=points[len(points)//2]
        d.text((midpoint[0]+(92 if x0==x1 else 0),midpoint[1]-27),label,font=font(25),fill=muted,anchor='mm')

im,d=canvas('从发布到完成，状态保持一致','核心流程：校验与保存成功后反馈；只有发布者能确认找回或归还')
xs=[70,460,850,1240,1630,2020]
row=['填写寻物 / 招领\n物品、时间、地点、联系','业务字段校验\n非空、长度、时间','生成新记录\n状态 open、发布者 ID','同步写入本机\nSharedPreferences.commit','发布成功\n打开详情 / 返回首页','浏览与组合搜索\n读取统一记录列表']
for x,t in zip(xs,row):box(d,x,310,t)
for i in range(5):arrow(d,[(xs[i]+320,382),(xs[i+1],382)])
box(d,460,580,'校验失败\n指出具体字段',fill='#fff0e8')
arrow(d,[(620,455),(620,580)],'无效输入')
arrow(d,[(460,650),(230,650),(230,455)],'回到填写')
box(d,1240,580,'写入失败\n保留输入，提示重试',fill='#fff0e8')
arrow(d,[(1400,455),(1400,580)],'未保存')
arrow(d,[(1240,650),(1010,650),(1010,455)],'不显示成功')
d.text((70,830),'找回 / 归还之后',font=font(34),fill=teal)
row=['详情查看联系方式\n复制后在应用外联系','发布者进入\n“我的发布”','核对发布者权限\n其他身份只读','确认更新状态\n可取消，不改记录','保存新状态\n找到 / 归还 / 恢复','列表、详情同步\n重开 App 后仍保留']
for x,t in zip(xs,row):box(d,x,950,t,fill='#e8f6f1' if x in [1240,2020] else 'white')
for i in range(5):arrow(d,[(xs[i]+320,1022),(xs[i+1],1022)])
d.text((70,1250),'边界：单设备离线共享列表；甲、乙、访客为本设备身份；不同设备不自动同步。',font=font(29),fill=muted)
d.text((70,1330),'寻物 open → 寻找中；resolved → 已找到。招领 open → 待认领；resolved → 已归还。',font=font(29),fill=muted)
im.save(out/'flowchart.png')

im,d=canvas('页面、业务与本机存储的数据流','UI 只读取统一 state；纯业务函数先产生 nextState，存储成功才替换当前 state')
box(d,80,360,'使用者\n发布 / 筛选 / 更新',width=420,height=180,fill='#e8f6f1')
box(d,710,360,'app.js\n路由、表单、列表、详情',width=460,height=180)
box(d,1460,360,'domain.js\n校验、权限、筛选、状态',width=600,height=180)
arrow(d,[(500,420),(710,420)],'操作与输入')
arrow(d,[(1170,420),(1460,420)],'state + 参数')
arrow(d,[(1460,505),(1170,505)],'nextState / errors')
box(d,710,850,'AndroidStore\n原生 JavaScript 桥',width=460,height=180)
box(d,1460,850,'SharedPreferences\n应用私有 JSON 数据',width=600,height=180,fill='#e8f6f1')
arrow(d,[(850,540),(850,850)],'commit(nextState)')
arrow(d,[(1010,850),(1010,540)],'成功后替换 state')
arrow(d,[(1170,920),(1460,920)],'同步写入')
arrow(d,[(1460,1000),(1170,1000)],'true / false；启动读取')
box(d,80,850,'系统剪贴板\n一键复制联系方式',width=420,height=180)
arrow(d,[(710,940),(500,940)],'copy(contact)')
d.text((80,1200),'业务测试：Node 直接调用同一 domain.js，无需安卓设备。',font=font(30),fill=muted)
d.text((80,1280),'安装测试：APK 内 WebView + 原生桥 + 真正的数据保存、剪贴板、返回键。',font=font(30),fill=muted)
d.text((80,1360),'数据范围：单设备离线，未配置跨设备服务；测试通过不代表课程官方评分。',font=font(30),fill=muted)
im.save(out/'dataflow.png')
print('Created flowchart.png and dataflow.png')
