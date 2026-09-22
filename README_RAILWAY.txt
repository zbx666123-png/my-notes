【云便签 · 一键部署版】

这个版本已经加入 Dockerfile 和 Railway 配置。

部署时：
1. 把整个项目上传到 GitHub 仓库。
2. 在 Railway 选择 Deploy from GitHub Repo。
3. Railway 会自动识别 Dockerfile 并启动。
4. 给服务添加一个 Volume，挂载路径填写：/app/data
5. 生成域名后，用手机打开这个网址即可。

数据库会保存在 /app/data/notes.db。
只要 Volume 不删除，服务器重启/重新部署后数据还在。

注意：本项目适合个人/小规模使用。公开生产环境请升级密码哈希算法并做好备份。
