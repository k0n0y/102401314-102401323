# 共享服务部署

局域网只需Node24：npm start或双击“启动共享服务.cmd”，保持窗口运行。默认0.0.0.0:8787，数据库data/shiguang.sqlite。首次为空，重启不会重置。

## 公网自行部署参考（未云端实测）

在有持久磁盘的主机上传源码，安装Node24，用服务管理器运行node server/server.cjs。环境变量可设HOST=127.0.0.1、PORT=8787、DB_PATH=/srv/shiguang/data/shiguang.sqlite。使用自己的有效域名及HTTPS证书，由反向代理访问Node端口。

```nginx
server {
    listen 443 ssl;
    server_name lostfound.example.edu;
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

以上是参考配置，不是上线证据。上线后先检查/api/health，再用两个设备连接同一HTTPS根地址验证发布及更新。不要在临时无持久磁盘环境保存SQLite，停止服务后备份整个data目录。

| 接口 | 行为 | 身份要求 |
| --- | --- | --- |
| GET /api/health | 健康、版本、稳定服务编号 | 无 |
| POST /api/sessions | 新设备凭证 | 无 |
| GET /api/me | 核对自己的编号 | Bearer |
| GET /api/items | 公共列表和组合查询 | 无 |
| GET /api/items/:id | 详情和联系方式 | 无 |
| POST /api/items | 服务校验、保存、请求号去重 | Bearer |
| PATCH /api/items/:id/status | open/resolved | 原发布者Bearer |

服务不信任客户端传入的ownerId。联系方式公开给同服务的使用者；不提供地图、即时聊天、实名认证、复杂后台或账号跨设备恢复。
