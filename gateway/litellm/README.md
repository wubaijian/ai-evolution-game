# LiteLLM 本地网关

本目录负责把不同模型服务商统一成一个 OpenAI-Compatible 网关。模型 API Key 只保存在服务端，不进入浏览器或游戏构建产物。

这里安装的是轻量网关运行时，不包含 LiteLLM 自带的企业后台、统计和云存储组件；这些工作由本项目现有的开发者后台承担。

## 使用

首次安装：

```bash
npm run gateway:setup
```

启动网关：

```bash
npm run gateway:start
```

另开一个终端检查网关：

```bash
npm run gateway:check
```

默认地址为 `http://127.0.0.1:4000`。服务商连接由网页开发者后台管理；保存或删除连接后，后台会更新 `developer-data/litellm-config.local.yaml`，网关通过热重载刷新模型列表。
